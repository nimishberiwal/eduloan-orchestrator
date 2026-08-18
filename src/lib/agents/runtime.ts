// ============================================================================
// The agent runtime (§v5) — planning and the deterministic stagger.
//
// Pure. No React, no store, no timers. This module decides WHAT the lanes are
// and HOW LONG each should appear to take; `store/agentStore.ts` does the
// counting, and the per-agent modules compute the findings.
// ============================================================================
import type { AgentDef } from './registry'
import { AGENT_BY_ID, agentsOf, isInternalAgent } from './registry'
import type {
  AgentFinding,
  AgentId,
  AgentResult,
  AgentResults,
  AgentRunPlan,
  AgentTask,
  FindingAudience,
  SwarmKind,
} from './types'

// ---- Deterministic draw ----------------------------------------------------
// Same FNV-1a shape as lib/capture.ts, for the same reason: a demo has to
// repeat exactly, on every machine, every time.

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Stable 0–1 from a seed and a channel name. */
export function draw(seed: string, channel: string): number {
  return (hash(`${seed}::${channel}`) % 1000) / 1000
}

// ---- Timing ----------------------------------------------------------------
//
// The whole point of the stagger is that a reviewer SEES parallelism: three
// lanes that all finish together look like one task with three labels. So the
// spread between first and last completion matters more than the total.

/** Floor for the fastest lane. Below this the work reads as fake. */
const BASE_MS = 900
/** How much each unit of `weight` adds. */
const PER_WEIGHT_MS = 620
/** Deterministic jitter, ± this, so two runs of the same swarm on different
 *  files don't look identical. */
const JITTER_MS = 420
/** The guarantee: consecutive lanes finish at least this far apart.
 *
 *  Weight alone is NOT enough. The adjacent document agents differ by 0.35
 *  weight — about 217ms — and ±420ms of jitter swallows that whole. The
 *  `/__dev/agents` harness caught it immediately: 3 of 14 swarms finished
 *  within 50ms of each other, which reads as one task with three labels rather
 *  than as parallel work. So the spread is enforced by construction below
 *  instead of being left to hope that the constants line up. */
const MIN_STAGGER_MS = 320

export function durationFor(def: AgentDef, seed: string): number {
  const jitter = (draw(seed, `dur:${def.id}`) - 0.5) * 2 * JITTER_MS
  return Math.round(BASE_MS + def.weight * PER_WEIGHT_MS + jitter)
}

/** Push durations apart so no two lanes land on top of each other. Preserves
 *  the jittered ORDER — only the gaps are widened. */
function enforceStagger(durations: number[]): number[] {
  const order = durations.map((ms, i) => ({ ms, i })).sort((a, b) => a.ms - b.ms)
  let prev = -Infinity
  for (const item of order) {
    if (item.ms < prev + MIN_STAGGER_MS) item.ms = prev + MIN_STAGGER_MS
    prev = item.ms
  }
  const out = durations.slice()
  for (const item of order) out[item.i] = Math.round(item.ms)
  return out
}

/** Status lines for a lane, revealed in sequence. Deliberately concrete — "Reading
 *  page 1 of 2" tells a reviewer more than "Processing…". */
