// ============================================================================
// The customer onboarding orchestrator (§V3) — four agents in parallel.
//
// This is the first swarm that OWNS a phase rather than assisting one. Its only
// job is to get an application complete enough to hand to credit, and it gates
// the S05 → S06 exit — the point at which `defaultDeptForStage` reassigns the
// file from Ops to Credit, which is the handover in the data model.
//
// It is also the first BANK-facing swarm. Every agent here is `internal`, every
// finding is `audience: 'bank'`, and nothing it produces reaches a customer
// screen. A customer sees tasks; a readiness score is not a task.
//
// TWO THINGS THIS MUST NOT DO, and they are the reason the guardrail agent
// exists rather than a comment asking nicely:
//
//   1. `decision_sufficiency` must measure whether the file is DECIDABLE, not
//      whether it would be APPROVED. It is given a view of the application with
//      the decision stripped out, so it cannot fit the mould of an approved
//      loan even if its logic tried to.
//   2. Nothing here may reach a credit conclusion. Sufficiency is "a person
//      could decide on this"; it is never "and the answer is yes".
// ============================================================================
import type { Application, ValidationResult } from '@/types'
import type { AgentFinding, AgentResult } from './types'
import { finding, result } from './runtime'
import { POLICY } from '@/data/policy'
import { peersOf } from '@/lib/groupBy'
import { isTerminalStage } from '@/lib/reports'
import { findUniversity, foirVerdictFor } from '@/lib/eligibility'
import { gateForExit } from '@/data/stages'

// ---- The evidence a cohort claim rests on ----------------------------------
// Borrowed wholesale from the university brief's `coverage` vocabulary, for the
// same reason it exists there: a cohort of three that says "67% of these fail"
// is worse than one that says it does not know. `absent` and `thin` are
// different answers and must not render alike.
export type Evidence = 'adequate' | 'thin' | 'absent'

/** Below this many CLOSED comparable files, a rate is not worth quoting. */
const ADEQUATE_N = 8
const THIN_N = 3

export function evidenceFor(n: number): Evidence {
  if (n >= ADEQUATE_N) return 'adequate'
  if (n >= THIN_N) return 'thin'
  return 'absent'
}

export interface CohortStat {
  n: number
  closed: number
  evidence: Evidence
  /** Share of CLOSED files that ended badly. Null when evidence is absent —
   *  a number here would be read as a rate whatever caveat sits beside it. */
  adverseRatePct: number | null
}

function cohortStat(peers: Application[]): CohortStat {
  const closed = peers.filter((p) => p.outcome)
  const adverse = closed.filter((p) => p.outcome!.kind !== 'disbursed')
  const evidence = evidenceFor(closed.length)
  return {
    n: peers.length,
    closed: closed.length,
    evidence,
    adverseRatePct:
      evidence === 'absent' ? null : Math.round((adverse.length / Math.max(1, closed.length)) * 100),
  }
}

// ---- 1.1 Minimum data ------------------------------------------------------

export interface MinimumDataOutput {
  /** Document labels that comparable files actually had by the time a decision
   *  was reached — the learned bar, not the 97-row checklist. */
  expected: string[]
  missing: string[]
  cohort: CohortStat
  basis: string
}

/** What did files like this one actually have on them when they got a decision?
 *
 *  Deliberately NOT the checklist. The checklist asks for 97 documents; files
 *  reach a credit decision on far fewer, and which fewer depends on the file.
 *  This learns the bar from the population instead of hard-coding one, which is
 *  what was asked for.
 *
 *  It learns from files that got FAR ENOUGH, not from files that got APPROVED —
 *  an important distinction. A file that reached S10 and was declined still
 *  demonstrates what a decidable file looks like. */
