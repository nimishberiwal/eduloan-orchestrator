// ============================================================================
// Procedural seed (§v2) — ~200 additional applications so that per-stage
// filtering, batch grouping, rejection insights and escalations have realistic
// volume behind them.
//
// Deterministic: a fixed-seed mulberry32 PRNG means every reload and every
// `Reset demo data` produces byte-identical data.
//
// IDs start at APP-2701 so they can never collide with the 14 curated
// APP-26xx acceptance applications, which are always emitted first.
// ============================================================================
import type {
  Application,
  Assignment,
  Blocker,
  BlockerKind,
  Channel,
  ClosureKind,
  DocumentItem,
  Intake,
  Outcome,
  RoleId,
  Stage,
  StageId,
  Status,
  Tier,
  ValidationResult,
} from '@/types'
import { ACTIVE_VALIDATIONS } from '@/data/validations'
import { generateBuckets, generateDocuments } from '@/data/buckets'
import { BRANCHES, OFFICERS, officersOf } from '@/data/org'
import { CODE_LABEL, EXP_CODES, REJ_CODES, WD_CODES } from '@/data/reasonCodes'
import { POLICY } from '@/data/policy'
import { STAGES } from '@/data/stages'
import { defaultDeptForStage } from '@/lib/stateMachine'
import { buildHistory, buildLanes, daysAgoIso, ef, plusDaysIso } from '@/data/seedHelpers'
import { buildConsents } from '@/data/consents'
import { daysBetween } from '@/lib/format'

// ---- Deterministic PRNG ----------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Rng {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(arr: readonly T[]) => T
  weighted: <T>(entries: readonly (readonly [T, number])[]) => T
  chance: (p: number) => boolean
}

function makeRng(seed: number): Rng {
  const next = mulberry32(seed)
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]
  const weighted = <T,>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((t, e) => t + e[1], 0)
    let r = next() * total
    for (const [v, w] of entries) {
      r -= w
      if (r <= 0) return v
    }
    return entries[entries.length - 1][0]
  }
  const chance = (p: number) => next() < p
  return { next, int, pick, weighted, chance }
}

// ---- Pools -----------------------------------------------------------------
const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rudra',
  'Ayaan', 'Dhruv', 'Kabir', 'Ritvik', 'Aryan', 'Atharv', 'Advik', 'Rohan', 'Neel', 'Yash',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra', 'Aarohi', 'Anika', 'Navya', 'Kiara', 'Ira',
  'Prisha', 'Riya', 'Meera', 'Sara', 'Tara', 'Zara', 'Nitya', 'Ishita', 'Aditi', 'Kavya',
  'Rahul', 'Karan', 'Nikhil', 'Siddharth', 'Varun', 'Manav', 'Devansh', 'Harsh', 'Parth', 'Tanish',
  'Shreya', 'Pooja', 'Nandini', 'Sneha', 'Divya', 'Trisha', 'Lakshmi', 'Rhea', 'Bhavya', 'Mahi',
]
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Mehta', 'Shah', 'Desai', 'Joshi',
  'Kapoor', 'Malhotra', 'Chopra', 'Bhatia', 'Singh', 'Kaur', 'Gupta', 'Agarwal', 'Bansal', 'Jain',
  'Rao', 'Menon', 'Pillai', 'Kulkarni', 'Deshpande', 'Chauhan', 'Rathore', 'Sinha', 'Bose', 'Dutta',
  'Khan', 'Ahmed', 'Sheikh', 'Mirza', 'Thomas', 'George', 'Fernandes', 'Dsouza', 'Naidu', 'Shetty',
]

