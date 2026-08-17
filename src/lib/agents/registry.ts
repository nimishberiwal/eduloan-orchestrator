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
