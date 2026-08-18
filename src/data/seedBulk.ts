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
  Tranche,
  TrancheStatus,
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

/** A stable numeric seed from an application id, so a per-application stream
 *  can be opened without touching the shared one. */
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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

// ---- Why a file closed (§v5) ----------------------------------------------
//
// This table exists because the closure reason used to be `rng.pick(REJ_CODES)`
// — drawn independently of the ask, the university, the bureau score, the FOIR
// and the blocker. Every rejection code was therefore uncorrelated with every
// feature of the file it sat on, and only APP-2613 (hand-written) had a reason
// that its own evidence supported.
//
// That is fine for a pipeline board, which only counts. It is fatal for a
// learning agent, which would report "files at this university fail 22% of the
// time" from pure noise and be believed. So a closure now has a CAUSE, and the
// file's features are generated to be consistent with it.
//
// The conditioning is deliberately SOFT — the ranges below overlap the ranges
// healthy files draw from. A learner should find a real signal it has to work
// for, not a separator it can read off in one column.
interface ClosureCause {
  code: string
  /** Where this cause actually surfaces. Rejection for adverse bureau lands at
   *  S06 Bureau & financial analysis; collateral shortfall cannot surface
   *  before S09. The stage is part of the cause, not a separate draw. */
  stage: Stage
  /** Relative frequency. */
  weight: number
  /** Feature pressure this cause implies, applied when the file is built. */
  bureau?: readonly [number, number]
  foirPct?: readonly [number, number]
  /** Requires a university outside the lender's approved tiers. */
  needsUnlistedUniversity?: boolean
  /** Requires a secured construct — a collateral cause needs collateral. */
  needsSecured?: boolean
  /** Requires the customer to have gone silent. */
  needsSilentCustomer?: boolean
  /** Requires a sanction to already exist. */
  needsSanction?: boolean
}

const REJECTION_CAUSES: readonly ClosureCause[] = [
  { code: 'REJ-01', stage: 'S07', weight: 22, foirPct: [66, 88] },
  { code: 'REJ-02', stage: 'S06', weight: 18, bureau: [512, 664] },
  { code: 'REJ-03', stage: 'S07', weight: 16, needsUnlistedUniversity: true },
  { code: 'REJ-04', stage: 'S07', weight: 8, needsUnlistedUniversity: true },
  { code: 'REJ-05', stage: 'S09', weight: 12, needsSecured: true },
  { code: 'REJ-06', stage: 'S08', weight: 5 },
  { code: 'REJ-07', stage: 'S04', weight: 9, needsSilentCustomer: true },
  { code: 'REJ-08', stage: 'S12', weight: 4, needsSanction: true },
  { code: 'REJ-09', stage: 'S06', weight: 6, bureau: [560, 700] },
]

const WITHDRAWAL_CAUSES: readonly ClosureCause[] = [
  { code: 'WD-01', stage: 'S07', weight: 24 },
  { code: 'WD-02', stage: 'S04', weight: 22 },
  { code: 'WD-03', stage: 'S05', weight: 16 },
  { code: 'WD-04', stage: 'S02', weight: 14 },
  { code: 'WD-05', stage: 'S05', weight: 24 },
]

