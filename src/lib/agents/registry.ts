// ============================================================================
// The agent catalogue (§v5).
//
// One entry per agent: what it is called, what it does in one line a customer
// could read, which swarm it belongs to, and how much work it represents.
//
// `weight` is the ONLY input to how long a lane appears to take. Heavier agents
// finish later, which is what makes a swarm look like parallel work rather than
// a progress bar with three heads. It has no other meaning.
// ============================================================================
import type { AgentId, SwarmKind } from './types'

export interface AgentDef {
  id: AgentId
  /** Display name. Short — it sits in a lane header. */
  name: string
  /** What this agent does, in the customer's language. */
  what: string
  swarm: SwarmKind
  /** Relative work. Drives the duration spread, nothing else. */
  weight: number
  /** Bank-only agents are never named on a customer surface. */
  internal?: boolean
}

export const AGENTS: AgentDef[] = [
  // --- document swarm ------------------------------------------------------
  {
    id: 'extraction',
    name: 'Reading your document',
    what: 'Pulls the details off the page so you don’t have to type them',
    swarm: 'document',
    weight: 1,
  },
  {
    id: 'fraud',
    name: 'Checking it’s genuine',
    what: 'Looks for signs the document has been altered or doesn’t belong here',
    swarm: 'document',
    weight: 1.35,
  },
  {
    id: 'validation',
    name: 'Cross-checking the details',
    what: 'Compares what it says against everything else on your file',
    swarm: 'document',
    weight: 1.7,
  },

  // --- sanction pack -------------------------------------------------------
  {
    id: 'cam',
    name: 'Credit assessment memo',
    what: 'Assembles the credit file for the approving officer',
    swarm: 'sanction',
    weight: 1.9,
    internal: true,
  },
  {
    id: 'sanction_letter',
    name: 'Sanction letter',
    what: 'Writes the formal offer',
    swarm: 'sanction',
    weight: 1.2,
  },
  {
    id: 'kfs',
    name: 'Key Facts Statement',
    what: 'Sets out the all-in cost in the prescribed format',
    swarm: 'sanction',
    weight: 1.45,
  },
  {
    id: 'repayment_schedule',
    name: 'Repayment schedule',
    what: 'Works out what you pay and when, including the study period',
    swarm: 'sanction',
    weight: 1.6,
  },
  {
    id: 'covenants_schedule',
    name: 'Conditions schedule',
    what: 'Lists every condition attached to the offer and when it must be met',
    swarm: 'sanction',
    weight: 1,
  },
  {
    id: 'risk_note',
    name: 'Risk note',
    what: 'Summarises deviations and the approval authority for the credit file',
    swarm: 'sanction',
    weight: 1.75,
    internal: true,
  },
  {
    id: 'outreach',
    name: 'Your offer message',
    what: 'Drafts what we’ll send you about the offer',
    swarm: 'sanction',
    weight: 1.3,
  },

  // --- the onboarding orchestrator (§v5) ------------------------------------
  // All four are `internal`. This orchestrator is bank work: it decides whether
  // a file is ready to leave collection, which is not a question the customer
  // is being asked. They see tasks, never a readiness score.
  {
    id: 'minimum_data',
    name: 'Minimum data',
    what: 'Works out what this file actually needs, from what comparable files needed',
    swarm: 'onboarding',
    weight: 1.5,
    internal: true,
  },
  {
    id: 'co_applicant_fit',
    name: 'Co-applicant fit',
    what: 'Whether another co-applicant is needed, or the current one is holding the file back',
    swarm: 'onboarding',
    weight: 1.8,
    internal: true,
  },
  {
    id: 'decision_sufficiency',
    name: 'Enough to decide on',
    what: 'Whether a credit officer could reach a decision on what is on file',
    swarm: 'onboarding',
    weight: 1.25,
    internal: true,
  },
  {
    id: 'onboarding_guardrail',
    name: 'Scope check',
    what: 'Checks the other three stayed inside their remit and out of credit\u2019s',
    swarm: 'onboarding',
    weight: 1,
    internal: true,
  },

  // --- the credit decisioning orchestrator (§v5) ----------------------------
  {
    id: 'fresh_assessment',
    name: 'Fresh assessment',
    what: 'Reads the file from raw data, with nothing the sales side concluded',
    swarm: 'credit',
    weight: 1.7,
    internal: true,
  },
  {
    id: 'geography_cohort',
    name: 'Geography history',
    what: 'How files from this location have fared with this lender',
    swarm: 'credit',
    weight: 1.35,
    internal: true,
  },
  {
    id: 'college_cohort',
    name: 'College and course history',
    what: 'How files for this institution and programme have fared',
    swarm: 'credit',
    weight: 1.5,
    internal: true,
  },
  {
    id: 'policy_fit',
    name: 'Policy fit',
    what: 'Applies the lender’s parameters against this file’s own facts',
    swarm: 'credit',
    weight: 1.9,
    internal: true,
  },
  {
    id: 'credit_guardrail',
    name: 'Independence check',
    what: 'Proves the assessment did not read anything the sales side concluded',
    swarm: 'credit',
    weight: 1.1,
    internal: true,
  },

  // --- the disbursement gating orchestrator (§v5) ---------------------------
  // All five are `internal`. The customer REQUESTS a tranche and is told it is
  // queued; they are never shown the reasons money is being held, because two
  // of those reasons are statutory limits they cannot act on.
  {
    id: 'lrs_aggregate',
    name: 'LRS headroom',
    what: 'Adds every remittance on the file together and checks the year\u2019s cap',
    swarm: 'disbursement',
    weight: 1.6,
    internal: true,
  },
  {
    id: 'fema_compliance',
    name: 'FEMA paperwork',
    what: 'Form A2 and the FEMA declaration, the stated purpose and who is being paid',
    swarm: 'disbursement',
    weight: 1.2,
    internal: true,
  },
  {
    id: 'visa_gating',
    name: 'Visa sequencing',
    what: 'Whether the visa is endorsed, and which tranches that releases',
    swarm: 'disbursement',
    weight: 1.35,
    internal: true,
  },
  {
    id: 'fx_band',
    name: 'Rate check',
    what: 'The rate used against the reference rate, and the rupee figure it produces',
    swarm: 'disbursement',
    weight: 1.1,
    internal: true,
  },
  {
    id: 'disbursement_guardrail',
    name: 'Release check',
    what: 'Checks the other four only measured, and could not have moved money',
    swarm: 'disbursement',
    weight: 1,
    internal: true,
  },

  // --- standalone ----------------------------------------------------------
  {
    id: 'university_intel',
    name: 'University research',
    what: 'Reads recent news about the university and summarises what matters',
    swarm: 'university',
    weight: 2,
    internal: true,
  },
]

export const AGENT_BY_ID: Record<AgentId, AgentDef> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a]),
) as Record<AgentId, AgentDef>

export function agentsOf(swarm: SwarmKind): AgentDef[] {
  return AGENTS.filter((a) => a.swarm === swarm)
}

/** `internal` hides an agent's LANE from customer surfaces — the CAM, the risk
 *  note and the university crawl are bank work and a customer has no reason to
 *  watch them run.
 *
 *  The fraud agent is deliberately NOT internal. A customer seeing "Checking
 *  it's genuine" run alongside the other two is honest and reassuring, and it is
 *  what was asked for. The rule that matters is about its OUTPUT: findings carry
 *  `audience`, and a customer never reads a fraud finding about themselves —
 *  they read "Received, we're checking a couple of things". Lane visible,
 *  verdict private. */
export function isInternalAgent(id: AgentId): boolean {
  return AGENT_BY_ID[id]?.internal === true
}
