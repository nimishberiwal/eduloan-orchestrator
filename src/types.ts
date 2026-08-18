// ============================================================================
// Core domain model — Horizon Bank EduLoan Orchestrator
// The FOUR independent dimensions (§3) are never collapsed into one field.
// ============================================================================

// ---- 1. Stage (S01–S13 or terminal) ----------------------------------------
export type StageId =
  | 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07'
  | 'S08' | 'S09' | 'S10' | 'S11' | 'S12' | 'S13'
export type TerminalId = 'DISBURSED_ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'
export type Stage = StageId | TerminalId

// ---- 2. Status (within stage) ----------------------------------------------
export type Status =
  | 'not_started'
  | 'in_progress'
  | 'pending'
  | 'completed'
  | 'sent_back'
  | 'on_hold'
  | 'pending_checker'
  | 'rejected'

// ---- 3. Owner --------------------------------------------------------------
export type Department = 'Sales' | 'Ops' | 'Credit' | 'Risk' | 'Compliance' | 'Admin'
export interface Owner {
  department: Department
  officer: string
  /** v2: resolves to an OfficerRef. Optional so existing literals compile;
   *  lookup falls back to OFFICER_BY_NAME, which always hits because the six
   *  legacy officer names are real officers in data/org.ts. */
  officerId?: string
}

// ---- 4. Blocker ------------------------------------------------------------
export type BlockerKind = 'none' | 'customer' | 'bank' | 'third_party'
export interface Blocker {
  kind: BlockerKind
  detail?: string // e.g. "third_party: panel valuer report awaited"
}

// ---- Roles -----------------------------------------------------------------
export type RoleId =
  | 'Sales'
  | 'Ops'
  | 'Credit-Regional'
  | 'Risk-Central'
  | 'Compliance'
  | 'Admin'

export interface Role {
  id: RoleId
  label: string
  officer: string
  department: Department
}

// ---- Tier / DoA ------------------------------------------------------------
export type Tier = 'Tier-3' | 'Premier-Overlay-Unsecured' | 'Partially-Secured'
export type OverlayBasis =
  | 'Global-Rank-Top-50'
  | 'Global-Rank-Top-100'
  | 'Programmatic-Top'
  | 'Lender-Curated'
export type DoABand = 'Band-1' | 'Band-2' | 'Committee'
export type Channel = 'Digital' | 'Branch' | 'DSA' | 'Partner'
export type Intake = 'Fall-2026' | 'Spring-2026' | 'Fall-2027'

// ---- Parties ---------------------------------------------------------------
export type PartyRole = 'applicant' | 'co_applicant' | 'collateral_provider'
export type KycStatus = 'not_started' | 'in_progress' | 'verified' | 'failed'

export interface Party {
  id: string
  role: PartyRole
  name: string
  kycStatus: KycStatus
  kycDetail?: string
  bucketIds: string[] // doc buckets that belong to this party
  bureauScore?: number // where applicable
}

// ---- Document engine (§8) --------------------------------------------------
export type RequiredByStage =
  | 'kyc'
  | 'sanction'
  | 'documentation'
  | 'disbursement_t1'
  | 'disbursement_living'

export type DocLifecycle =
  | 'requested'
  | 'uploaded'
  | 'fetched' // v3: pulled from a digital source rather than uploaded by the customer
  | 'extracted'
  | 'qc_pass'
  | 'qc_fail'
  | 'verified'
  | 'rejected'
  | 'waived'

export type DocMandate = 'M' | 'C' | 'O'
export type PartySection = 'applicant' | 'co_applicant' | 'collateral' | 'loan'
/** @deprecated v3 — superseded by SourceSystem + SourcingMode. Kept so existing
 *  literals compile; the Documents grid now reads sourceSystem. */
export type DocSource = 'Upload' | 'DigiLocker' | 'API' | 'Manual' | 'CKYC'

// ---- v3: how a document is actually obtained (BRD checklist "Digital Source")
export type SourcingMode =
  | 'manual_upload' // the customer must provide it
  | 'consent_fetch' // fetchable, but gated on a customer consent artifact
  | 'auto_fetch' // public registry / verification lookup — no consent needed
  | 'bank_generated' // the lender or a panel vendor produces it
  | 'internal' // internal policy table

