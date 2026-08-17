// ============================================================================
// Seed data (§14) — 14 applications, scenario-exact.
// All Fall-2026 intake, program start 2026-08-25 unless noted.
// ============================================================================
import type {
  Application,
  Assignment,
  AuditEvent,
  Channel,
  ClosureKind,
  CommEvent,
  Deviation,
  Covenant,
  ExtractedField,
  Intake,
  IntegrationCall,
  Note,
  Outcome,
  Owner,
  RoleId,
  SavedFilter,
  Stage,
  Status,
  Tier,
  Tranche,
  ValidationResult,
} from '@/types'
import type { ConsentStatus, ConsentType } from '@/types'
import { DEFAULT_BRANCH_ID, PRIMARY_OFFICER, resolveOfficer } from '@/data/org'
import { buildConsents } from '@/data/consents'
import { buildBulkSeed } from '@/data/seedBulk'
import { CODE_LABEL } from '@/data/reasonCodes'
import { daysBetween } from '@/lib/format'
import {
  buildDocs,
  buildHistory,
  buildLanes,
  buildValidations,
  daysAgoIso,
  ef,
  mkAudit,
  plusDaysIso,
  type ValOverride,
} from '@/data/seedHelpers'
import { COV_DEFS } from '@/data/covenants'
import { DEV_DEFS } from '@/data/reasonCodes'
import { POLICY } from '@/data/policy'

const PROGRAM_START = '2026-08-25T00:00:00.000Z'

interface AppSpec {
  // --- §v2 additions: all optional, defaulted inside mkApp ---
  branchId?: string
  intake?: Intake
  programStartDate?: string
  assignedAt?: string
  slaHours?: number
  closureCode?: string
  closureStage?: Stage
  closureDetail?: string
  closureDecidedBy?: string
  consentOverrides?: Partial<Record<ConsentType, ConsentStatus>>
  // --- v1 fields (unchanged) ---
  appId: string
  studentName: string
  university: string
  universityShort: string
  program: string
  programLevel: Application['programLevel']
  askInr: number
  channel: Channel
  tier: Tier
  overlayBasis?: Application['overlayBasis']
  overlayCeilingInr?: number
  stage: Stage
  status: Status
  blocker: Application['blocker']
  owner: Owner
  daysInStage: number
  incomeBranch: 'salaried' | 'self_employed'
  nriOverlay?: boolean
  securedConstruct?: boolean
  coApplicantName: string
  sanctionDate?: string
  valOverrides?: Record<string, ValOverride>
  pendingFrom?: string
  docDefault?: Application['documents'][number]['status']
  docOverrides?: Parameters<typeof buildDocs>[2]
  deviations?: Deviation[]
  covenants?: Covenant[]
  tranches?: Tranche[]
  extracted?: ExtractedField[]
  audit?: Omit<AuditEvent, 'id'>[]
  comms?: CommEvent[]
  integrations?: IntegrationCall[]
  committeePath?: boolean
  decision?: Application['decision']
  pendingChecker?: Application['pendingChecker']
  rejectionCode?: string
  coApplicantFailedKyc?: boolean
  collateralUpto?: number
  lastCustomerActivityAt?: string
}

function dev(defId: string, o: Partial<Deviation>): Deviation {
  const def = DEV_DEFS.find((d) => d.id === defId)!
  return {
    id: o.id ?? `${defId}-1`,
    defId,
    title: def.title,
    raisedBy: o.raisedBy ?? 'S. Kulkarni',
    stage: o.stage ?? 'S07',
    rationale: o.rationale ?? '',
    approvalLevel: o.approvalLevel ?? 'Central Risk',
    status: o.status ?? 'open',
  }
}
function cov(defId: string, o: Partial<Covenant> = {}): Covenant {
  const def = COV_DEFS.find((d) => d.id === defId)!
  return {
    id: o.id ?? `${defId}-1`,
    defId,
    title: def.title,
    raisedAt: o.raisedAt ?? daysAgoIso(10),
    clearBy: o.clearBy ?? def.clearBy,
    status: o.status ?? 'open',
  }
}

// ---- §v2 defaults ----------------------------------------------------------
// Every v2 Application field is REQUIRED on the type, OPTIONAL on AppSpec, and
// defaulted here — so the 14 hand-written literals below never need editing.

/** Derive structured closure forensics for a terminal application. */
function deriveOutcome(
  s: AppSpec,
  stageHistory: { stage: string; enteredAt: string }[],
  createdAt: string,
  branchId: string,
): Outcome | undefined {
  const kind: ClosureKind | null =
    s.stage === 'REJECTED' ? 'rejected'
    : s.stage === 'WITHDRAWN' ? 'withdrawn'
    : s.stage === 'EXPIRED' ? 'expired'
    : null
  if (!kind) return undefined

  // The stage they were IN when closed = last non-terminal entry in history.
  const priors = stageHistory.filter((h) => /^S\d\d$/.test(h.stage))
  const stageAtClosure = (s.closureStage ?? priors[priors.length - 1]?.stage ?? 'S01') as Stage

  const code =
    s.closureCode ??
    s.rejectionCode ??
    (kind === 'expired' ? 'EXP-01' : kind === 'withdrawn' ? 'WD-01' : 'REJ-07')
  const closedAt = daysAgoIso(s.daysInStage)

  // Prefer the audit line that actually moved it to the terminal.
  const closingEvent = (s.audit ?? []).find((a) => a.toStage === s.stage)

  return {
    kind,
    code,
    label: CODE_LABEL[code] ?? code,
    stageAtClosure,
    closedAt,
    decidedBy: s.closureDecidedBy ?? closingEvent?.actor ?? s.owner.officer,
    decidedByRole: (closingEvent?.role ?? 'Admin') as RoleId,
    department: s.owner.department,
    branchId,
    daysToClosure: Math.max(0, daysBetween(closedAt, createdAt)),
    askInr: s.askInr,
    detail: s.closureDetail ?? closingEvent?.remarks,
  }
}

/** 1-based position of a stage in S01–S13; terminals rank as fully progressed. */
function seedStageRank(stage: Stage): number {
  const m = /^S(\d\d)$/.exec(String(stage))
  return m ? parseInt(m[1], 10) : 99
}