export function runMinimumData(app: Application): AgentResult {
  const peers = peersOf(app, PEER_POOL.apps, 'university+program')
  const broader = peers.length >= THIN_N ? peers : peersOf(app, PEER_POOL.apps, 'program')
  const cohort = cohortStat(broader)

  // Files that reached the credit-owned stages, whatever the eventual answer.
  const decided = broader.filter((p) => rank(p) >= 6 || isTerminalStage(p.stage))

  // A document counts toward the learned bar when most decided peers had it
  // settled by then.
  const tally = new Map<string, number>()
  for (const p of decided) {
    for (const d of p.documents) {
      if (d.status === 'requested' || d.status === 'waived') continue
      tally.set(d.label, (tally.get(d.label) ?? 0) + 1)
    }
  }
  const threshold = Math.max(1, Math.round(decided.length * 0.6))
  const expected = [...tally.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([label]) => label)
    .sort()

  const have = new Set(
    app.documents.filter((d) => d.status !== 'requested').map((d) => d.label),
  )
  const missing = expected.filter((label) => !have.has(label))

  const findings: AgentFinding[] = []
  if (cohort.evidence === 'absent') {
    findings.push(
      finding(
        'minimum_data',
        'info',
        'bank',
        'No comparable closed files to learn from',
        `${cohort.n} file(s) match this university and programme and ${cohort.closed} have closed. The bar below is the checklist's, not a learned one.`,
      ),
    )
  } else if (missing.length > 0) {
    findings.push(
      finding(
        'minimum_data',
        'attention',
        'bank',
        `${missing.length} item(s) comparable files had by this point`,
        missing.slice(0, 6).join(' · '),
      ),
    )
  }

  return result(
    'minimum_data',
    cohort.evidence === 'absent'
      ? 'No learned bar — too few comparable files'
      : `${expected.length} expected, ${missing.length} outstanding · from ${decided.length} comparable file(s)`,
    findings,
    {
      expected,
      missing,
      cohort,
      basis:
        peers.length >= THIN_N
          ? `${app.universityShort} · ${app.program}`
          : `${app.program}, any university`,
    } satisfies MinimumDataOutput,
  )
}

// ---- 1.2 Co-applicant fit --------------------------------------------------

export interface CoApplicantOutput {
  hasCoApplicant: boolean
  /** True when the file would be better off without this co-applicant. */
  dragging: boolean
  foirWith: number | null
  foirWithout: number | null
  recommendation: 'none' | 'add_one' | 'review_existing'
  cohort: CohortStat
}

/** Two questions, not one: does this file need another co-applicant, and is the
 *  one it has making things worse?
 *
 *  The second is computable rather than guessed. FOIR is the co-applicant's
 *  obligations over their income; a co-applicant whose existing EMIs outweigh
 *  what they add is arithmetically a drag, and the file's own recorded FOIR
 *  says so. */
export function runCoApplicantFit(app: Application): AgentResult {
  const co = app.parties.find((p) => p.role === 'co_applicant')
  const foirRow = app.extracted.find((f) => f.label === 'foir_post_moratorium_pct')
  const foirWith = foirRow ? Number(foirRow.extractedValue) || null : null
  const verdict = foirWith === null ? null : foirVerdictFor(foirWith)

  const peers = peersOf(app, PEER_POOL.apps, 'university+program')
  const cohort = cohortStat(peers)

  // A co-applicant is dragging when the file's FOIR is in or past the deviation
  // band. That is not a character judgement — it is the ratio the policy uses.
  const dragging = verdict === 'block'
  const recommendation: CoApplicantOutput['recommendation'] = !co
    ? 'add_one'
    : dragging
      ? 'review_existing'
      : 'none'

  const findings: AgentFinding[] = []
  if (!co) {
    findings.push(
      finding(
        'co_applicant_fit',
        'attention',
        'bank',
        'No co-applicant on the file',
        'This product assesses a parent’s income; the borrower has none. A file cannot reach a decision without one.',
        { kind: 'party', id: app.appId },
      ),
    )
  } else if (dragging) {
    findings.push(
      finding(
        'co_applicant_fit',
        'attention',
        'bank',
        'The co-applicant’s obligations exceed what the policy allows',
        `Post-moratorium FOIR is ${foirWith}%, past the ${POLICY.foirPolicy.postMoratoriumDeviationMax}% ceiling. A second earning co-applicant, or a smaller ask, is what moves this — not more documents from the same person.`,
        { kind: 'party', id: co.id },
      ),
    )
  } else if (verdict === 'deviation') {
    findings.push(
      finding(
        'co_applicant_fit',
        'info',
        'bank',
        'FOIR sits in the deviation band',
        `${foirWith}% is above ${POLICY.foirPolicy.postMoratoriumPassMax}% but within ${POLICY.foirPolicy.postMoratoriumDeviationMax}%. Decidable, with a deviation.`,
        { kind: 'party', id: co.id },
      ),
    )
  }

  return result(
    'co_applicant_fit',
    !co ? 'No co-applicant — the file cannot be decided as it stands'
    : dragging ? 'The co-applicant on file does not carry this ask'
    : 'Co-applicant supports the ask',
    findings,
    {
      hasCoApplicant: Boolean(co),
      dragging,
      foirWith,
      foirWithout: null,
      recommendation,
      cohort,
    } satisfies CoApplicantOutput,
  )
}

