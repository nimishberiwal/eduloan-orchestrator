// ============================================================================
// The agent runtime — types (§v5).
//
// ONE IDEA HOLDS THIS TOGETHER: timing is theatre, results are deterministic.
//
// `lib/capture.ts` already established the pattern — quality scores come from a
// hash of the filename so a demo repeats exactly. Agents follow it: every
// agent's FINDINGS are a pure function of its input, computed synchronously and
// up front, while its DURATION is a hash-derived stagger that exists purely so
// a reviewer can watch the work happen in parallel.
//
// That split is what keeps this safe. The application record is never waiting
// on a timer; only the reveal is.
// ============================================================================

/** Every agent in the system. */
export type AgentId =
  // --- the document swarm (§B) ---
  | 'extraction'
  | 'fraud'
  | 'validation'
  // --- the sanction pack (§D) ---
  | 'cam'
  | 'sanction_letter'
  | 'kfs'
  | 'repayment_schedule'
  | 'covenants_schedule'
  | 'risk_note'
  | 'outreach'
  // --- standalone (§E) ---
  | 'university_intel'
  // --- the onboarding orchestrator (§v5) ---
  | 'minimum_data'
  | 'co_applicant_fit'
  | 'decision_sufficiency'
  | 'onboarding_guardrail'
  // --- the credit decisioning orchestrator (§v5) ---
  | 'fresh_assessment'
  | 'geography_cohort'
  | 'college_cohort'
  | 'policy_fit'
  | 'credit_guardrail'
  // --- the disbursement gating orchestrator (§v5) ---
  | 'lrs_aggregate'
  | 'fema_compliance'
  | 'visa_gating'
  | 'fx_band'
  | 'disbursement_guardrail'

export type SwarmKind =
  | 'document'
  | 'sanction'
  | 'university'
  | 'onboarding'
  | 'credit'
  | 'disbursement'

export type LaneStatus = 'queued' | 'running' | 'done' | 'failed'

/** How loudly a finding speaks. `block` means a human must act before the file
 *  moves — it is deliberately rare. */
export type FindingLevel = 'info' | 'attention' | 'block'

/** WHO MAY READ THIS FINDING.
 *
 *  A hard rule expressed in the type system rather than in a comment: a
 *  customer must never read "fraud check: suspicious" about themselves. Every
 *  finding declares its audience, the customer-facing swarm view filters on
 *  `'customer'`, and the console shows everything. A new finding therefore has
 *  to make a deliberate choice — the default is not "everyone". */
export type FindingAudience = 'customer' | 'bank'

export interface AgentFinding {
  id: string
  agent: AgentId
  level: FindingLevel
  audience: FindingAudience
  /** One line. Plain language when the audience is the customer. */
  title: string
  detail: string
  /** What the finding points at, so the UI can link to it. */
  ref?: { kind: 'document' | 'validation' | 'field' | 'party'; id: string }
}

/** One lane of a swarm. `durationMs` and `steps` are presentation only. */
export interface AgentTask {
  id: string
  agent: AgentId
  durationMs: number
  /** Status lines revealed in sequence while the lane runs. */
  steps: string[]
}

export interface AgentRunPlan {
  id: string
  kind: SwarmKind
  appId: string
  tasks: AgentTask[]
}

export interface AgentResult {
  agent: AgentId
  status: 'done' | 'failed'
  /** Shown when the lane completes. One line, past tense. */
  headline: string
  findings: AgentFinding[]
  /** Structured payload for the caller — extracted fields, a generated
   *  document, a university brief. Shape depends on the agent. */
  output?: unknown
}

/** Everything a swarm produced, keyed by agent. */
export type AgentResults = Partial<Record<AgentId, AgentResult>>

/** Live lane state. Ephemeral — this never touches an Application. */
export interface LaneState {
  agent: AgentId
  status: LaneStatus
  /** 0–1. */
  progress: number
  /** Index into `AgentTask.steps` currently showing. */
  stepIndex: number
  result?: AgentResult
}

export interface AgentRunState {
  runId: string
  kind: SwarmKind
  appId: string
  lanes: LaneState[]
  status: 'running' | 'complete'
}