const EXPIRY_CAUSES: readonly ClosureCause[] = [
  { code: 'EXP-01', stage: 'S04', weight: 52, needsSilentCustomer: true },
  { code: 'EXP-02', stage: 'S11', weight: 30, needsSanction: true },
  { code: 'EXP-03', stage: 'S04', weight: 18, needsSilentCustomer: true },
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

function liteValidations(
  stage: Stage,
  rng: Rng,
  failIds: string[],
  waived: { id: string; reason: string }[] = [],
): ValidationResult[] {
  const rank = stageRank(stage)
  const out: ValidationResult[] = []
  const waivedById = new Map(waived.map((w) => [w.id, w.reason]))
  for (const def of ACTIVE_VALIDATIONS) {
    const m = def.triggerStage.match(/S(\d\d)/)
    const trig = m ? parseInt(m[1], 10) : 99
    if (trig > rank) continue // not yet triggered — omitted (treated as resolved)
    const reason = waivedById.get(def.id)
    if (reason) {
      // §v5 — NOT APPLICABLE, which is a different thing from resolved and a
      // different thing again from never collected. Nothing in the seed carried
      // a waived validation before, so `SufficiencyOutput.notApplicable` was
      // empty on all 214 files and agent 1.3's central distinction — the gate
      // reads an ABSENT validation as a pass — could only ever be shown from
      // the "never collected" side.
      out.push({ catalogueId: def.id, status: 'waived', message: reason })
    } else if (failIds.includes(def.id)) {
      out.push({ catalogueId: def.id, status: 'fail', message: def.failMessage })
    } else {
      out.push({ catalogueId: def.id, status: 'pass', message: def.passMessage })
    }
  }
  return out
}

/** The waivers a file's own construct makes inevitable.
 *
 *  Both of these are written into the catalogue as construct-dependent —
 *  VAL-INT-12 is "(co-applicant salaried)" and VAL-INT-13 is "(co-app SE)". A
 *  salaried co-applicant has no P&L and no balance sheet to reconcile; a
 *  self-employed one files no Form 16. Exactly one of the pair is inapplicable
 *  on every file, and which one is decided by the income branch rather than a
 *  draw — the same discipline the closure causes follow. */
function constructWaivers(incomeBranch: 'salaried' | 'self_employed'): { id: string; reason: string }[] {
  return incomeBranch === 'salaried'
    ? [{ id: 'VAL-INT-13', reason: 'Not applicable — co-applicant is salaried; there is no P&L or balance sheet to reconcile.' }]
    : [{ id: 'VAL-INT-12', reason: 'Not applicable — co-applicant is self-employed and files no Form 16.' }]
}


/** §v5 — a tranche schedule for files that have reached disbursement.
 *
 *  Nothing generated one before, so `tranches: []` on all 200 bulk files and
 *  the only schedule in the whole seed was the hand-written pair on APP-2612.
 *  The disbursement gating orchestrator would have had a single file to run on.
 *
 *  Shape follows the curated file: a tuition tranche remitted per semester by
 *  SWIFT to the university, and a smaller living tranche. Amounts derive from
 *  the file's own ask at the policy FX reference, so `amountUsd × fxUsed`
 *  reconciles to `amountInr` exactly — the rate agent checks that, and a seed
 *  that failed its own arithmetic would be reporting a defect that is not
 *  there. A minority draw an off-reference rate, which is a real condition the
 *  band test exists to catch. */
function buildTranches(appId: string, askInr: number, rank: number): Tranche[] {
  // A PRIVATE stream, seeded from the application id.
  //
  // Not the shared `rng`: every draw taken from that one shifts the sequence
  // for every application generated afterwards. Adding tranches to the ~30
  // files at disbursement would have silently re-rolled the closure causes,
  // stages and bureau scores of the other 170 — the disbursed population fell
  // from 7 to 4 on the first attempt, which is a Phase 1 guarantee quietly
  // undone by a Phase 3 feature. Seeded from the id, this is deterministic,
  // repeatable, and costs the shared stream nothing.
  const rng = makeRng(hashSeed(appId))
  const totalUsd = Math.round(askInr / POLICY.fxReference)
  // Two semesters, tuition-heavy, living the remainder.
  const split = [
    { n: 1, type: 'Tuition-SWIFT-to-university' as const, share: 0.45, semester: 'Fall 2026' },
    { n: 2, type: 'Living-to-foreign-account-or-forex-card' as const, share: 0.2, semester: 'Fall 2026' },
    { n: 3, type: 'Tuition-SWIFT-to-university' as const, share: 0.35, semester: 'Spring 2027' },
  ]
  return split.map(({ n, type, share, semester }) => {
    // A slice of tranches carry a rate off the reference — the only thing on a
    // file that can put VAL-CRS-24 outside its band.
    const offBand = rng.chance(0.12)
    const fxUsed = offBand
      ? Math.round(POLICY.fxReference * (1 + rng.pick([-0.035, -0.028, 0.031, 0.042])) * 100) / 100
      : POLICY.fxReference
    const amountUsd = Math.round(totalUsd * share)
    const status: TrancheStatus =
      rank >= 13 && n === 1 ? 'remitted' : rank >= 13 && n === 2 ? 'gated' : 'scheduled'
    return {
      id: `T${appId.slice(4)}-${n}`,
      n,
      type,
      semester,
      amountUsd,
      amountInr: Math.round(amountUsd * fxUsed),
      fxUsed,
      // Seeded gate booleans are left EMPTY on generated files. They were only
      // ever hand-typed, and the orchestrator computes them from the file — a
      // stored copy would be a second answer to the same question.
      gates: [],
      status,
      // A minority reach disbursement without Form A2 filed, which is the
      // statutory block the FEMA agent exists to raise — but NEVER on a tranche
      // that has already gone. Money cannot have been remitted without the
      // instrument it was remitted under, and a seed that says otherwise is
      // asking the agent to report a contradiction rather than a finding.
      a2FemaOnFile: status === 'remitted' ? true : !rng.chance(0.15),
    }
  })
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
  const prog = rng.pick(PROGRAMS)
  const stage = rng.weighted(STAGE_WEIGHTS)

  // --- why this file closed, decided BEFORE its features ------------------
  // The cause is drawn first so the file can be built to support it. Doing it
  // the other way round is what produced a seed where a "adverse bureau"
  // rejection sat on a co-applicant scoring 780.
  const cause: ClosureCause | undefined =
    stage === 'REJECTED' ? rng.weighted(REJECTION_CAUSES.map((c) => [c, c.weight] as const))
    : stage === 'WITHDRAWN' ? rng.weighted(WITHDRAWAL_CAUSES.map((c) => [c, c.weight] as const))
    : stage === 'EXPIRED' ? rng.weighted(EXPIRY_CAUSES.map((c) => [c, c.weight] as const))
    : undefined

  // A cause that turns on the university picks from the unlisted pool; every
  // other file draws normally, so the two populations overlap rather than
  // separating cleanly.
  const uni = cause?.needsUnlistedUniversity
    ? rng.pick(UNIVERSITIES.filter((u) => u.tier === 'other'))
    : rng.pick(UNIVERSITIES)
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
  // A collateral-shortfall rejection needs collateral to be short of.
  const withinOverlay =
    overlayCeiling > 0 && askInr <= overlayCeiling && !cause?.needsSecured
  const securedConstruct = !withinOverlay
  const tier: Tier = withinOverlay ? 'Premier-Overlay-Unsecured' : 'Tier-3'

  // --- credit features, computed BEFORE the outcome so it can rest on them --
  // These used to be written after the outcome block (bureauScore at the party
  // literal, FOIR inside `extracted`), which is precisely why no closure could
  // reference them.
  const bureauScore = cause?.bureau
    ? rng.int(cause.bureau[0], cause.bureau[1])
    : rng.int(640, 810)
  const foirPct = cause?.foirPct
    ? rng.int(cause.foirPct[0], cause.foirPct[1])
    : rng.int(34, 62)

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
  // A file closed FOR silence must actually have been silent — otherwise the
  // reason and the record disagree on the only fact the reason rests on.
  const wentSilent = cause?.needsSilentCustomer === true
  const lastActivityAt =
    wentSilent || (blockerKind === 'customer' && rng.chance(0.12))
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
  const validations = liteValidations(stage, rng, failIds, constructWaivers(profile.incomeBranch))

  // --- sanction clock ------------------------------------------------------
  // A sanction-lapse expiry and a visa rejection after documentation both
  // presuppose a sanction, so the cause can force one onto a terminal file.
  const hasSanction = rank >= 11 || stage === 'DISBURSED_ACTIVE' || cause?.needsSanction === true
  const sanctionDate = hasSanction ? daysAgoIso(daysInStage + rng.int(5, 170)) : undefined
  const sanctionExpiryDate = sanctionDate ? plusDaysIso(sanctionDate, POLICY.sanctionValidityDays) : undefined

  // --- outcome (closure forensics) -----------------------------------------
  let outcome: Outcome | undefined
  let rejectionCode: string | undefined
  if (terminal) {
    const kind: ClosureKind =
      stage === 'REJECTED' ? 'rejected'
      : stage === 'WITHDRAWN' ? 'withdrawn'
      : stage === 'EXPIRED' ? 'expired'
      : 'disbursed'

    // DISBURSED_ACTIVE now carries an Outcome too. It had none, so there was no
    // structured record of a file that went WELL — every rate a cohort learner
    // could compute was a rejection rate with no denominator of successes.
    const code = kind === 'disbursed' ? 'OK-01' : (cause?.code ?? 'REJ-07')
    const label =
      kind === 'disbursed' ? 'Disbursed and active' : CODE_LABEL[code] ?? code

    // The stage comes from the CAUSE, not an independent draw. A collateral
    // shortfall surfaces at S09; adverse bureau at S06. Previously this was
    // weighted at random and could place a collateral rejection at S06, before
    // the collateral had been looked at.
    const closureStage: Stage = kind === 'disbursed' ? 'S13' : (cause?.stage ?? 'S04')

    // `closedAt` used to be `stageEnteredAt` verbatim, which made
    // `daysToClosure` a restatement of the file's age in its final stage rather
    // than its age since creation.
    const closedAt = stageEnteredAt
    if (kind === 'rejected') rejectionCode = code

    outcome = {
      kind,
      code,
      label,
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
      // Drawn above, conditioned on the closure cause. The old range was
      // rng.int(680, 810) — no file in the entire seed could justify REJ-02
      // "adverse bureau", because nothing scored below 680.
      bureauScore,
    },
  ]
  if (securedConstruct) {
    parties.push({
      id: `${appId}-COL`, role: 'collateral_provider', name: coApplicantName, kycStatus: rank >= 9 ? 'verified' : 'in_progress',
      bucketIds: buckets.filter((b) => b.section === 'collateral').map((b) => b.id),
    })
  }

  const coaUsd = Math.round((askInr / POLICY.fxReference) * 1.15)

  // --- deviations ----------------------------------------------------------
  // `deviations: []` unconditionally meant exactly ONE deviation existed across
  // all 214 files, so `effectiveBand` never escalated and `deviationRollup`
  // returned a single row. They are raised from the file's own facts, not
  // sprinkled: a FOIR in the 55–65 band IS a DEV-01 by definition.
  const deviations: Application['deviations'] = []
  const raiseDev = (defId: string, title: string, rationale: string) => {
    deviations.push({
      id: `${appId}-DV${deviations.length + 1}`,
      defId,
      title,
      raisedBy: officer.name,
      stage: String(stage),
      rationale,
      approvalLevel: askInr < 50_00_000 ? 'Central Risk' : 'Credit Committee (Central Risk + Admin countersign)',
      status: rank >= 10 ? 'approved' : 'open',
    })
  }
  if (rank >= 7) {
    if (foirPct > POLICY.foirPolicy.postMoratoriumPassMax && foirPct <= POLICY.foirPolicy.postMoratoriumDeviationMax) {
      raiseDev('DEV-01', 'FOIR 55–65% with compensating factors', `Post-moratorium FOIR ${foirPct}%`)
    }
    if (uni.tier === 'other' && rng.chance(0.35)) {
      raiseDev('DEV-02', 'University Tier-B/C with strong programmatic case', `${uni.short} outside the approved tiers`)
    }
    if (securedConstruct && rng.chance(0.12)) {
      raiseDev('DEV-03', 'LTV above policy', 'Valuation below the indicative figure at sanction')
    }
  }

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
    // §v5 — terminal files synthesize their history up to the stage they were
    // actually closed in, so `stageHistory` and `outcome.stageAtClosure` cannot
    // disagree. `funnelRollup` reads "reached stage N" off this array.
    stageHistory: buildHistory(stage, stageEnteredAt, 3, outcome?.stageAtClosure),
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
      // Reads the FOIR drawn above rather than a fresh number, so a file
      // rejected for an unresolvable FOIR breach actually shows one.
      ef(
        'co_applicant',
        'Derived credit',
        'foir_post_moratorium_pct',
        '≤55',
        String(foirPct),
        foirPct <= POLICY.foirPolicy.postMoratoriumPassMax ? 'pass' : 'fail',
        true,
      ),
    ],
    validations,
    deviations,
    covenants: [],
    // §v5 — only files that actually reached disbursement carry a schedule.
    //
    // Named stages, NOT `rank >= 13`: `stageRank` returns 99 for every terminal
    // token, so a rank test hands a tranche schedule to REJECTED, WITHDRAWN and
    // EXPIRED files as well — 28 of them, including files closed at S07 that
    // never saw a sanction. A rejected application has no disbursement.
    tranches:
      stage === 'S13' || stage === 'DISBURSED_ACTIVE'
        ? buildTranches(appId, askInr, stageRank(stage))
        : [],
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