// The 14 legacy universities MUST be in this pool — otherwise the peer/cohort
// panel is empty on exactly the applications a reviewer clicks first.
const UNIVERSITIES: { name: string; short: string; tier: 'top50' | 'top100' | 'other' }[] = [
  { name: 'University of Illinois Urbana-Champaign', short: 'UIUC', tier: 'top100' },
  { name: 'University of Washington', short: 'UW', tier: 'top100' },
  { name: 'UT Austin', short: 'UT Austin', tier: 'top100' },
  { name: 'Johns Hopkins', short: 'JHU', tier: 'top50' },
  { name: 'Purdue', short: 'Purdue', tier: 'top100' },
  { name: 'Emory', short: 'Emory', tier: 'top100' },
  { name: 'Carnegie Mellon', short: 'CMU', tier: 'top50' },
  { name: 'University of Rochester', short: 'Rochester', tier: 'other' },
  { name: 'NYU', short: 'NYU', tier: 'top50' },
  { name: 'Georgia Tech', short: 'GA Tech', tier: 'top50' },
  { name: 'University of Michigan Ross', short: 'Michigan Ross', tier: 'top50' },
  { name: 'USC', short: 'USC', tier: 'top100' },
  { name: 'Boston College', short: 'Boston College', tier: 'other' },
  { name: 'Ohio State', short: 'Ohio State', tier: 'other' },
  // additional pool
  { name: 'Columbia University', short: 'Columbia', tier: 'top50' },
  { name: 'Cornell University', short: 'Cornell', tier: 'top50' },
  { name: 'University of California, Berkeley', short: 'UC Berkeley', tier: 'top50' },
  { name: 'UCLA', short: 'UCLA', tier: 'top50' },
  { name: 'Northwestern University', short: 'Northwestern', tier: 'top50' },
  { name: 'Duke University', short: 'Duke', tier: 'top50' },
  { name: 'Northeastern University', short: 'Northeastern', tier: 'top100' },
  { name: 'Arizona State University', short: 'ASU', tier: 'other' },
  { name: 'Texas A&M University', short: 'Texas A&M', tier: 'top100' },
  { name: 'University of Massachusetts Amherst', short: 'UMass Amherst', tier: 'other' },
  { name: 'Penn State University', short: 'Penn State', tier: 'top100' },
  { name: 'North Carolina State University', short: 'NC State', tier: 'other' },
  { name: 'University of Florida', short: 'UF', tier: 'top100' },
  { name: 'Rutgers University', short: 'Rutgers', tier: 'other' },
  { name: 'University at Buffalo SUNY', short: 'UB SUNY', tier: 'other' },
  { name: 'Illinois Institute of Technology', short: 'IIT Chicago', tier: 'other' },
]

const PROGRAMS: { name: string; level: Application['programLevel'] }[] = [
  { name: 'MS Computer Science', level: 'Masters' },
  { name: 'MS Data Science', level: 'Masters' },
  { name: 'MS Electrical Engineering', level: 'Masters' },
  { name: 'MEng ECE', level: 'Masters' },
  { name: 'MS Mechanical Engineering', level: 'Masters' },
  { name: 'MS Civil Engineering', level: 'Masters' },
  { name: 'MS BME', level: 'Masters' },
  { name: 'MBA', level: 'Masters' },
  { name: 'MS Finance', level: 'Masters' },
  { name: 'MS Business Analytics', level: 'Masters' },
  { name: 'MPH', level: 'Masters' },
  { name: 'MS Information Systems', level: 'Masters' },
  { name: 'MS Cybersecurity', level: 'Masters' },
  { name: 'LLM', level: 'Masters' },
  { name: 'MS Chemical Engineering', level: 'Masters' },
  { name: 'MS Robotics', level: 'Masters' },
  { name: 'MS Supply Chain Management', level: 'Masters' },
  { name: 'PhD Computer Science', level: 'PhD' },
  { name: 'PhD Materials Science', level: 'PhD' },
  { name: 'PG-Diploma Data Analytics', level: 'PG-Diploma' },
]

// Realistic origination funnel: heavy at intake, thinning toward disbursement.
const STAGE_WEIGHTS: readonly (readonly [Stage, number])[] = [
  ['S01', 22], ['S02', 20], ['S03', 18], ['S04', 26], ['S05', 18], ['S06', 14],
  ['S07', 12], ['S08', 9], ['S09', 8], ['S10', 7], ['S11', 6], ['S12', 5], ['S13', 5],
  ['REJECTED', 16], ['WITHDRAWN', 8], ['EXPIRED', 6], ['DISBURSED_ACTIVE', 4],
]

const CHANNEL_WEIGHTS: readonly (readonly [Channel, number])[] = [
  ['Digital', 42], ['Branch', 28], ['DSA', 18], ['Partner', 12],
]

// Branch volume is deliberately uneven so batch mode has something to show.
const BRANCH_WEIGHTS: readonly (readonly [string, number])[] = [
  ['BR-MUM-BKC', 20], ['BR-MUM-AND', 16], ['BR-DEL-CP', 15], ['BR-BLR-IND', 14],
  ['BR-PUN-KLN', 11], ['BR-GUR-CYB', 10], ['BR-HYD-GAC', 8], ['BR-CHE-NUN', 6],
]