export type SourceSystem =
  // identity & KYC
  | 'NSDL' | 'UIDAI' | 'DigiLocker' | 'CKYC' | 'PassportSeva'
  // financial (consent-gated)
  | 'AccountAggregator' | 'ITD-TRACES' | 'GSTN' | 'CIC-CIBIL' | 'ForeignBureau'
  // test / credential bodies
  | 'ETS' | 'GMAC' | 'LSAC' | 'IDP-IELTS' | 'Pearson' | 'WES-ECE'
  // institution & accreditation registries
  | 'SEVIS' | 'CHEA' | 'AACSB' | 'ABET' | 'ABA' | 'LCME' | 'UniversityPortal'
  // corporate / property / payments registries
  | 'MCA21' | 'SRO-LandRecords' | 'MunicipalPortal' | 'NPCI' | 'RBI'
  // people & vendors
  | 'Employer' | 'PanelLawyer' | 'PanelValuer' | 'Embassy'
  // lender-side
  | 'LenderLOS' | 'InternalPolicy' | 'SelfDeclaration' | 'Upload'

// ---- v3: consent artifacts (BRD checklist consent-gated sources) ------------
export type ConsentType =
  | 'digilocker'
  | 'account_aggregator'
  | 'uidai_ekyc'
  | 'ckyc'
  | 'itd_traces'
  | 'gstn'
  | 'cic_bureau'

export type ConsentStatus =
  | 'not_requested' | 'requested' | 'granted' | 'declined' | 'expired' | 'revoked'

export interface ConsentArtifact {
  id: string
  type: ConsentType
  label: string // 'Account Aggregator — banking'
  partyId: string
  partyRole: PartyRole
  partyName: string
  status: ConsentStatus
  requestedAt?: string
  decidedAt?: string
  expiresAt?: string
  handle?: string // AA consent handle / DigiLocker txn id
  declineReason?: string
}

// ---- v3: document classification (BRD §7 classifier) -----------------------
export type ClassificationStatus = 'classified' | 'low_confidence' | 'unknown'
export interface DocClassification {
  label: string // BRD §7 vocabulary, e.g. GRE_SCORECARD
  confidence: number // 0–1
  status: ClassificationStatus
}

// ---- v3: HITL review queue (pipeline `hitl` node) --------------------------
export type HitlTrigger =
  | 'programmatic_accreditation_unlisted'
  | 'premier_overlay_borderline'
  | 'credential_eval_pending'
  | 'sponsored_mba_verification'
  | 'test_optional_no_entrance'
  | 'existing_ug_el_exposure'
  | 'conditional_admit'

export type HitlStatus = 'open' | 'in_review' | 'cleared' | 'escalated' | 'declined'