// ---- 1.3 Decision sufficiency — the anti-goal agent ------------------------

/** The application WITHOUT anything that says how it turned out.
 *
 *  This is the enforcement, not a convention. `decision_sufficiency` is handed
 *  one of these, so it cannot shape its answer to fit an approved file — it
 *  cannot see whether one was approved. The guardrail agent proves the property
 *  by running it against the same file with the decision forced both ways and
 *  requiring byte-identical output. */
export type SufficiencyView = Omit<
  Application,
  'decision' | 'rejectionCode' | 'outcome' | 'pendingChecker'
>

export function sufficiencyView(app: Application): SufficiencyView {
  const { decision: _d, rejectionCode: _r, outcome: _o, pendingChecker: _p, ...rest } = app
  void _d
  void _r
  void _o
  void _p
  return rest
}

export interface SufficiencyOutput {
  decidable: boolean
  /** Rules a decision at S06 would rest on, split three ways. The middle one is
   *  the whole point: `evaluateGate` cannot see it. */
  answered: string[]
  unanswered: string[]
  notApplicable: string[]
  openQuestions: string[]
}

/** Can a credit officer reach a decision on what is on this file?
 *
 *  NOT "would they approve it". The distinction is the agent's entire reason to
 *  exist, and it fills a real hole: `isResolved` in lib/gating.ts treats a rule
 *  that is ABSENT from the application as resolved —
 *
 *      if (!r) return true // rule not applicable to this app => treated as resolved
 *
 *  — so today a file missing every one of its checks passes the gate as
 *  cleanly as a file that answered them all. Absence and applicability are
 *  indistinguishable to the gate. Telling them apart is this agent's job. */
export function runDecisionSufficiency(view: SufficiencyView): AgentResult {
  // What a decision at the next Credit-owned stage would rest on.
  const spec = gateForExit('S06')
  const required = spec?.requiredValidations ?? []

  const byId = new Map<string, ValidationResult>(
    view.validations.map((v) => [v.catalogueId, v]),
  )

  const answered: string[] = []
  const unanswered: string[] = []
  const notApplicable: string[] = []

  for (const id of required) {
    const r = byId.get(id)
    if (!r) {
      // The gate calls this resolved. It is not — nobody has looked.
      unanswered.push(id)
      continue
    }
    if (r.status === 'pending') unanswered.push(id)
    else if (r.status === 'waived') notApplicable.push(id)
    else answered.push(id)
  }

  const openQuestions: string[] = []
  if (!view.parties.some((p) => p.role === 'co_applicant')) {
    openQuestions.push('No co-applicant is on the file')
  }
  if (!view.parties.find((p) => p.role === 'co_applicant')?.bureauScore) {
    openQuestions.push('No bureau score for the co-applicant')
  }
  if (!view.extracted.some((f) => f.label === 'foir_post_moratorium_pct')) {
    openQuestions.push('No FOIR on file')
  }
  if (view.securedConstruct && !view.buckets.some((b) => b.section === 'collateral')) {
    openQuestions.push('Secured construct with no collateral documents requested')
  }
  if (!findUniversity(view.university)) {
    openQuestions.push('University is not on the lender’s list')
  }

  const decidable = unanswered.length === 0 && openQuestions.length === 0

  const findings: AgentFinding[] = []
  if (unanswered.length > 0) {
    findings.push(
      finding(
        'decision_sufficiency',
        'block',
        'bank',
        `${unanswered.length} check(s) nobody has answered`,
        `${unanswered.join(', ')}. These are absent from the file rather than resolved — the forward gate reads absence as a pass.`,
      ),
    )
  }
  for (const q of openQuestions) {
    findings.push(
      finding('decision_sufficiency', 'attention', 'bank', 'A decision would rest on this', q),
    )
  }

  return result(
    'decision_sufficiency',
    decidable
      ? 'A credit officer could reach a decision on this file'
      : `Not yet decidable — ${unanswered.length} unanswered, ${openQuestions.length} open question(s)`,
    findings,
    { decidable, answered, unanswered, notApplicable, openQuestions } satisfies SufficiencyOutput,
  )
}