const STEPS: Record<AgentId, string[]> = {
  lrs_aggregate: [
    'Reading every tranche on the schedule',
    'Adding the student and the parent together',
    'Placing them in the financial year',
    'Measuring what is left under the cap',
  ],
  fema_compliance: [
    'Looking for Form A2 on each tranche',
    'Reading the declared purpose',
    'Checking who is being paid',
    'Recording what is missing',
  ],
  visa_gating: [
    'Reading the endorsement status',
    'Separating tuition from living tranches',
    'Applying the sequencing rule',
    'Recording which tranches that releases',
  ],
  fx_band: [
    'Reading the rate used on each tranche',
    'Comparing it with the reference rate',
    'Recomputing the rupee figure',
    'Recording anything outside the band',
  ],
  disbursement_guardrail: [
    'Running the four checks twice',
    'Comparing the two runs',
    'Checking the file was not written to',
    'Testing the cap against a per-tranche view',
  ],
  fresh_assessment: [
    'Taking the file without the sales view',
    'Reading the parties and the ask',
    'Reading what has actually been verified',
    'Forming a position',
  ],
  geography_cohort: [
    'Finding files from this location',
    'Reading how they closed',
    'Weighing how much evidence that is',
    'Recording the pattern',
  ],
  college_cohort: [
    'Finding files for this institution',
    'Narrowing to this programme',
    'Reading how they closed',
    'Recording the pattern',
  ],
  policy_fit: [
    'Loading the lender’s parameters',
    'Reading this file’s own figures',
    'Testing each parameter against them',
    'Listing what sits outside policy',
  ],
  credit_guardrail: [
    'Running the assessment as given',
    'Running it again with the sales view removed',
    'Comparing the two',
    'Checking nothing was written back',
  ],
  minimum_data: [
    'Finding files like this one',
    'Reading what they had when a decision was reached',
    'Setting the bar for this file',
    'Comparing what is on file against it',
  ],
  co_applicant_fit: [
    'Reading the co-applicant on file',
    'Re-running the eligibility without them',
    'Re-running it with them',
    'Comparing the two',
  ],
  decision_sufficiency: [
    'Listing what a decision would rest on',
    'Separating not-applicable from never-collected',
    'Checking each has an answer',
    'Judging whether a decision is possible',
  ],
  onboarding_guardrail: [
    'Re-running the other three',
    'Checking their answers did not move',
    'Checking none of them reached into credit',
    'Checking none of them reached the customer',
  ],
  extraction: [
    'Opening the file',
    'Finding the text on the page',
    'Picking out the details that matter',
    'Tidying up the values',
  ],
  fraud: [
    'Checking the file hasn’t been edited',
    'Comparing it against the layout we expect',
    'Checking the names against our lists',
    'Scoring the result',
  ],
  validation: [
    'Loading the checks for this document',
    'Comparing against what’s already on file',
    'Checking dates and amounts line up',
    'Recording the outcome',
  ],
  cam: [
    'Pulling the credit file together',
    'Working out the income position',
    'Summarising the university and programme',
    'Laying out the recommendation',
  ],
  sanction_letter: [
    'Reading the approved terms',
    'Setting out the amount and rate',
    'Adding the conditions',
    'Formatting the letter',
  ],
  kfs: [
    'Collecting every charge',
    'Working out the all-in cost',
    'Writing it in the prescribed format',
  ],
  repayment_schedule: [
    'Reading the moratorium terms',
    'Working out the study-period interest',
    'Building the instalment table',
    'Checking the totals',
  ],
  covenants_schedule: ['Reading the conditions', 'Setting a deadline against each one'],
  risk_note: [
    'Listing the deviations raised',
    'Checking the approval authority',
    'Noting the security position',
    'Writing the summary',
  ],
  outreach: [
    'Reading the offer',
    'Drafting the email',
    'Drafting the text message',
    'Checking the tone',
  ],
  university_intel: [
    'Searching recent coverage',
    'Reading what came back',
    'Discarding anything irrelevant',
    'Weighing the findings',
    'Writing the summary',
  ],
}

// ---- Planning --------------------------------------------------------------

/** Build the lane plan for a swarm.
 *
 *  `forCustomer` drops internal lanes — a customer watching their document
 *  process should not see "Credit assessment memo" scroll past. */
export function planRun(
  kind: SwarmKind,
  appId: string,
  seed: string,
  opts: { forCustomer?: boolean; only?: AgentId[] } = {},
): AgentRunPlan {
  let defs = agentsOf(kind)
  if (opts.only) defs = defs.filter((d) => opts.only!.includes(d.id))
  if (opts.forCustomer) defs = defs.filter((d) => !isInternalAgent(d.id))

  const staggered = enforceStagger(defs.map((def) => durationFor(def, seed)))

  const tasks: AgentTask[] = defs.map((def, i) => ({
    id: `${appId}:${def.id}:${hash(seed) % 100000}`,
    agent: def.id,
    durationMs: staggered[i],
    steps: STEPS[def.id] ?? ['Working'],
  }))

  return {
    id: `RUN-${hash(`${kind}:${appId}:${seed}`) % 1000000}`,
    kind,
    appId,
    tasks,
  }
}

/** Longest lane — how long the whole swarm appears to take. */
export function runDuration(plan: AgentRunPlan): number {
  return plan.tasks.reduce((m, t) => Math.max(m, t.durationMs), 0)
}

// ---- Findings --------------------------------------------------------------

let _findingSeq = 0
export function resetFindingSeq(): void {
  _findingSeq = 0
}

export function finding(
  agent: AgentId,
  level: AgentFinding['level'],
  audience: FindingAudience,
  title: string,
  detail: string,
  ref?: AgentFinding['ref'],
): AgentFinding {
  _findingSeq += 1
  return { id: `AF-${String(_findingSeq).padStart(5, '0')}`, agent, level, audience, title, detail, ref }
}

export function result(
  agent: AgentId,
  headline: string,
  findings: AgentFinding[] = [],
  output?: unknown,
): AgentResult {
  return { agent, status: 'done', headline, findings, output }
}

// ---- Reading results -------------------------------------------------------

/** Findings this audience may read. The customer-facing swarm view calls this;
 *  the console does not filter. */
export function findingsFor(results: AgentResults, audience: FindingAudience): AgentFinding[] {
  return Object.values(results)
    .filter((r): r is AgentResult => Boolean(r))
    .flatMap((r) => r.findings)
    .filter((f) => f.audience === audience)
}

/** Does anything in this run need a human before the file moves? */
export function hasBlocking(results: AgentResults): boolean {
  return findingsFor(results, 'bank').some((f) => f.level === 'block')
}

/** The neutral line a customer sees when the bank-side findings are non-empty.
 *  They are never told WHAT was flagged — only that a person will look. */
export function customerSummary(results: AgentResults): string {
  const bank = findingsFor(results, 'bank')
  const attention = bank.filter((f) => f.level !== 'info').length
  if (attention === 0) return 'All done — everything checked out.'
  return 'Received. Someone will take a quick look at one or two things.'
}

export { AGENT_BY_ID }