export interface HitlCase {
  id: string
  appId: string
  trigger: HitlTrigger
  title: string
  detail: string
  raisedAt: string
  stage: Stage
  status: HitlStatus
  owner?: string
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface DocumentItem {
  id: string
  bucketId: string
  label: string
  mandate: DocMandate
  status: DocLifecycle
  reason?: string // qc_fail / rejected / waived reason
  waivedBy?: string
  source?: DocSource // deprecated — see sourceSystem
  validUntil?: string // ISO date
  stale?: boolean
  version: number
  vintageNote?: string
  // --- v3 (BRD sourcing) ---
  sourceSystem: SourceSystem
  sourcing: SourcingMode
  consentType?: ConsentType // set when sourcing === 'consent_fetch'
  fetchedAt?: string
  classification?: DocClassification
}

export interface DocumentBucket {
  id: string // E1, P2, C3, L1 ... (v2: 'P1#2' for a second co-applicant)
  code: string
  title: string
  section: PartySection
  requiredByStage: RequiredByStage
  conditional?: boolean
  present: boolean // whether this bucket exists for this application profile
  note?: string
  /** v2: set when the bucket belongs to an additional party instance. */
  partyId?: string
  instance?: number
}

// ---- Extracted-data placeholders (§9) --------------------------------------
export type MatchState = 'pass' | 'fail' | 'pending'
export interface ExtractedField {
  id: string
  section: PartySection
  group: string // e.g. "Identity", "Academic (E3)"
  label: string
  enteredValue: string
  extractedValue: string
  match: MatchState
  derived?: boolean // ƒ badge
  /** v5 — the customer typed this and skipped the upload, so `extractedValue`
   *  is empty and `match` is 'pending' until a document evidences it. This is
   *  what the post-decision verification screen works from. Optional, so the
   *  14 seed literals compile untouched. */
  selfDeclared?: boolean
  /** v5 — which checklist documents would evidence this field. */
  backingDocIds?: string[]
  /** v5 — which EXTRACTION key evidences this field (`DeclarationSpec.fromKey`).
   *  Carried onto the record because CJ-28 verifies fields it did NOT collect:
   *  without it, the screen has a label and a typed value but no way to find
   *  the corresponding reading, and every re-check would land back on
   *  'pending'. The same form-key/reader-key namespace split that produced
   *  defect #4. */
  sourceKey?: string
}

// ---- Validation catalogue (§10) --------------------------------------------
export type ValidationTier = 'INT' | 'CRS' | 'EXT'
export type Severity = 'BLOCK' | 'WARN' | 'INFO'
export type ValidationStatus = 'pass' | 'fail' | 'waived' | 'pending'

export type RuleApplicability = 'in_scope' | 'conditional' | 'out_of_scope_us_only'

export interface ValidationDef {
  id: string // VAL-INT-01 ...
  tier: ValidationTier
  title: string
  triggerStage: string
  severity: Severity
  passMessage: string
  failMessage: string
  /** v3 — the originating BRD rule id (V-INT-17, V-CRS-09, V-EXT-23 …) so the
   *  catalogue is traceable back to BRD-18/19/20/21 without renumbering. */
  brdRef?: string
  applicability?: RuleApplicability
}

export interface ValidationResult {
  catalogueId: string // matches ValidationDef.id
  status: ValidationStatus
  message: string // rendered (tokens interpolated)
  waivedBy?: string
  tokens?: Record<string, string | number>
}

// ---- Deviations / Covenants (§7) -------------------------------------------
export interface DeviationDef {
  id: string // DEV-01 ...
  title: string
}
export interface Deviation {
  id: string
  defId: string
  title: string
  raisedBy: string
  stage: string
  rationale: string
  approvalLevel: string
  status: 'open' | 'approved' | 'rejected'
}

export interface CovenantDef {
  id: string // COV-01 ...
  title: string
  clearBy: string // stage / tranche gate
}
export interface Covenant {
  id: string
  defId: string
  title: string
  raisedAt: string
  clearBy: string
  status: 'open' | 'cleared' | 'breached'
}

// ---- Tranches (§13.4) ------------------------------------------------------
export type TrancheStatus = 'scheduled' | 'gated' | 'released' | 'remitted'
export type TrancheType =
  | 'Tuition-SWIFT-to-university'
  | 'Living-to-foreign-account-or-forex-card'

export interface TrancheGate {
  label: string
  ref: string // validation / covenant / bucket id
  passed: boolean
}
export interface Tranche {
  id: string
  n: number
  type: TrancheType
  semester: string
  amountUsd: number
  amountInr: number
  fxUsed: number
  gates: TrancheGate[]
  status: TrancheStatus
  a2FemaOnFile: boolean
  pendingChecker?: boolean
  maker?: string
}

// ---- Audit / Comms / Integrations / Notes ----------------------------------
/** v4 (§16.4) — the Glib.money journeys write audit lines too, and the actor is
 *  then a customer, a co-applicant or a security owner rather than a bank role.
 *  The union is widened ADDITIVELY: every RoleId literal in the 14 seed
 *  applications still satisfies `AuditRole`, so they compile untouched. Only the
 *  Audit tab reads this field, and only as display text. */
export type JourneyAuditRole =
  | 'Applicant'
  | 'Co-applicant'
  | 'Collateral provider'
  | 'System'
export type AuditRole = RoleId | JourneyAuditRole

export interface AuditEvent {
  id: string
  ts: string // ISO
  actor: string
  role: AuditRole
  verb: string
  fromStage?: string
  toStage?: string
  reasonCode?: string
  remarks?: string
}

// ---- CRM (§v2 req 1) -------------------------------------------------------
// Channel widened with 'Call'; every CommEvent addition is OPTIONAL so the
// existing seed literals and store verbs keep compiling unchanged.
export type CommChannel = 'SMS' | 'Email' | 'WhatsApp' | 'Call'
export type CommDirection = 'outbound' | 'inbound'
export type CommStatus =
  /** `draft` is §Phase D: the outreach agent WRITES messages, it does not send
   *  them. A draft is inert until an officer approves it through `sendComm`.
   *  Distinct from `queued`, which means it is going out. */
  | 'draft'
  | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied' | 'no_answer'
export type CallOutcome =
  | 'connected' | 'no_answer' | 'busy' | 'wrong_number' | 'callback_requested'

export interface CommEvent {
  id: string
  ts: string
  channel: CommChannel
  templateId: string
  subject: string
  body: string
  auto: boolean
  // --- v2 additions (all optional) ---
  direction?: CommDirection // renderer defaults to 'outbound'
  status?: CommStatus // renderer defaults to 'sent'
  actor?: string // absent ⇒ System
  role?: RoleId
  to?: string // masked destination, e.g. +91-98•••••210
  callOutcome?: CallOutcome
  durationSec?: number
  followUpAt?: string
  ruleId?: string // set when automation fired it
}

export type IntegrationStatus = 'success' | 'failed' | 'pending'
export interface IntegrationCall {
  id: string
  system: string
  purpose: string
  status: IntegrationStatus
  latencyMs: number
  lastAttempt: string
  linkedValidationId?: string // VAL-EXT-xx to re-evaluate on retry
}

export interface Note {
  id: string
  ts: string
  author: string
  role: RoleId
  body: string
  mentions: string[]
}

// ---- Saved filters ---------------------------------------------------------
// v2: `predicate` becomes optional alongside composable `clauses`, so the
// existing SAVED_FILTERS array compiles untouched.
export interface SavedFilter {
  id: string
  label: string
  predicate?: FilterPredicate
  clauses?: FilterClause[]
}
export type FilterPredicate =
  | 'my_queue'
  | 'pending_customer'
  | 'aging_red'
  | 'deviations_open'
  | 'pending_checker'
  | 'sanction_expiring_30'
  | 'band_2'
  | 'tier3_secured'

// ---- Composable filters (§v2 req 9) ----------------------------------------
export type FilterField =
  | 'stage' | 'status' | 'department' | 'officer' | 'branchId' | 'city' | 'region'
  | 'channel' | 'tier' | 'band' | 'blocker' | 'intake' | 'university' | 'program'
  | 'askInr' | 'daysInStage' | 'slaState' | 'outcomeKind' | 'outcomeCode'
  | 'amountBand' | 'hasDeviation' | 'escalated'
export type FilterOp = 'eq' | 'in' | 'gte' | 'lte' | 'between' | 'contains'

export interface FilterClause {
  id: string
  field: FilterField
  op: FilterOp
  value: string | number | boolean | string[] | [number, number]
  label?: string
}

// ---- Maker-checker item ----------------------------------------------------
export interface PendingCheckerItem {
  verb: string // 'stage_approve' | 'final_decision' | 'send_back' | 'release_tranche'
  maker: string
  makerRole: RoleId
  ts: string
  summary: string
  payload?: Record<string, unknown>
}

// ---- University intelligence (§E) ------------------------------------------
//
// What the university-intelligence agent produced for one file. PLAIN DATA
// ONLY — `mutate()` clones every Application through `structuredClone`, so a
// function, a `Date`, a `Map` or a class instance placed on here would throw at
// runtime rather than fail to compile. Strings and numbers, nothing else.

/** One cited source on a brief. A flattened copy of the corpus finding rather
 *  than a reference into it: the brief is a record of what was said at the time
 *  it was fetched, and must not silently change when the corpus is revised. */
export interface UniversityBriefSource {
  /** The corpus's stable slug, e.g. 'mit-funding-federal-research-down-2026'.
   *  Safe to persist, which is why it is carried rather than regenerated. */
  id: string
  category: 'adverse' | 'policy' | 'funding' | 'leadership' | 'faculty' | 'ranking'
  categoryLabel: string
  headline: string
  detail: string
  /** The RESEARCHER's severity, carried through rather than re-derived from the
   *  category. Never 'block' — university news informs a credit view and must
   *  not, on its own, stop a customer's file. */
  level: 'info' | 'attention'
  publisher: string
  /** When the piece was published — not when it was read. */
  publishedIso: string
  url: string
}

export interface UniversityBrief {
  university: string
  programme: string
  /** The PROTOTYPE-clock instant this crawl was stamped (`lib/clock.nowIso()`).
   *  Staleness is measured from here — never from wall time, because the demo
   *  clock is what an operator advances. */
  fetchedAt: string
  /** The stamp this brief replaced, so a re-crawl is legible on screen rather
   *  than merely having happened. Absent on the first fetch. */
  previousFetchedAt?: string
  /** 1 on first fetch, +1 on every re-crawl. Makes a refresh countable. */
  revision: number
  headline: string
  /** The synthesis, one line per paragraph. */
  synthesis: string[]
  sources: UniversityBriefSource[]
  /** THREE states, not two. `thin` means the corpus covers this university and
   *  found it quiet; `absent` means it is not in the corpus at all. An absent
   *  brief must never be read as a clean bill of health. */
  coverage: 'adequate' | 'thin' | 'absent'
  /** The corpus dossier this brief was actually built from, and how it was
   *  reached. Recorded because the three vocabularies naming these institutions
   *  do not agree — and once the corpus covers business schools by benefactor
   *  name ('Ross', 'Tepper'), an officer reading a brief filed under a name that
   *  is not the one on the application is entitled to see why. */
  dossier?: string
  matchedBy: 'exact' | 'token' | 'none'
  /** The corpus's own explanation of what it looked for and did not find,
   *  present when coverage is 'thin'. */
  coverageNote?: string
}

// ---- Agent checks on a document (§Phase F) ---------------------------------
/** What the three-agent swarm found on one uploaded document.
 *
 *  The fraud agent's score and signals used to be computed and dropped: the
 *  customer saw a lane finish, the bank saw nothing. `audience: 'bank'` on the
 *  findings kept the verdict private, which is correct — but private to whom
 *  turned out to be nobody. */
export interface DocumentAgentCheck {
  docId: string
  docLabel: string
  ranAt: string
  /** 0–1. Higher is more concerning. */
  fraudScore: number
  fraudSignals: string[]
  /** Catalogue rules the validation agent ran against this document. */
  validationIds: string[]
  failedValidationIds: string[]
  /** A BLOCK-severity rule failed — a person must look before the file moves. */
  blocking: boolean
}

// ---- Onboarding readiness (§V3) --------------------------------------------
/** Whether a file is complete enough to leave collection and reach Credit.
 *
 *  `ready: false` holds the S05 → S06 exit. The gate is deliberately
 *  OVERRIDABLE — `nonOverridable` is true only for S03 and S08 — so an officer
 *  who disagrees can proceed and the override is audited. A readiness agent
 *  that could strand a file with no human way out would be a worse failure than
 *  the incompleteness it exists to catch. */
export interface OnboardingVerdict {
  ready: boolean
  blockingReasons: string[]
  /** Everything the four lanes concluded, for the console panel. */
  headlines: { agent: string; headline: string }[]
  assessedAt: string
  /** Set when an officer proceeded past a `ready: false` verdict. */
  overriddenBy?: string
  overrideReason?: string
}

// ---- Credit assessment (§V3) ------------------------------------------------
/** What the credit orchestrator concluded — a POSITION for the officer who
 *  decides, never a decision. `finalDecision` and `countersign` remain the only
 *  writes to `app.decision`, guarded by DoA band and maker-checker. */
export interface CreditAssessment {
  position: string
  outsidePolicy: number
  headlines: { agent: string; headline: string }[]
  /** The guardrail's verdict: did the assessment stay independent of whatever
   *  the onboarding orchestrator concluded? Recorded on the file because a
   *  reviewer should not have to take it on trust. */
  independent: boolean
  assessedAt: string
}

// ---- Generated papers (§Phase D) -------------------------------------------
// The checklist `documents` are rows we COLLECT. These are artifacts we
// PRODUCE. Conflating the two would put a paper the bank wrote onto the
// customer's outstanding-items list.
export type GeneratedDocKind =
  | 'cam'
  | 'sanction_letter'
  | 'kfs'
  | 'repayment_schedule'
  | 'covenants_schedule'
  | 'risk_note'

export interface GeneratedSection {
  title: string
  rows: { label: string; value: string }[]
  note?: string
}

export interface GeneratedDoc {
  id: string
  kind: GeneratedDocKind
  title: string
  /** Bank-only papers never render on a customer surface. Same rule the agent
   *  findings follow, for the same reason. */
  audience: 'customer' | 'bank'
  producedAt: string
  sections: GeneratedSection[]
}

// ---- The Application -------------------------------------------------------
export interface Application {
  // header
  appId: string // APP-26xx
  studentName: string
  university: string
  universityShort: string
  program: string
  programLevel: 'Masters' | 'PhD' | 'PG-Diploma'
  programStartDate: string // ISO
  intake: Intake
  channel: Channel
  askInr: number
  tier: Tier
  overlayBasis?: OverlayBasis
  overlayCeilingInr?: number
  // dimensions
  stage: Stage
  status: Status
  owner: Owner
  blocker: Blocker
  // v2 — org + assignment SLA (required; defaulted inside mkApp)
  branchId: string
  assignment: Assignment
  // derived / clocks
  createdAt: string
  stageEnteredAt: string // for days-in-stage + TAT
  stageHistory: { stage: string; enteredAt: string }[]
  sanctionDate?: string
  sanctionExpiryDate?: string
  lastCustomerActivityAt?: string
  // profile switches (§8.1)
  incomeBranch: 'salaried' | 'self_employed'
  nriOverlay: boolean
  securedConstruct: boolean // Tier-3 => C1-C4 present
  // sub-collections
  parties: Party[]
  buckets: DocumentBucket[]
  documents: DocumentItem[]
  /** v3 — consent ledger: which digital-source consents the customer granted. */
  consents: ConsentArtifact[]
  extracted: ExtractedField[]
  validations: ValidationResult[]
  deviations: Deviation[]
  covenants: Covenant[]
  tranches: Tranche[]
  audit: AuditEvent[]
  comms: CommEvent[]
  integrations: IntegrationCall[]
  notes: Note[]
  // decision
  decision?: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'DECLINE' | 'REFER_BACK'
  pendingChecker?: PendingCheckerItem
  rejectionCode?: string
  /** v2: structured closure forensics — only terminal apps carry one. */
  outcome?: Outcome
  // lane progress (for the parallel timeline S03–S09)
  lanes: {
    applicant: LaneNodeStatus[]
    coApplicant: LaneNodeStatus[]
    collateral: LaneNodeStatus[] | null
  }
  // committee flag
  committeePath?: boolean
  /** §E — the university-intelligence brief for this file. OPTIONAL, and it has
   *  to stay that way: the 14 seed literals in `data/seed.ts` are written
   *  by hand and must keep compiling untouched. Per-application rather than
   *  per-university so the 24-hour refresh is per-file. */
  universityBrief?: UniversityBrief
  /** §Phase D — the sanction pack, produced by the seven-agent swarm at
   *  countersign. OPTIONAL, like every other v5 addition, so `data/seed.ts`'s
   *  14 hand-written literals keep compiling untouched. */
  generatedDocs?: GeneratedDoc[]
  /** §Phase F — what the document swarm found, per document. Optional, so the
   *  14 seed literals compile untouched. */
  agentChecks?: DocumentAgentCheck[]
  /** §V3 — the onboarding orchestrator's readiness verdict. This is the one
   *  thing the S05 gate reads. Optional like every other v5+ addition. */
  onboardingVerdict?: OnboardingVerdict
  /** §V3 — the credit orchestrator's position. Optional, like every v5+ field. */
  creditAssessment?: CreditAssessment
}

export type LaneNode = 'kyc' | 'docs' | 'verification' | 'bureau' | 'c1' | 'c2' | 'c3' | 'c4'
export interface LaneNodeStatus {
  node: LaneNode
  label: string
  status: 'not_started' | 'in_progress' | 'completed' | 'failed'
  detail?: string
}

// ============================================================================
// v2 model — org & hierarchy, assignment SLA, escalation, rules/automation,
// and closure forensics.
// ============================================================================

// ---- Org (§v2 req 5, 10) ---------------------------------------------------
export type Region = 'West' | 'North' | 'South' | 'East'

export interface Branch {
  id: string
  name: string
  city: string
  region: Region
}

export interface OfficerRef {
  id: string // 'OFF-OPS-01'
  name: string // must match legacy Owner.officer strings verbatim
  title: string // 'Ops Officer' | 'Ops Team Lead' | 'Head — Operations'
  department: Department
  role: RoleId
  branchId: string
  managerId: string | null
}

// ---- Assignment SLA (§v2 req 10) -------------------------------------------
export type SlaState = 'on_track' | 'due_soon' | 'breached'

export interface Assignment {
  officerId: string
  assignedAt: string // ISO — resets on reassign / moveForward
  slaHours: number // default POLICY.assignmentSlaHours (48)
  escalationLevel: number // 0 = never escalated
  lastEscalatedAt?: string
}

// ---- Escalation (§v2 req 10) -----------------------------------------------
export interface EscalationRung {
  level: number
  afterHours: number
  toTitle: string
}

export interface EscalationEvent {
  id: string
  ts: string
  appId: string
  stage: Stage
  fromOfficerId: string
  toOfficerId: string
  level: number
  reason: string
  hoursOverdue: number
  acknowledgedAt?: string
  resolvedAt?: string
}

// ---- Rules / automation (§v2 req 2) ----------------------------------------
export type RuleConditionField =
  | 'daysInStage'
  | 'hoursSinceAssigned'
  | 'daysSinceCustomerActivity'
  | 'askInr'
  | 'blockerKind'
  | 'status'
  | 'openDeviations'
  | 'docsRequested'
  | 'sanctionDaysLeft'
  | 'nudgeCount'
  | 'failedIntegrations'

export interface RuleCondition {
  field: RuleConditionField
  op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  value: number | string
}

export type RuleActionKind =
  // non-destructive — auto-applied
  | 'nudge' | 'comm' | 'reassign' | 'escalate' | 'flag' | 'request_docs'
  // destructive — queued for officer approval
  | 'hold' | 'close' | 'withdraw' | 'reject'

export interface RuleAction {
  kind: RuleActionKind
  destructive: boolean
  label: string // human summary for the log + approval card
  channel?: CommChannel
  templateId?: string
  toDepartment?: Department
  toTitle?: string // e.g. escalate/reassign to the 'Team Lead'
  escalateLevels?: number
  closureCode?: string
  blockerKind?: BlockerKind
  holdCode?: string
}

export interface StageRule {
  id: string
  stage: Stage | 'ANY'
  name: string
  description: string
  severity: 'info' | 'warn' | 'critical'
  when: RuleCondition[] // ANDed
  then: RuleAction[]
  enabled: boolean
  cooldownDays?: number
}

export type AutomationEventStatus =
  | 'applied' | 'pending_approval' | 'approved' | 'rejected' | 'skipped'

export interface AutomationEvent {
  id: string
  ts: string
  ruleId: string
  ruleName: string
  appId: string
  stage: Stage
  action: RuleAction
  status: AutomationEventStatus
  detail: string
  decidedBy?: string
  decidedByRole?: RoleId
  decidedAt?: string
  decisionNote?: string
}

// ---- Closure forensics (§v2 req 8) -----------------------------------------
/** `disbursed` is §V3. Without a positive class every cohort rate a learning
 *  agent can compute is a rejection rate — "12% of Pune files failed" with no
 *  way to say what the other 88% did, because DISBURSED_ACTIVE carried no
 *  Outcome record at all. A closure is a closure whether or not it went well. */
export type ClosureKind = 'rejected' | 'withdrawn' | 'expired' | 'disbursed'

export interface Outcome {
  kind: ClosureKind
  code: string // REJ-xx | WD-xx | EXP-xx
  label: string
  stageAtClosure: Stage // the S-stage they were IN, not the terminal
  closedAt: string
  decidedBy: string
  decidedByRole: RoleId
  department: Department
  branchId: string
  daysToClosure: number // createdAt → closedAt
  askInr: number // denormalised so reports need not re-walk
  detail?: string
}

// ---- View / tab identifiers ------------------------------------------------
export type TabId =
  | 'pipeline' | 'queues' | 'app360' | 'analytics'
  | 'batches' | 'reports' | 'automation'
export type App360Tab =
  | 'documents'
  | 'extracted'
  | 'validations'
  | 'decision'
  | 'onboarding'
  | 'credit'
  | 'papers'
  | 'covenants'
  | 'tranches'
  | 'comms'
  | 'integrations'
  | 'audit'
  | 'notes'
  | 'peers'
  | 'consents'
  | 'university'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info' | 'warn'
  message: string
}