function mkApp(s: AppSpec): Application {
  const stageEnteredAt = daysAgoIso(s.daysInStage)
  const createdAt = daysAgoIso(s.daysInStage + 12)
  const branchId = s.branchId ?? DEFAULT_BRANCH_ID
  const resolvedOfficer = resolveOfficer(s.owner)
  const owner: Application['owner'] = resolvedOfficer
    ? { ...s.owner, officerId: resolvedOfficer.id }
    : s.owner
  // The assignee received the file when it entered the current stage.
  const assignment: Assignment = {
    officerId: resolvedOfficer?.id ?? PRIMARY_OFFICER[s.owner.department].id,
    assignedAt: s.assignedAt ?? stageEnteredAt,
    slaHours: s.slaHours ?? POLICY.assignmentSlaHours,
    escalationLevel: 0,
  }
  const profile = {
    incomeBranch: s.incomeBranch,
    nriOverlay: s.nriOverlay ?? false,
    securedConstruct: s.securedConstruct ?? false,
  }
  const stageHistory = buildHistory(s.stage, stageEnteredAt)
  const { buckets, documents } = buildDocs(profile, s.docDefault ?? 'verified', s.docOverrides ?? [])
  const validations: ValidationResult[] = buildValidations(s.valOverrides ?? {}, s.pendingFrom, {
    university: s.university,
    program: s.program,
    programLevel: s.programLevel,
    incomeBranch: s.incomeBranch,
  })

  const parties: Application['parties'] = [
    {
      id: `${s.appId}-A`,
      role: 'applicant',
      name: s.studentName,
      kycStatus: s.coApplicantFailedKyc ? 'verified' : 'verified',
      bucketIds: buckets.filter((b) => b.section === 'applicant').map((b) => b.id),
    },
    {
      id: `${s.appId}-C`,
      role: 'co_applicant',
      name: s.coApplicantName,
      kycStatus: s.coApplicantFailedKyc ? 'failed' : 'verified',
      kycDetail: s.coApplicantFailedKyc ? 'Aadhaar eKYC failed (VAL-EXT-03)' : undefined,
      bucketIds: buckets.filter((b) => b.section === 'co_applicant').map((b) => b.id),
      bureauScore: 762,
    },
  ]
  if (s.securedConstruct) {
    parties.push({
      id: `${s.appId}-COL`,
      role: 'collateral_provider',
      name: s.coApplicantName,
      kycStatus: 'verified',
      bucketIds: buckets.filter((b) => b.section === 'collateral').map((b) => b.id),
    })
  }

  return {
    appId: s.appId,
    studentName: s.studentName,
    university: s.university,
    universityShort: s.universityShort,
    program: s.program,
    programLevel: s.programLevel,
    programStartDate: s.programStartDate ?? PROGRAM_START,
    intake: s.intake ?? 'Fall-2026',
    channel: s.channel,
    askInr: s.askInr,
    tier: s.tier,
    overlayBasis: s.overlayBasis,
    overlayCeilingInr: s.overlayCeilingInr,
    stage: s.stage,
    status: s.status,
    owner,
    blocker: s.blocker,
    branchId,
    assignment,
    createdAt,
    stageEnteredAt,
    stageHistory,
    sanctionDate: s.sanctionDate,
    sanctionExpiryDate: s.sanctionDate ? plusDaysIso(s.sanctionDate, POLICY.sanctionValidityDays) : undefined,
    lastCustomerActivityAt: s.lastCustomerActivityAt,
    incomeBranch: s.incomeBranch,
    nriOverlay: s.nriOverlay ?? false,
    securedConstruct: s.securedConstruct ?? false,
    parties,
    buckets,
    documents,
    // Consent progression tracks the journey: identity consents land at KYC,
    // the financial ones (AA / TRACES / GST / bureau) at credit analysis.
    consents: buildConsents(
      s.appId, parties, stageEnteredAt, s.consentOverrides, seedStageRank(s.stage),
    ),
    extracted: s.extracted ?? defaultExtracted(s),
    validations,
    deviations: s.deviations ?? [],
    covenants: s.covenants ?? [],
    tranches: s.tranches ?? [],
    audit: (s.audit ?? []).map((a, i) => mkAudit(a, i + 1)),
    comms: s.comms ?? [],
    integrations: s.integrations ?? defaultIntegrations(s),
    notes: [],
    decision: s.decision,
    pendingChecker: s.pendingChecker,
    rejectionCode: s.rejectionCode,
    outcome: deriveOutcome(s, stageHistory, createdAt, branchId),
    lanes: buildLanes(s.stage, s.securedConstruct ?? false, {
      coApplicantFailedKyc: s.coApplicantFailedKyc,
      collateralUpto: s.collateralUpto,
    }),
    committeePath: s.committeePath,
  }
}

// ---- Default representative extracted fields --------------------------------
function defaultExtracted(s: AppSpec): ExtractedField[] {
  const coaUsd = Math.round((s.askInr / POLICY.fxReference) * 1.15)
  return [
    ef('applicant', 'Identity', 'pan_number', 'ABCDE1234F', 'ABCDE1234F'),
    ef('applicant', 'Identity', 'name_as_per_pan', s.studentName, s.studentName),
    ef('applicant', 'Identity', 'passport_expiry', '2031-05-10', '2031-05-10'),
    ef('applicant', 'Identity', 'validity_months_at_course_start', '≥6', '57', 'pass', true),
    ef('applicant', 'Admission (E5 / I-20)', 'university_name', s.university, s.university),
    ef('applicant', 'Admission (E5 / I-20)', 'program_name', s.program, s.program),
    ef('applicant', 'Admission (E5 / I-20)', 'admission_status', 'Unconditional', 'Unconditional'),
    ef('applicant', 'COA (E6)', 'coa_program_total', `$${coaUsd.toLocaleString()}`, `$${coaUsd.toLocaleString()}`, 'pass', true),
    ef('applicant', 'COA (E6)', 'net_loan_ask_inr', `₹${s.askInr.toLocaleString('en-IN')}`, `₹${s.askInr.toLocaleString('en-IN')}`, 'pass', true),
    ef('applicant', 'COA (E6)', 'fx_rate_used', '84.00', '84.00'),
    ef('co_applicant', 'Identity (P1)', 'name_as_per_pan', s.coApplicantName, s.coApplicantName),
    ef('co_applicant', 'Identity (P1)', 'relationship', 'Father', 'Father'),
    ef('co_applicant', 'Identity (P1)', 'residency', s.nriOverlay ? 'NRI' : 'Resident', s.nriOverlay ? 'NRI' : 'Resident'),
    ef('co_applicant', 'Derived credit', 'income_convergence_gap_pct', '≤15', '11', 'pass', true),
    ef('co_applicant', 'Derived credit', 'foir_post_moratorium_pct', '≤55', '48', 'pass', true),
    ef('co_applicant', 'Bureau (P6)', 'cibil_score', '—', '762'),
  ]
}