// ---- 1.4 Guardrail ---------------------------------------------------------

export interface GuardrailOutput {
  deterministic: boolean
  /** Sufficiency did not move when the decision was forced APPROVE / DECLINE. */
  sufficiencyIndependentOfOutcome: boolean
  /** No finding reached a credit conclusion. */
  noCreditSpillover: boolean
  /** No finding is addressed to a customer. */
  noCustomerAudience: boolean
  offences: string[]
}

/** A credit CONCLUSION, not credit vocabulary.
 *
 *  Onboarding may say "a decision would rest on the bureau score"; it may not
 *  say "the bureau score is too low" — that is credit's call, and handing over
 *  a view already formed is exactly the leakage the credit orchestrator is
 *  later built to refuse.
 *
 *  The first version of this pattern matched the bare words approve / decline /
 *  sanction, and immediately failed four real files on the document label
 *  "Approved / sanction plan (BBMP / DDA / equivalent)" — a building-plan
 *  approval for property collateral. That is not a credit conclusion, and the
 *  consequence of getting it wrong is not cosmetic: a guardrail breach makes
 *  `verdictFrom` hold the file, so a false positive here blocks a handover.
 *  It matches asserted verdicts and identifiers only. */
const CREDIT_CONCLUSION =
  /\b(REJ|DEV)-\d+\b|\b(recommend|recommending|propose|should be|ought to be)\s+(approv|declin|reject|sanction)/i
const CREDITWORTHINESS = /\b(not |un)creditworthy\b|\bcredit(-| )worthiness (is|assessed)\b|\beligible for ₹/i