const INTAKES: readonly (readonly [Intake, number])[] = [
  ['Fall-2026', 72], ['Spring-2026', 16], ['Fall-2027', 12],
]

const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id)
function stageRank(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage as StageId)
  return i < 0 ? 99 : i + 1
}

// ---- "Lite" payload --------------------------------------------------------
// Generated applications carry a reduced payload: documents only for buckets
// gated at or before the current stage, and validations only for rules already
// triggered. Safe because gating's isResolved() treats a missing validation as
// resolved, and it keeps 200 apps cheap to build and clone.
const GATE_RANK: Record<string, number> = {
  kyc: 3,
  sanction: 7,
  documentation: 12,
  disbursement_t1: 13,
  disbursement_living: 13,
}

// Only 8 distinct document profiles exist (2 income × 2 NRI × 2 secured), so
// cache the generated bucket lists and shallow-copy per application.
const bucketCache = new Map<string, ReturnType<typeof generateBuckets>>()
function cachedBuckets(profile: Parameters<typeof generateBuckets>[0]) {
  const key = `${profile.incomeBranch}|${profile.nriOverlay}|${profile.securedConstruct}`
  let v = bucketCache.get(key)
  if (!v) {
    v = generateBuckets(profile)
    bucketCache.set(key, v)
  }
  return v.map((b) => ({ ...b }))
}

function liteValidations(stage: Stage, rng: Rng, failIds: string[]): ValidationResult[] {
  const rank = stageRank(stage)
  const out: ValidationResult[] = []
  for (const def of ACTIVE_VALIDATIONS) {
    const m = def.triggerStage.match(/S(\d\d)/)
    const trig = m ? parseInt(m[1], 10) : 99
    if (trig > rank) continue // not yet triggered — omitted (treated as resolved)
    if (failIds.includes(def.id)) {
      out.push({ catalogueId: def.id, status: 'fail', message: def.failMessage })
    } else {
      out.push({ catalogueId: def.id, status: 'pass', message: def.passMessage })
    }
  }
  return out
}

// ---- Generator -------------------------------------------------------------
export interface BulkSeedOptions {
  count?: number
  seed?: number
}

export function buildBulkSeed(opts: BulkSeedOptions = {}): Application[] {
  const count = opts.count ?? 200
  const rng = makeRng(opts.seed ?? 20260720)
  const apps: Application[] = []

  for (let i = 0; i < count; i++) {
    apps.push(makeApp(i, rng))
  }
  return apps
}