function defaultIntegrations(s: AppSpec): IntegrationCall[] {
  const base: IntegrationCall[] = [
    { id: `${s.appId}-i1`, system: 'NSDL PAN', purpose: 'PAN status', status: 'success', latencyMs: 320, lastAttempt: daysAgoIso(s.daysInStage + 4), linkedValidationId: 'VAL-EXT-01' },
    { id: `${s.appId}-i2`, system: 'UIDAI eKYC', purpose: 'Aadhaar eKYC', status: 'success', latencyMs: 610, lastAttempt: daysAgoIso(s.daysInStage + 4), linkedValidationId: 'VAL-EXT-03' },
    { id: `${s.appId}-i3`, system: 'CKYC search', purpose: 'CKYC lookup', status: 'success', latencyMs: 450, lastAttempt: daysAgoIso(s.daysInStage + 4) },
    { id: `${s.appId}-i4`, system: 'Passport Seva', purpose: 'Passport verify', status: 'success', latencyMs: 890, lastAttempt: daysAgoIso(s.daysInStage + 4), linkedValidationId: 'VAL-EXT-04' },
  ]
  return base
}

// ============================================================================
// The 14 applications
// ============================================================================
export function buildSeed(): Application[] {
  const apps: Application[] = []

  // --- APP-2601 · Fresh registration, Digital -------------------------------
  apps.push(mkApp({
    appId: 'APP-2601', studentName: 'Aarav Shah', university: 'University of Illinois Urbana-Champaign',
    universityShort: 'UIUC', program: 'MS Computer Science', programLevel: 'Masters', askInr: 45_00_000,
    channel: 'Digital', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S01', status: 'in_progress', blocker: { kind: 'none' }, owner: { department: 'Sales', officer: 'P. Shah' },
    daysInStage: 0, incomeBranch: 'salaried', coApplicantName: 'Rakesh Shah',
    pendingFrom: 'S01', docDefault: 'requested',
    audit: [{ ts: daysAgoIso(0), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01', remarks: 'APP ID minted post OTP (Digital channel)' }],
    comms: [{ id: 'c2601-1', ts: daysAgoIso(0), channel: 'Email', templateId: 'welcome', subject: 'Welcome to Horizon Bank EduLoan', body: 'Dear Aarav Shah, your education loan application APP-2601 has been registered. We\'ll guide you through each step.', auto: true }],
  }))

  // --- APP-2602 · Capture underway, Sales-owned -----------------------------
  apps.push(mkApp({
    appId: 'APP-2602', studentName: 'Diya Patel', university: 'University of Washington',
    universityShort: 'UW', program: 'MS Data Science', programLevel: 'Masters', askInr: 38_00_000,
    channel: 'Branch', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S02', status: 'in_progress', blocker: { kind: 'customer', detail: 'customer: completing course & co-applicant details' },
    owner: { department: 'Sales', officer: 'P. Shah' }, daysInStage: 2, incomeBranch: 'salaried', coApplicantName: 'Nisha Patel',
    pendingFrom: 'S02', docDefault: 'requested', lastCustomerActivityAt: daysAgoIso(2),
    audit: [
      { ts: daysAgoIso(4), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(2), actor: 'P. Shah', role: 'Sales', verb: 'MOVE FORWARD', fromStage: 'S01', toStage: 'S02' },
    ],
  }))

  // --- APP-2603 · Parallel KYC lanes; co-applicant eKYC failed --------------
  apps.push(mkApp({
    appId: 'APP-2603', studentName: 'Rohan Mehta', university: 'UT Austin',
    universityShort: 'UT Austin', program: 'MEng ECE', programLevel: 'Masters', askInr: 42_00_000,
    channel: 'DSA', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S03', status: 'pending', blocker: { kind: 'customer', detail: 'customer: co-applicant Aadhaar eKYC failed — re-consent needed' },
    owner: { department: 'Ops', officer: 'R. Iyer' }, daysInStage: 5, incomeBranch: 'salaried', coApplicantName: 'Prakash Mehta',
    coApplicantFailedKyc: true, docDefault: 'uploaded', pendingFrom: 'S03',
    valOverrides: {
      'VAL-EXT-03': { status: 'fail', tokens: { party: 'co-applicant', reason: 'demographic mismatch' } },
    },
    integrations: [
      { id: 'i2603-1', system: 'NSDL PAN', purpose: 'PAN status', status: 'success', latencyMs: 300, lastAttempt: daysAgoIso(5), linkedValidationId: 'VAL-EXT-01' },
      { id: 'i2603-2', system: 'UIDAI eKYC', purpose: 'Aadhaar eKYC (applicant)', status: 'success', latencyMs: 590, lastAttempt: daysAgoIso(5), linkedValidationId: 'VAL-EXT-03' },
      { id: 'i2603-3', system: 'UIDAI eKYC', purpose: 'Aadhaar eKYC (co-applicant)', status: 'failed', latencyMs: 1200, lastAttempt: daysAgoIso(1), linkedValidationId: 'VAL-EXT-03' },
      { id: 'i2603-4', system: 'Passport Seva', purpose: 'Passport verify', status: 'success', latencyMs: 870, lastAttempt: daysAgoIso(5), linkedValidationId: 'VAL-EXT-04' },
    ],
    audit: [
      { ts: daysAgoIso(9), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(5), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S02', toStage: 'S03' },
      { ts: daysAgoIso(1), actor: 'System', role: 'Ops', verb: 'INTEGRATION FAILED', remarks: 'UIDAI eKYC failed for co-applicant — VAL-EXT-03' },
    ],
    comms: [{ id: 'c2603-1', ts: daysAgoIso(1), channel: 'WhatsApp', templateId: 'doc_request', subject: 'Documents required', body: 'Hi Rohan Mehta, please re-attempt co-applicant Aadhaar eKYC to proceed.', auto: true }],
  }))

  // --- APP-2604 · Doc collection, 6/16 buckets pending, Band-2 --------------
  apps.push(mkApp({
    appId: 'APP-2604', studentName: 'Sneha Reddy', university: 'Johns Hopkins',
    universityShort: 'JHU', program: 'MS BME', programLevel: 'Masters', askInr: 55_00_000,
    channel: 'Partner', tier: 'Tier-3', securedConstruct: true, stage: 'S04', status: 'pending',
    blocker: { kind: 'customer', detail: 'customer: 6 buckets pending upload' }, owner: { department: 'Ops', officer: 'R. Iyer' },
    daysInStage: 6, incomeBranch: 'self_employed', coApplicantName: 'Venkat Reddy', lastCustomerActivityAt: daysAgoIso(6),
    docDefault: 'verified', pendingFrom: 'S04',
    docOverrides: [
      { match: 'E3', status: 'requested' }, { match: 'E6', status: 'requested' }, { match: 'E7', status: 'requested' },
      { match: 'P3', status: 'requested' }, { match: 'C2', status: 'requested' }, { match: 'C3', status: 'requested' },
    ],
    audit: [
      { ts: daysAgoIso(18), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(6), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S03', toStage: 'S04' },
      { ts: daysAgoIso(4), actor: 'R. Iyer', role: 'Ops', verb: 'SEND NUDGE', remarks: 'T+2 document reminder' },
      { ts: daysAgoIso(1), actor: 'R. Iyer', role: 'Ops', verb: 'SEND NUDGE', remarks: 'T+5 document reminder' },
    ],
    comms: [
      { id: 'c2604-1', ts: daysAgoIso(6), channel: 'WhatsApp', templateId: 'doc_request', subject: 'Documents required', body: 'Hi Sneha Reddy, please upload the pending documents to proceed: E3 Academic, E6 COA, E7 Accreditation, P3 Income (SE), C2 Title, C3 Legal.', auto: true },
      { id: 'c2604-2', ts: daysAgoIso(4), channel: 'WhatsApp', templateId: 'nudge', subject: 'Reminder', body: 'Reminder T+2: your application APP-2604 is awaiting document upload.', auto: true },
      { id: 'c2604-3', ts: daysAgoIso(1), channel: 'WhatsApp', templateId: 'nudge', subject: 'Reminder', body: 'Reminder T+5: your application APP-2604 is awaiting document upload.', auto: true },
    ],
  }))

  // --- APP-2605 · Mismatches (CRS-01, INT-06), re-upload loop, SB-02 ---------
  apps.push(mkApp({
    appId: 'APP-2605', studentName: 'Kabir Singh', university: 'Purdue',
    universityShort: 'Purdue', program: 'MS Mechanical Engineering', programLevel: 'Masters', askInr: 47_00_000,
    channel: 'Digital', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S05', status: 'sent_back', blocker: { kind: 'bank', detail: 'bank: extraction re-verification in progress' },
    owner: { department: 'Ops', officer: 'R. Iyer' }, daysInStage: 3, incomeBranch: 'salaried', coApplicantName: 'Harjeet Singh',
    docDefault: 'verified', pendingFrom: 'S05',
    valOverrides: {
      'VAL-CRS-01': { status: 'fail', tokens: { docA: 'PAN', nameA: 'Kabir Singh', docB: 'I-20', nameB: 'Kabir Sing', score: '0.91' } },
      'VAL-INT-06': { status: 'fail', tokens: { coa_year: '$45,000', coa_total: '$90,000', delta: '$1,200' } },
    },
    docOverrides: [{ match: 'I-20 with SEVIS', status: 'rejected', reason: 'Name mismatch vs PAN — re-upload', version: 2 }],
    extracted: [
      ef('applicant', 'Identity', 'name_as_per_pan', 'Kabir Singh', 'Kabir Singh'),
      ef('applicant', 'Admission (E5 / I-20)', 'university_name', 'Purdue', 'Purdue'),
      ef('applicant', 'Admission (E5 / I-20)', 'name_on_i20', 'Kabir Singh', 'Kabir Sing', 'fail'),
      ef('applicant', 'COA (E6)', 'coa_total_per_year', '$45,000', '$45,000', 'pass', true),
      ef('applicant', 'COA (E6)', 'coa_program_total', '$90,000', '$88,800', 'fail', true),
      ef('applicant', 'COA (E6)', 'coa_arithmetic_delta', '$0', '$1,200', 'fail', true),
      ef('co_applicant', 'Identity (P1)', 'name_as_per_pan', 'Harjeet Singh', 'Harjeet Singh'),
      ef('co_applicant', 'Derived credit', 'foir_post_moratorium_pct', '≤55', '46', 'pass', true),
    ],
    audit: [
      { ts: daysAgoIso(15), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(6), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S04', toStage: 'S05' },
      { ts: daysAgoIso(3), actor: 'R. Iyer', role: 'Ops', verb: 'SEND BACK', fromStage: 'S05', toStage: 'S05', reasonCode: 'SB-02', remarks: 'Extraction mismatch: name similarity 0.91, COA arithmetic Δ $1,200 — re-verification' },
    ],
  }))

  // --- APP-2606 · NRI overlay, 4-way gap 12%, AA pending --------------------
  apps.push(mkApp({
    appId: 'APP-2606', studentName: 'Ananya Iyer', university: 'Emory',
    universityShort: 'Emory', program: 'MPH', programLevel: 'Masters', askInr: 72_00_000,
    channel: 'Branch', tier: 'Tier-3', securedConstruct: true, nriOverlay: true, stage: 'S06', status: 'in_progress',
    blocker: { kind: 'third_party', detail: 'third_party: Account Aggregator consent pull awaited' }, owner: { department: 'Credit', officer: 'S. Kulkarni' },
    daysInStage: 4, incomeBranch: 'salaried', coApplicantName: 'Suresh Iyer', pendingFrom: 'S06',
    valOverrides: {
      'VAL-CRS-17': { status: 'pass', tokens: { gap: '12', income: '2,85,000' } },
      'VAL-EXT-11': { status: 'pending' },
    },
    extracted: [
      ef('applicant', 'Admission (E5 / I-20)', 'university_name', 'Emory University', 'Emory University'),
      ef('co_applicant', 'Identity (P1)', 'residency', 'NRI', 'NRI'),
      ef('co_applicant', 'NRI overlay (P4)', 'foreign_employer', 'Gulf Petrochem FZE', 'Gulf Petrochem FZE'),
      ef('co_applicant', 'NRI overlay (P4)', 'country', 'UAE (Dubai)', 'UAE (Dubai)'),
      ef('co_applicant', 'NRI overlay (P4)', 'foreign_tax_returns_verified', 'true', 'true'),
      ef('co_applicant', 'Derived credit', 'income_convergence_gap_pct', '≤15', '12', 'pass', true),
      ef('co_applicant', 'Derived credit', 'foir_post_moratorium_pct', '≤55', '51', 'pass', true),
    ],
    integrations: [
      { id: 'i2606-1', system: 'NSDL PAN', purpose: 'PAN status', status: 'success', latencyMs: 320, lastAttempt: daysAgoIso(8), linkedValidationId: 'VAL-EXT-01' },
      { id: 'i2606-2', system: 'CIBIL', purpose: 'Bureau pull', status: 'success', latencyMs: 720, lastAttempt: daysAgoIso(4), linkedValidationId: 'VAL-EXT-12' },
      { id: 'i2606-3', system: 'Account Aggregator', purpose: 'Banking pull', status: 'pending', latencyMs: 0, lastAttempt: daysAgoIso(1), linkedValidationId: 'VAL-EXT-11' },
      { id: 'i2606-4', system: 'ITD/TRACES', purpose: 'ITR/26AS match', status: 'success', latencyMs: 980, lastAttempt: daysAgoIso(4), linkedValidationId: 'VAL-EXT-10' },
    ],
    audit: [
      { ts: daysAgoIso(20), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(4), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S05', toStage: 'S06' },
    ],
  }))

  // --- APP-2607 · Overlay valid, DEV-05 open ⇒ Committee path ----------------
  apps.push(mkApp({
    appId: 'APP-2607', studentName: 'Vivaan Kumar', university: 'Carnegie Mellon',
    universityShort: 'CMU', program: 'MS Computer Science', programLevel: 'Masters', askInr: 52_00_000,
    channel: 'Digital', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-50', overlayCeilingInr: 75_00_000,
    stage: 'S07', status: 'in_progress', blocker: { kind: 'none' }, owner: { department: 'Credit', officer: 'S. Kulkarni' },
    daysInStage: 2, incomeBranch: 'salaried', coApplicantName: 'Manoj Kumar', committeePath: true, pendingFrom: 'S07',
    valOverrides: {
      'VAL-CRS-09': { status: 'pass', tokens: { basis: 'Global-Rank-Top-50', ask: '52,00,000', ceiling: '75,00,000' } },
      'VAL-INT-07': { status: 'fail', tokens: { which_test: 'GRE General', age: 'test-optional admission' } },
    },
    deviations: [dev('DEV-05', { stage: 'S07', raisedBy: 'S. Kulkarni', rationale: 'CMU MSCS admitted test-optional; entrance waiver accepted', approvalLevel: 'Credit Committee (Central Risk + Admin countersign)', status: 'open' })],
    extracted: [
      ef('applicant', 'Admission (E5 / I-20)', 'university_name', 'Carnegie Mellon University', 'Carnegie Mellon University'),
      ef('applicant', 'Tests (E4)', 'test_optional_admission', 'true', 'true'),
      ef('applicant', 'Accreditation & tier (E7)', 'lender_slot', 'Premier-Global', 'Premier-Global'),
      ef('applicant', 'Accreditation & tier (E7)', 'premier_overlay_eligible', 'true', 'true'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_basis', 'Global-Rank-Top-50', 'Global-Rank-Top-50'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_unsecured_ceiling_inr', '₹75,00,000', '₹75,00,000'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_loan_within_ceiling', 'true', 'true', 'pass', true),
      ef('applicant', 'Accreditation & tier (E7)', 'qs_rank', '—', '28'),
      ef('co_applicant', 'Derived credit', 'foir_post_moratorium_pct', '≤55', '44', 'pass', true),
    ],
    audit: [
      { ts: daysAgoIso(16), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(2), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'MOVE FORWARD', fromStage: 'S06', toStage: 'S07' },
      { ts: daysAgoIso(2), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'RAISE DEVIATION', reasonCode: 'DEV-05', remarks: 'Test-optional admission accepted (entrance waiver)' },
    ],
  }))

  // --- APP-2608 · Tier flip → Tier-3, CHECKLIST_REGENERATED ------------------
  apps.push(mkApp({
    appId: 'APP-2608', studentName: 'Ishaan Verma', university: 'University of Rochester',
    universityShort: 'Rochester', program: 'MS Business Analytics', programLevel: 'Masters', askInr: 65_00_000,
    channel: 'Partner', tier: 'Tier-3', securedConstruct: true, stage: 'S09', status: 'in_progress',
    blocker: { kind: 'third_party', detail: 'third_party: panel valuer report awaited' }, owner: { department: 'Ops', officer: 'R. Iyer' },
    daysInStage: 8, incomeBranch: 'salaried', coApplicantName: 'Dinesh Verma', collateralUpto: 1, pendingFrom: 'S09',
    valOverrides: {
      'VAL-CRS-09': { status: 'fail', tokens: { ask: '65,00,000', ceiling: '50,00,000' } },
      'VAL-EXT-15': { status: 'pending' },
      'VAL-CRS-20': { status: 'pending' },
      'VAL-INT-14': { status: 'pass', tokens: { years: '30' } },
    },
    docOverrides: [
      { match: 'C1', status: 'verified' },
      { match: 'Panel legal opinion', status: 'verified' },
      { match: 'Panel technical valuation', status: 'requested' },
    ],
    extracted: [
      ef('applicant', 'Accreditation & tier (E7)', 'lender_slot', 'Premier-Global (claimed)', 'Tier-A (Top-100 only)', 'fail'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_basis', 'Global-Rank-Top-100', 'Global-Rank-Top-100'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_unsecured_ceiling_inr', '₹50,00,000', '₹50,00,000'),
      ef('applicant', 'Accreditation & tier (E7)', 'overlay_loan_within_ceiling', 'true', 'false', 'fail', true),
      ef('collateral', 'Collateral', 'collateral_type', 'Immovable', 'Immovable'),
      ef('collateral', 'Collateral', 'legal_opinion', 'Clear', 'Clear'),
      ef('collateral', 'Collateral', 'technical_value_inr', 'awaited', 'awaited', 'pending'),
      ef('collateral', 'Collateral', 'ltv_pct', '≤70', 'pending', 'pending', true),
    ],
    integrations: [
      { id: 'i2608-1', system: 'CIBIL', purpose: 'Bureau pull', status: 'success', latencyMs: 700, lastAttempt: daysAgoIso(12), linkedValidationId: 'VAL-EXT-12' },
      { id: 'i2608-2', system: 'SEVIS check', purpose: 'SEVIS active', status: 'success', latencyMs: 640, lastAttempt: daysAgoIso(10), linkedValidationId: 'VAL-EXT-07' },
      { id: 'i2608-3', system: 'SRO/land-records', purpose: 'Title/lien lookup', status: 'pending', latencyMs: 0, lastAttempt: daysAgoIso(2), linkedValidationId: 'VAL-EXT-15' },
    ],
    audit: [
      { ts: daysAgoIso(24), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(12), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'MOVE FORWARD', fromStage: 'S06', toStage: 'S07' },
      { ts: daysAgoIso(11), actor: 'System', role: 'Credit-Regional', verb: 'CHECKLIST_REGENERATED (Premier-Overlay → Tier-3)', remarks: 'VAL-CRS-09 fail: ask ₹65,00,000 > ₹50,00,000 ceiling. C1–C4 + L2 mortgage rows added.' },
      { ts: daysAgoIso(11), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'SEND BACK', fromStage: 'S07', toStage: 'S07', reasonCode: 'SB-05', remarks: 'Eligibility recompute / tier flip to Tier-3' },
      { ts: daysAgoIso(8), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S07', toStage: 'S09', remarks: 'Collateral processing (legal ∥ valuation)' },
    ],
  }))

  // --- APP-2609 · S08 on_hold, PEP false-positive (Compliance clears) --------
  apps.push(mkApp({
    appId: 'APP-2609', studentName: 'Meera Nair', university: 'NYU',
    universityShort: 'NYU', program: 'LLM', programLevel: 'Masters', askInr: 35_00_000,
    channel: 'Branch', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S08', status: 'on_hold', blocker: { kind: 'bank', detail: 'bank: PEP/sanctions manual review — Compliance only' },
    owner: { department: 'Risk', officer: 'A. Menon' }, daysInStage: 3, incomeBranch: 'salaried', coApplicantName: 'Rajan Nair', pendingFrom: 'S08',
    valOverrides: {
      'VAL-EXT-14': { status: 'fail', tokens: { party: 'co-applicant', list: 'UN/OFAC' } },
      'VAL-CRS-08': { status: 'pass', tokens: { accreditor: 'ABA', program: 'LLM' } },
    },
    integrations: [
      { id: 'i2609-1', system: 'PEP/sanctions screen', purpose: 'UN·OFAC·EU·UK-HMT', status: 'failed', latencyMs: 1400, lastAttempt: daysAgoIso(3), linkedValidationId: 'VAL-EXT-14' },
      { id: 'i2609-2', system: 'CIBIL', purpose: 'Bureau pull', status: 'success', latencyMs: 690, lastAttempt: daysAgoIso(9), linkedValidationId: 'VAL-EXT-12' },
    ],
    audit: [
      { ts: daysAgoIso(19), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(3), actor: 'A. Menon', role: 'Risk-Central', verb: 'MOVE FORWARD', fromStage: 'S07', toStage: 'S08' },
      { ts: daysAgoIso(3), actor: 'A. Menon', role: 'Risk-Central', verb: 'HOLD', reasonCode: 'HLD-04', remarks: 'Potential PEP match on co-applicant — Compliance review' },
    ],
  }))

  // --- APP-2610 · S10 pending_checker (maker-checker demo) -------------------
  apps.push(mkApp({
    appId: 'APP-2610', studentName: 'Arjun Desai', university: 'Georgia Tech',
    universityShort: 'GA Tech', program: 'MS Electrical Engineering', programLevel: 'Masters', askInr: 44_00_000,
    channel: 'Digital', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'S10', status: 'pending_checker', blocker: { kind: 'none' }, owner: { department: 'Credit', officer: 'S. Kulkarni' },
    daysInStage: 1, incomeBranch: 'salaried', coApplicantName: 'Bhavin Desai',
    decision: 'APPROVE',
    pendingChecker: { verb: 'final_decision', maker: 'S. Kulkarni', makerRole: 'Credit-Regional', ts: daysAgoIso(1), summary: 'APPROVE at Band-1 — awaiting checker countersign' },
    extracted: undefined,
    audit: [
      { ts: daysAgoIso(13), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(2), actor: 'A. Menon', role: 'Risk-Central', verb: 'MOVE FORWARD', fromStage: 'S08', toStage: 'S10' },
      { ts: daysAgoIso(1), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'FINAL DECISION (maker)', remarks: 'APPROVE — Band-1 (< ₹50L). Pending checker countersign.' },
    ],
  }))

  // --- APP-2611 · AWC sanction, COV-01 + COV-04 open, expiry 28d amber -------
  const sanction2611 = daysAgoIso(152)
  apps.push(mkApp({
    appId: 'APP-2611', studentName: 'Zara Khan', university: 'University of Michigan Ross',
    universityShort: 'Michigan Ross', program: 'MBA', programLevel: 'Masters', askInr: 58_00_000,
    channel: 'Partner', tier: 'Tier-3', securedConstruct: true, stage: 'S12', status: 'in_progress',
    blocker: { kind: 'customer', detail: 'customer: e-sign & NACH pending' }, owner: { department: 'Ops', officer: 'R. Iyer' },
    daysInStage: 4, incomeBranch: 'self_employed', coApplicantName: 'Imran Khan', sanctionDate: sanction2611,
    collateralUpto: 4, pendingFrom: 'S12', lastCustomerActivityAt: daysAgoIso(4),
    valOverrides: {
      'VAL-EXT-16': { status: 'pass', tokens: { company: 'Khan Textiles Pvt Ltd' } },
      'VAL-CRS-11': { status: 'pass', tokens: { status: 'Conditional' } },
      'VAL-EXT-13': { status: 'pending' },
    },
    decision: 'APPROVE_WITH_CONDITIONS',
    covenants: [
      cov('COV-01', { status: 'open', raisedAt: sanction2611 }),
      cov('COV-04', { status: 'open', raisedAt: sanction2611 }),
    ],
    extracted: [
      ef('applicant', 'Admission (E5 / I-20)', 'admission_status', 'Conditional', 'Conditional'),
      ef('applicant', 'Tests (E4)', 'test_type', 'GMAT', 'GMAT'),
      ef('applicant', 'COA (E6)', 'sponsor_amount', '₹12,00,000', '₹12,00,000'),
      ef('applicant', 'COA (E6)', 'net_loan_ask_inr', '₹58,00,000', '₹58,00,000', 'pass', true),
      ef('co_applicant', 'Income — self-employed (P3)', 'business_name', 'Khan Textiles Pvt Ltd', 'Khan Textiles Pvt Ltd'),
      ef('co_applicant', 'Income — self-employed (P3)', 'udin_verified', 'true', 'true'),
      ef('collateral', 'Collateral', 'perfection_status', 'Pending', 'Pending', 'pending'),
    ],
    audit: [
      { ts: daysAgoIso(170), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(153), actor: 'A. Menon', role: 'Risk-Central', verb: 'FINAL DECISION (maker)', remarks: 'APPROVE-WITH-CONDITIONS — Band-2' },
      { ts: daysAgoIso(152), actor: 'Admin', role: 'Admin', verb: 'COUNTERSIGN (committee)', remarks: 'Committee countersign; COV-01 + COV-04 attached' },
      { ts: daysAgoIso(152), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'SANCTION ISSUED', toStage: 'S11', remarks: 'Sanction letter; validity clock started (180d)' },
      { ts: daysAgoIso(6), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S11', toStage: 'S12' },
    ],
    comms: [
      { id: 'c2611-1', ts: daysAgoIso(152), channel: 'Email', templateId: 'sanction_issued', subject: 'Sanction letter issued', body: 'Congratulations Zara Khan! Your loan is sanctioned. Please review and accept your offer.', auto: true },
      { id: 'c2611-2', ts: daysAgoIso(2), channel: 'Email', templateId: 'sanction_expiry', subject: 'Sanction expiring soon', body: 'Your sanction for APP-2611 expires in 28 days. Please complete e-sign / NACH to avoid revalidation.', auto: true },
    ],
  }))

  // --- APP-2612 · S13 tranche disbursement, T2 gated on visa ----------------
  const tranches2612: Tranche[] = [
    {
      id: 'T2612-1', n: 1, type: 'Tuition-SWIFT-to-university', semester: 'Fall 2026',
      amountUsd: 28_000, amountInr: 23_52_000, fxUsed: 84.0,
      gates: [
        { label: 'VAL-CRS-21 LRS within cap', ref: 'VAL-CRS-21', passed: true },
        { label: 'VAL-CRS-22 A2/FEMA on file', ref: 'VAL-CRS-22', passed: true },
        { label: 'VAL-CRS-23 Visa endorsement', ref: 'VAL-CRS-23', passed: true },
        { label: 'VAL-EXT-18 Endorsement verified', ref: 'VAL-EXT-18', passed: true },
      ],
      status: 'remitted', a2FemaOnFile: true,
    },
    {
      id: 'T2612-2', n: 2, type: 'Living-to-foreign-account-or-forex-card', semester: 'Fall 2026',
      amountUsd: 12_000, amountInr: 10_08_000, fxUsed: 84.0,
      gates: [
        { label: 'VAL-CRS-21 LRS within cap', ref: 'VAL-CRS-21', passed: true },
        { label: 'VAL-CRS-22 A2/FEMA on file', ref: 'VAL-CRS-22', passed: true },
        { label: 'VAL-CRS-23 Visa endorsement (living gated on visa)', ref: 'VAL-CRS-23', passed: false },
        { label: 'VAL-EXT-18 Endorsement verified', ref: 'VAL-EXT-18', passed: false },
        { label: 'E10 Foreign banking verified', ref: 'E10', passed: false },
      ],
      status: 'gated', a2FemaOnFile: true,
    },
  ]
  apps.push(mkApp({
    appId: 'APP-2612', studentName: 'Advait Joshi', university: 'USC',
    universityShort: 'USC', program: 'MS Computer Science', programLevel: 'Masters', askInr: 80_00_000,
    channel: 'Digital', tier: 'Tier-3', securedConstruct: true, stage: 'S13', status: 'in_progress',
    blocker: { kind: 'customer', detail: 'customer: upload stamped visa (Tranche 2 living gate)' }, owner: { department: 'Ops', officer: 'R. Iyer' },
    daysInStage: 5, incomeBranch: 'salaried', coApplicantName: 'Prashant Joshi', sanctionDate: daysAgoIso(40),
    collateralUpto: 4, tranches: tranches2612,
    valOverrides: {
      'VAL-CRS-23': { status: 'fail' },
      'VAL-EXT-18': { status: 'fail' },
    },
    docOverrides: [
      { match: 'F-1 endorsement', status: 'requested' },
      { match: 'Foreign bank account', status: 'requested' },
      { match: 'University wire details', status: 'requested' },
    ],
    extracted: [
      ef('applicant', 'Visa (E9)', 'visa_type', 'F-1', 'F-1'),
      ef('applicant', 'Visa (E9)', 'visa_status', 'Applied', 'Applied'),
      ef('applicant', 'Visa (E9)', 'endorsement_verified', 'false', 'false', 'fail'),
      ef('applicant', 'Visa (E9)', 'sevis_active', 'true', 'true'),
      ef('collateral', 'Collateral', 'perfection_status', 'Perfected', 'Perfected'),
    ],
    audit: [
      { ts: daysAgoIso(60), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(40), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'SANCTION ISSUED', toStage: 'S11' },
      { ts: daysAgoIso(20), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S12', toStage: 'S13' },
      { ts: daysAgoIso(12), actor: 'R. Iyer', role: 'Ops', verb: 'RELEASE TRANCHE (maker)', remarks: 'Tranche 1 tuition — SWIFT to USC' },
      { ts: daysAgoIso(12), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'RELEASE TRANCHE (checker)', remarks: 'Tranche 1 countersigned — remitted' },
    ],
    integrations: [
      { id: 'i2612-1', system: 'SWIFT message status', purpose: 'Tranche 1 remittance', status: 'success', latencyMs: 2100, lastAttempt: daysAgoIso(12) },
      { id: 'i2612-2', system: 'PEP/sanctions screen', purpose: 'Pre-disbursement', status: 'success', latencyMs: 800, lastAttempt: daysAgoIso(20), linkedValidationId: 'VAL-EXT-14' },
      { id: 'i2612-3', system: 'Visa endorsement verify', purpose: 'F-1 stamping', status: 'pending', latencyMs: 0, lastAttempt: daysAgoIso(5), linkedValidationId: 'VAL-EXT-18' },
    ],
  }))

  // --- APP-2613 · REJECTED at S10, REJ-02 (bureau) --------------------------
  apps.push(mkApp({
    appId: 'APP-2613', studentName: 'Riya Kapoor', university: 'Boston College',
    universityShort: 'Boston College', program: 'MS Finance', programLevel: 'Masters', askInr: 49_00_000,
    channel: 'DSA', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'REJECTED', status: 'rejected', blocker: { kind: 'none' }, owner: { department: 'Credit', officer: 'S. Kulkarni' },
    daysInStage: 9, incomeBranch: 'salaried', coApplicantName: 'Anil Kapoor', rejectionCode: 'REJ-02', decision: 'DECLINE',
    valOverrides: {
      'VAL-EXT-12': { status: 'fail', tokens: { flag: 'DPD 90+ on co-applicant' } },
    },
    extracted: [
      ef('co_applicant', 'Bureau (P6)', 'cibil_score', '—', '648'),
      ef('co_applicant', 'Bureau (P6)', 'dpd_90_flag', 'false', 'true', 'fail'),
    ],
    integrations: [
      { id: 'i2613-1', system: 'CIBIL', purpose: 'Bureau pull', status: 'failed', latencyMs: 700, lastAttempt: daysAgoIso(11), linkedValidationId: 'VAL-EXT-12' },
    ],
    audit: [
      { ts: daysAgoIso(25), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(11), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'MOVE FORWARD', fromStage: 'S06', toStage: 'S07' },
      { ts: daysAgoIso(9), actor: 'S. Kulkarni', role: 'Credit-Regional', verb: 'FINAL DECISION — DECLINE', fromStage: 'S10', toStage: 'REJECTED', reasonCode: 'REJ-02', remarks: 'Adverse bureau: DPD 90+ on co-applicant (VAL-EXT-12)' },
    ],
    comms: [
      { id: 'c2613-1', ts: daysAgoIso(9), channel: 'Email', templateId: 'decision_comm', subject: 'Application update', body: 'Dear Riya Kapoor, there is an update on your application APP-2613. Please log in to view details.', auto: true },
    ],
  }))

  // --- APP-2614 · EXPIRED (inactivity 30d at S04) ---------------------------
  apps.push(mkApp({
    appId: 'APP-2614', studentName: 'Dev Malhotra', university: 'Ohio State',
    universityShort: 'Ohio State', program: 'MS Mechanical Engineering', programLevel: 'Masters', askInr: 40_00_000,
    channel: 'Branch', tier: 'Premier-Overlay-Unsecured', overlayBasis: 'Global-Rank-Top-100', overlayCeilingInr: 50_00_000,
    stage: 'EXPIRED', status: 'rejected', blocker: { kind: 'customer', detail: 'customer: inactive 30d after full nudge cycle' },
    owner: { department: 'Ops', officer: 'R. Iyer' }, daysInStage: 2, incomeBranch: 'salaried', coApplicantName: 'Vinod Malhotra',
    docDefault: 'requested', lastCustomerActivityAt: daysAgoIso(32),
    audit: [
      { ts: daysAgoIso(44), actor: 'P. Shah', role: 'Sales', verb: 'CREATE / REGISTER', toStage: 'S01' },
      { ts: daysAgoIso(32), actor: 'R. Iyer', role: 'Ops', verb: 'MOVE FORWARD', fromStage: 'S03', toStage: 'S04' },
      { ts: daysAgoIso(25), actor: 'R. Iyer', role: 'Ops', verb: 'SEND NUDGE', remarks: 'T+7 nudge' },
      { ts: daysAgoIso(18), actor: 'R. Iyer', role: 'Ops', verb: 'SEND NUDGE', remarks: 'T+14 nudge' },
      { ts: daysAgoIso(11), actor: 'R. Iyer', role: 'Ops', verb: 'SEND NUDGE', remarks: 'T+21 nudge' },
      { ts: daysAgoIso(2), actor: 'System', role: 'Ops', verb: 'AUTO-EXPIRY', fromStage: 'S04', toStage: 'EXPIRED', remarks: 'Inactivity 30d at S04 after full nudge cycle' },
    ],
    comms: [
      { id: 'c2614-1', ts: daysAgoIso(9), channel: 'WhatsApp', templateId: 'inactivity_warning', subject: 'Action needed to keep your application open', body: 'Hi Dev Malhotra, your application APP-2614 will close due to inactivity in 7 days.', auto: true },
    ],
  }))

  // ---- Notes with @mentions (spread across a few apps) ----------------------
  const notes: Record<string, Note[]> = {
    'APP-2605': [
      { id: 'n1', ts: daysAgoIso(3), author: 'R. Iyer', role: 'Ops', body: 'Name on I-20 reads "Kabir Sing" — likely OCR clip. @S. Kulkarni please advise if affidavit route is acceptable.', mentions: ['S. Kulkarni'] },
    ],
    'APP-2607': [
      { id: 'n2', ts: daysAgoIso(2), author: 'S. Kulkarni', role: 'Credit-Regional', body: 'DEV-05 pushes this to Committee. @A. Menon to decide, @Admin to countersign.', mentions: ['A. Menon', 'Admin'] },
    ],
    'APP-2608': [
      { id: 'n3', ts: daysAgoIso(11), author: 'S. Kulkarni', role: 'Credit-Regional', body: 'Overlay claim rejected — ask exceeds Top-100 ceiling. Checklist regenerated for Tier-3. @R. Iyer to drive collateral.', mentions: ['R. Iyer'] },
    ],
    'APP-2609': [
      { id: 'n4', ts: daysAgoIso(3), author: 'A. Menon', role: 'Risk-Central', body: 'Screening hit looks like a namesake false positive. @N. Verma only Compliance can clear this.', mentions: ['N. Verma'] },
    ],
  }
  for (const app of apps) {
    if (notes[app.appId]) app.notes = notes[app.appId]
  }

  // §v2 — the curated 14 are ALWAYS emitted first, then the procedurally
  // generated portfolio (APP-2701+). Order and IDs are guaranteed not to
  // disturb the acceptance checklist.
  return [...apps, ...buildBulkSeed()]
}

export const SAVED_FILTERS: SavedFilter[] = [
  { id: 'sf1', label: 'My queue', predicate: 'my_queue' },
  { id: 'sf2', label: 'Pending on customer', predicate: 'pending_customer' },
  { id: 'sf3', label: 'Aging red', predicate: 'aging_red' },
  { id: 'sf4', label: 'Deviations open', predicate: 'deviations_open' },
  { id: 'sf5', label: 'Pending checker', predicate: 'pending_checker' },
  { id: 'sf6', label: 'Sanction expiring ≤30d', predicate: 'sanction_expiring_30' },
  { id: 'sf7', label: 'Band-2 (Central)', predicate: 'band_2' },
  { id: 'sf8', label: 'Tier-3/secured', predicate: 'tier3_secured' },
]