export function runOnboardingGuardrail(app: Application): AgentResult {
  const offences: string[] = []

  // Determinism — the same file twice.
  const a = strip(runMinimumData(app), runCoApplicantFit(app), runDecisionSufficiency(sufficiencyView(app)))
  const b = strip(runMinimumData(app), runCoApplicantFit(app), runDecisionSufficiency(sufficiencyView(app)))
  const deterministic = a === b
  if (!deterministic) offences.push('the three agents did not return the same answer twice')

  // Sufficiency must not move with the outcome. This is the test that makes the
  // anti-goal real rather than aspirational.
  const base = JSON.stringify(runDecisionSufficiency(sufficiencyView(app)).output)
  const asApproved = JSON.stringify(
    runDecisionSufficiency(sufficiencyView({ ...app, decision: 'APPROVE' })).output,
  )
  const asDeclined = JSON.stringify(
    runDecisionSufficiency(
      sufficiencyView({ ...app, decision: 'DECLINE', rejectionCode: 'REJ-01' }),
    ).output,
  )
  const sufficiencyIndependentOfOutcome = base === asApproved && base === asDeclined
  if (!sufficiencyIndependentOfOutcome) {
    offences.push('sufficiency changed when the decision changed — it is fitting the mould')
  }

  // Scope: nothing may reach a credit conclusion, and nothing may address a
  // customer.
  const all = [runMinimumData(app), runCoApplicantFit(app), runDecisionSufficiency(sufficiencyView(app))]
  const findings = all.flatMap((r) => r.findings)
  const spillover = findings.filter((f) => {
    const text = `${f.title} ${f.detail}`
    return CREDIT_CONCLUSION.test(text) || CREDITWORTHINESS.test(text)
  })
  const noCreditSpillover = spillover.length === 0
  for (const f of spillover) offences.push(`credit conclusion in a finding: "${f.title}"`)

  const customerFacing = findings.filter((f) => f.audience !== 'bank')
  const noCustomerAudience = customerFacing.length === 0
  for (const f of customerFacing) offences.push(`finding addressed to a customer: "${f.title}"`)

  const clean =
    deterministic && sufficiencyIndependentOfOutcome && noCreditSpillover && noCustomerAudience

  return result(
    'onboarding_guardrail',
    clean ? 'All three stayed in scope' : `${offences.length} scope breach(es)`,
    clean
      ? []
      : offences.map((o) =>
          finding('onboarding_guardrail', 'block', 'bank', 'Scope breach', o),
        ),
    {
      deterministic,
      sufficiencyIndependentOfOutcome,
      noCreditSpillover,
      noCustomerAudience,
      offences,
    } satisfies GuardrailOutput,
  )
}

/** Findings carry a module-counter id that is expected to advance between runs,
 *  so determinism is compared on everything else — the same `strip` the
 *  document harness uses. */
function strip(...results: AgentResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      agent: r.agent,
      headline: r.headline,
      output: r.output,
      findings: r.findings.map((f) => [f.agent, f.level, f.audience, f.title, f.detail]),
    })),
  )
}

// ---- The whole swarm -------------------------------------------------------

/** The population the cohort agents learn from.
 *
 *  A module-level handle rather than a parameter on every agent, because the
 *  swarm's signature has to match the other two (`runDocumentSwarm`,
 *  `runSanctionSwarm`) and those take only what they act on. Set once by the
 *  caller before the swarm runs. */
export const PEER_POOL: { apps: Application[] } = { apps: [] }

function rank(app: Application): number {
  const m = /^S(\d\d)$/.exec(String(app.stage))
  return m ? parseInt(m[1], 10) : 99
}

export interface OnboardingVerdictOutput {
  ready: boolean
  blockingReasons: string[]
}

export function runOnboardingSwarm(
  app: Application,
  population: Application[],
): Record<string, AgentResult> {
  PEER_POOL.apps = population
  return {
    minimum_data: runMinimumData(app),
    co_applicant_fit: runCoApplicantFit(app),
    decision_sufficiency: runDecisionSufficiency(sufficiencyView(app)),
    onboarding_guardrail: runOnboardingGuardrail(app),
  }
}

/** The one thing the gate reads.
 *
 *  Only `decision_sufficiency` can hold a file. The other two advise: a thin
 *  cohort or a co-applicant worth reviewing is worth an officer's eye, but
 *  neither is a reason to refuse the handover — and a gate that fires on advice
 *  is a gate people learn to override. */
export function verdictFrom(results: Record<string, AgentResult>): OnboardingVerdictOutput {
  const suff = results.decision_sufficiency?.output as SufficiencyOutput | undefined
  const guard = results.onboarding_guardrail?.output as GuardrailOutput | undefined
  const blockingReasons: string[] = []

  if (suff && !suff.decidable) {
    if (suff.unanswered.length > 0) {
      blockingReasons.push(`${suff.unanswered.length} check(s) nobody has answered`)
    }
    for (const q of suff.openQuestions) blockingReasons.push(q)
  }
  // A guardrail breach means the orchestrator itself is not behaving. It must
  // not then be trusted to clear a file.
  if (guard && guard.offences.length > 0) {
    blockingReasons.push('The onboarding agents failed their own scope check')
  }

  return { ready: blockingReasons.length === 0, blockingReasons }
}