function makeApp(i: number, rng: Rng): Application {
  const appId = `APP-${2701 + i}`
  const studentName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`
  const coApplicantName = `${rng.pick(FIRST_NAMES)} ${studentName.split(' ')[1]}`
  const uni = rng.pick(UNIVERSITIES)
  const prog = rng.pick(PROGRAMS)
  const stage = rng.weighted(STAGE_WEIGHTS)
  const channel = rng.weighted(CHANNEL_WEIGHTS)
  const branchId = rng.weighted(BRANCH_WEIGHTS)
  const intake = rng.weighted(INTAKES)
  const terminal = !/^S\d\d$/.test(stage)

  // --- security construct + ask -------------------------------------------
  const overlayCeiling =
    uni.tier === 'top50' ? 75_00_000 : uni.tier === 'top100' ? 50_00_000 : 0
  // Ask distribution: most files ₹20–60L, a tail up to the ₹1Cr cap.
  const askInr =
    rng.weighted([
      [rng.int(12, 25) * 1_00_000, 22],
      [rng.int(25, 45) * 1_00_000, 34],
      [rng.int(45, 65) * 1_00_000, 26],
      [rng.int(65, 85) * 1_00_000, 12],
      [rng.int(85, 100) * 1_00_000, 6],
    ])
  const withinOverlay = overlayCeiling > 0 && askInr <= overlayCeiling
  const securedConstruct = !withinOverlay
  const tier: Tier = withinOverlay ? 'Premier-Overlay-Unsecured' : 'Tier-3'

  // --- timing --------------------------------------------------------------
  // Aging skewed young, with a long tail so "aging red" columns are populated.
  let daysInStage = terminal
    ? rng.int(1, 30)
    : rng.weighted([
        [rng.int(0, 2), 40],
        [rng.int(3, 6), 30],
        [rng.int(7, 12), 20],
        [rng.int(13, 24), 10],
      ])
  // Deliberately age a slice of S02 past the 18-day auto-close threshold so the
  // destructive-rule approval queue is populated on the very first sweep.
  if (stage === 'S02' && rng.chance(0.18)) daysInStage = rng.int(19, 30)
  const stageEnteredAt = daysAgoIso(daysInStage)
  const ageBefore = rng.int(6, 40)
  const createdAt = daysAgoIso(daysInStage + ageBefore)

  // --- blocker -------------------------------------------------------------
  const blockerKind: BlockerKind = terminal
    ? 'none'
    : rng.weighted([
        ['none', 42], ['customer', 34], ['bank', 14], ['third_party', 10],
      ])
  // A slice of customer-blocked files have gone genuinely silent, tripping the
  // 30-day inactivity-expiry rule (which needs officer approval to close).
  const lastActivityAt =
    blockerKind === 'customer' && rng.chance(0.12)
      ? daysAgoIso(daysInStage + rng.int(28, 46))
      : stageEnteredAt

  const blocker: Blocker = {
    kind: blockerKind,
    detail:
      blockerKind === 'customer' ? 'customer: pending document upload'
      : blockerKind === 'bank' ? 'bank: internal verification in progress'
      : blockerKind === 'third_party' ? 'third_party: external agency response awaited'
      : undefined,
  }

  // --- ownership -----------------------------------------------------------
  const dept = defaultDeptForStage(stage)
  const pool = officersOf(dept).filter((o) => o.managerId !== null) // exclude apex
  const branchPool = pool.filter((o) => o.branchId === branchId)
  const officer = (branchPool.length ? rng.pick(branchPool) : rng.pick(pool.length ? pool : OFFICERS))
  const assignment: Assignment = {
    officerId: officer.id,
    assignedAt: stageEnteredAt,
    slaHours: POLICY.assignmentSlaHours,
    escalationLevel: 0,
  }

  // --- status --------------------------------------------------------------
  const status: Status = terminal
    ? stage === 'DISBURSED_ACTIVE' ? 'completed' : 'rejected'
    : rng.weighted<Status>([
        ['in_progress', 46], ['pending', 30], ['sent_back', 8],
        ['on_hold', 6], ['pending_checker', stage === 'S10' ? 30 : 2], ['not_started', 8],
      ])

  // --- documents (lite) ----------------------------------------------------
  const profile = { incomeBranch: rng.chance(0.7) ? 'salaried' as const : 'self_employed' as const, nriOverlay: rng.chance(0.12), securedConstruct }
  const buckets = cachedBuckets(profile)
  const rank = stageRank(stage)
  const activeBuckets = buckets.filter((b) => (GATE_RANK[b.requiredByStage] ?? 99) <= Math.max(rank, 3))
  const docStatus: DocumentItem['status'] = rank >= 5 ? 'verified' : rank >= 4 ? 'uploaded' : 'requested'
  const documents = generateDocuments(activeBuckets, docStatus)
  // Leave a realistic tail of outstanding items on files still collecting docs.
  if (rank <= 5 && documents.length) {
    const pendingCount = rng.int(0, Math.min(8, documents.length))
    for (let d = 0; d < pendingCount; d++) documents[rng.int(0, documents.length - 1)].status = 'requested'
  }

  // --- validations (lite) --------------------------------------------------
  const failIds: string[] = []
  if (!terminal && rng.chance(0.18)) failIds.push(rng.pick(['VAL-CRS-01', 'VAL-INT-06', 'VAL-EXT-03', 'VAL-CRS-17', 'VAL-EXT-11']))
  const validations = liteValidations(stage, rng, failIds)

  // --- sanction clock ------------------------------------------------------
  const hasSanction = rank >= 11 || stage === 'DISBURSED_ACTIVE'
  const sanctionDate = hasSanction ? daysAgoIso(daysInStage + rng.int(5, 170)) : undefined
  const sanctionExpiryDate = sanctionDate ? plusDaysIso(sanctionDate, POLICY.sanctionValidityDays) : undefined

  // --- outcome (closure forensics) -----------------------------------------
  let outcome: Outcome | undefined
  let rejectionCode: string | undefined
  if (terminal && stage !== 'DISBURSED_ACTIVE') {
    const kind: ClosureKind =
      stage === 'REJECTED' ? 'rejected' : stage === 'WITHDRAWN' ? 'withdrawn' : 'expired'
    const codeDef =
      kind === 'rejected' ? rng.pick(REJ_CODES)
      : kind === 'withdrawn' ? rng.pick(WD_CODES)
      : rng.pick(EXP_CODES)
    // Rejections cluster where the underwriting actually happens.
    const closureStage: Stage =
      kind === 'rejected'
        ? rng.weighted<Stage>([['S06', 18], ['S07', 26], ['S08', 16], ['S09', 10], ['S10', 30]])
        : kind === 'expired'
          ? rng.weighted<Stage>([['S03', 14], ['S04', 56], ['S05', 20], ['S11', 10]])
          : rng.weighted<Stage>([['S02', 18], ['S04', 26], ['S05', 16], ['S07', 20], ['S11', 20]])
    const closedAt = stageEnteredAt
    if (kind === 'rejected') rejectionCode = codeDef.id
    outcome = {
      kind,
      code: codeDef.id,
      label: CODE_LABEL[codeDef.id] ?? codeDef.label,
      stageAtClosure: closureStage,
      closedAt,
      decidedBy: kind === 'expired' ? 'System' : officer.name,
      decidedByRole: (kind === 'expired' ? 'Ops' : officer.role) as RoleId,
      department: dept,
      branchId,
      daysToClosure: Math.max(1, daysBetween(closedAt, createdAt)),
      askInr,
      detail: undefined,
    }
  }

  const parties: Application['parties'] = [
    {
      id: `${appId}-A`, role: 'applicant', name: studentName, kycStatus: rank >= 3 ? 'verified' : 'in_progress',
      bucketIds: buckets.filter((b) => b.section === 'applicant').map((b) => b.id),
    },
    {
      id: `${appId}-C`, role: 'co_applicant', name: coApplicantName, kycStatus: rank >= 3 ? 'verified' : 'in_progress',
      bucketIds: buckets.filter((b) => b.section === 'co_applicant').map((b) => b.id),
      bureauScore: rng.int(680, 810),
    },
  ]
  if (securedConstruct) {
    parties.push({
      id: `${appId}-COL`, role: 'collateral_provider', name: coApplicantName, kycStatus: rank >= 9 ? 'verified' : 'in_progress',
      bucketIds: buckets.filter((b) => b.section === 'collateral').map((b) => b.id),
    })
  }

  const coaUsd = Math.round((askInr / POLICY.fxReference) * 1.15)

  return {
    appId,
    studentName,
    university: uni.name,
    universityShort: uni.short,
    program: prog.name,
    programLevel: prog.level,
    programStartDate: '2026-08-25T00:00:00.000Z',
    intake,
    channel,
    askInr,
    tier,
    overlayBasis: withinOverlay ? (uni.tier === 'top50' ? 'Global-Rank-Top-50' : 'Global-Rank-Top-100') : undefined,
    overlayCeilingInr: overlayCeiling || undefined,
    stage,
    status,
    owner: { department: dept, officer: officer.name, officerId: officer.id },
    blocker,
    branchId,
    assignment,
    createdAt,
    stageEnteredAt,
    stageHistory: buildHistory(stage, stageEnteredAt),
    sanctionDate,
    sanctionExpiryDate,
    lastCustomerActivityAt: blockerKind === 'customer' ? lastActivityAt : undefined,
    incomeBranch: profile.incomeBranch,
    nriOverlay: profile.nriOverlay,
    securedConstruct,
    parties,
    buckets,
    documents,
    consents: buildConsents(appId, parties, stageEnteredAt, undefined, rank),
    extracted: [
      ef('applicant', 'Admission (E5 / I-20)', 'university_name', uni.name, uni.name),
      ef('applicant', 'COA (E6)', 'coa_program_total', `$${coaUsd.toLocaleString()}`, `$${coaUsd.toLocaleString()}`, 'pass', true),
      ef('co_applicant', 'Identity (P1)', 'name_as_per_pan', coApplicantName, coApplicantName),
      ef('co_applicant', 'Derived credit', 'foir_post_moratorium_pct', '≤55', String(rng.int(34, 58)), 'pass', true),
    ],
    validations,
    deviations: [],
    covenants: [],
    tranches: [],
    audit: [
      {
        id: `${appId}-AE1`,
        ts: createdAt,
        actor: officer.name,
        role: officer.role,
        verb: 'CREATE / REGISTER',
        toStage: 'S01',
        remarks: `Sourced via ${channel}`,
      },
    ],
    comms: [],
    integrations: [],
    notes: [],
    decision: stage === 'REJECTED' ? 'DECLINE' : rank >= 11 ? 'APPROVE' : undefined,
    rejectionCode,
    outcome,
    lanes: buildLanes(stage, securedConstruct, {}),
  }
}
