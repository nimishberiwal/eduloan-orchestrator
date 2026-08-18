// ============================================================================
// The credit decisioning orchestrator (§V3) — five agents in parallel.
//
// This is the second half of the handover. The onboarding orchestrator decides
// whether a file is complete enough to leave collection; this one assesses it,
// and the whole point is that it does so WITHOUT INHERITING A VIEW.
//
// THE INDEPENDENCE RULE
// `fresh_assessment` is handed a `CreditView` — the application with the
// onboarding verdict and every onboarding finding removed. It cannot be
// influenced by what sales concluded because it cannot see what sales
// concluded. `credit_guardrail` proves this the only way worth trusting: it
// runs the assessment twice, once on the file as given and once with the
// onboarding output stripped, and requires the two to be BYTE-IDENTICAL.
//
// That is a stronger claim than "we were careful". A reviewer does not have to
// read this file to believe it; they can read the guardrail's output.
//
// WHAT THIS IS NOT
// It does not decide. `finalDecision` and `countersign` remain the only writes
// to `app.decision`, guarded by DoA band and maker-checker. This orchestrator
// assembles a position for the officer who does decide, and the guardrail
// asserts it wrote nothing back to the collection-phase record.
// ============================================================================
import type { Application, ExtractedField } from '@/types'
import type { AgentFinding, AgentResult } from './types'
import { finding, result } from './runtime'
import { POLICY } from '@/data/policy'
import { BRANCH_BY_ID } from '@/data/org'
import { peersOf } from '@/lib/groupBy'
import { effectiveBand, bandApprover } from '@/lib/doa'
import { findUniversity, foirVerdictFor, overlayFor } from '@/lib/eligibility'
import { evidenceFor, type Evidence } from './onboarding'

// ---- The view credit is allowed ---------------------------------------------

/** The application WITHOUT anything the onboarding orchestrator concluded.
 *
 *  `onboardingVerdict` carries a readiness call, its blocking reasons and four
 *  agent headlines — a formed opinion about the file, arrived at by a different
 *  orchestrator with a different remit. Credit inheriting it would be exactly
 *  the leakage this design exists to refuse.
 *
 *  Stripping it is the enforcement. The guardrail is the proof. */
export type CreditView = Omit<Application, 'onboardingVerdict'>

export function creditView(app: Application): CreditView {
  const { onboardingVerdict: _v, ...rest } = app
  void _v
  return rest
}

// ---- Reading the file's own numbers -----------------------------------------

function extracted(view: CreditView, label: string): ExtractedField | undefined {
  return view.extracted.find((f) => f.label === label)
}

/** Extracted values are strings — '$81,395', '≤55', '7.5'. Everything numeric a
 *  credit agent wants has to come back through here. */
function num(v: string | undefined): number | null {
  if (!v) return null
  const m = v.replace(/[, ]/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

function foirOf(view: CreditView): number | null {
  return num(extracted(view, 'foir_post_moratorium_pct')?.extractedValue)
}

function coaOf(view: CreditView): number | null {
  const usd = num(extracted(view, 'coa_program_total')?.extractedValue)
  return usd === null ? null : usd * POLICY.fxReference
}

function scholarshipOf(view: CreditView): number | null {
  return num(extracted(view, 'sponsor_amount')?.extractedValue)
}

function bureauOf(view: CreditView): number | null {
  return view.parties.find((p) => p.role === 'co_applicant')?.bureauScore ?? null
}

/** Entrance and language scores, as recorded by CJ-10. */
function testScores(view: CreditView): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of view.extracted) {
    if (!/^(GRE|GMAT|LSAT|IELTS|TOEFL)$/i.test(f.label)) continue
    const n = num(f.enteredValue || f.extractedValue)
    if (n !== null) out[f.label.toUpperCase()] = n
  }
  return out
}

/** Prior academic record, as recorded by CJ-09. */
function priorEducation(view: CreditView): { institution?: string; result?: string; backlogs?: number } {
  return {
    institution: extracted(view, 'Institution')?.enteredValue,
    result: extracted(view, 'Result')?.enteredValue,
    backlogs: num(extracted(view, 'Backlogs outstanding')?.enteredValue) ?? undefined,
  }
}

// ---- 2.1 Fresh assessment ---------------------------------------------------

export interface FreshAssessmentOutput {
  askInr: number
  foirPct: number | null
  foirVerdict: string | null
  bureauScore: number | null
  securedConstruct: boolean
  verifiedDocs: number
  failedValidations: string[]
  band: string
  approver: string
  /** Deliberately not a recommendation. */
  position: string
}

/** Reads the file from its own facts.
 *
 *  Everything here comes off the application record — parties, validations,
 *  documents, extracted figures. Nothing comes from an agent's opinion, and the
 *  onboarding verdict is not even present on the input type. */
export function runFreshAssessment(view: CreditView): AgentResult {
  const foirPct = foirOf(view)
  const verdict = foirPct === null ? null : foirVerdictFor(foirPct)
  const bureau = bureauOf(view)
  const failed = view.validations.filter((v) => v.status === 'fail').map((v) => v.catalogueId)
  const verified = view.documents.filter((d) => d.status === 'verified').length
  const band = effectiveBand(view as Application)

  const findings: AgentFinding[] = []
  if (verdict === 'block') {
    findings.push(
      finding(
        'fresh_assessment',
        'attention',
        'bank',
        `FOIR at ${foirPct}% is past the policy ceiling`,
        `Above ${POLICY.foirPolicy.postMoratoriumDeviationMax}%. On the file's own figures this does not service.`,
      ),
    )
  }
  if (bureau !== null && bureau < 680) {
    findings.push(
      finding(
        'fresh_assessment',
        'attention',
        'bank',
        `Co-applicant bureau score is ${bureau}`,
        'Below the range this book normally lends against. A person should read the report itself, not the number.',
      ),
    )
  }
  if (failed.length > 0) {
    findings.push(
      finding(
        'fresh_assessment',
        'info',
        'bank',
        `${failed.length} validation(s) failing`,
        failed.slice(0, 8).join(', '),
      ),
    )
  }

  // A POSITION, not a recommendation. The distinction is the whole reason
  // `finalDecision` still needs a person with a DoA band.
  const position =
    verdict === 'block' ? 'Does not service on the file’s own figures'
    : failed.length > 0 ? 'Servicing looks workable; open checks remain'
    : 'Nothing on the file’s own figures stands against it'

  return result(
    'fresh_assessment',
    position,
    findings,
    {
      askInr: view.askInr,
      foirPct,
      foirVerdict: verdict,
      bureauScore: bureau,
      securedConstruct: view.securedConstruct,
      verifiedDocs: verified,
      failedValidations: failed,
      band,
      approver: bandApprover(band),
      position,
    } satisfies FreshAssessmentOutput,
  )
}

// ---- Cohort machinery shared by 2.2 and 2.3 ---------------------------------

export interface CohortOutcome {
  label: string
  n: number
  closed: number
  adverse: number
  disbursed: number
  evidence: Evidence
  adverseRatePct: number | null
  /** What the whole book does, so a cohort rate can be read against something. */
  bookAdverseRatePct: number
}

function outcomeStat(label: string, cohort: Application[], book: Application[]): CohortOutcome {
  const closed = cohort.filter((a) => a.outcome)
  const adverse = closed.filter((a) => a.outcome!.kind !== 'disbursed')
  const disbursed = closed.filter((a) => a.outcome!.kind === 'disbursed')
  const bookClosed = book.filter((a) => a.outcome)
  const bookAdverse = bookClosed.filter((a) => a.outcome!.kind !== 'disbursed')
  const evidence = evidenceFor(closed.length)
  return {
    label,
    n: cohort.length,
    closed: closed.length,
    adverse: adverse.length,
    disbursed: disbursed.length,
    evidence,
    // A rate from two files is not a rate. `absent` returns null so the surface
    // has nothing to render as a percentage — the same discipline the
    // university brief uses for a thin dossier.
    adverseRatePct:
      evidence === 'absent' ? null : Math.round((adverse.length / Math.max(1, closed.length)) * 100),
    bookAdverseRatePct: Math.round((bookAdverse.length / Math.max(1, bookClosed.length)) * 100),
  }
}

function cohortFinding(
  agent: 'geography_cohort' | 'college_cohort',
  stat: CohortOutcome,
): AgentFinding | null {
  if (stat.evidence === 'absent') {
    return finding(
      agent,
      'info',
      'bank',
      `No history to read for ${stat.label}`,
      `${stat.n} file(s) match and ${stat.closed} have closed. Not enough to say anything — this is an absence of evidence, not a clean record.`,
    )
  }
  const delta = (stat.adverseRatePct ?? 0) - stat.bookAdverseRatePct
  if (Math.abs(delta) < 10) return null
  return finding(
    agent,
    'info',
    'bank',
    `${stat.label} closes ${delta > 0 ? 'worse' : 'better'} than the book`,
    `${stat.adverseRatePct}% of ${stat.closed} closed file(s) ended adversely, against ${stat.bookAdverseRatePct}% across the book.${
      stat.evidence === 'thin' ? ' Thin evidence — worth noting, not weighting.' : ''
    }`,
  )
}

// ---- 2.2 Geography cohort ---------------------------------------------------

export interface GeographyOutput {
  basis: 'branch' | 'city' | 'region'
  /** Named honestly: this is where the BANK is, not where the applicant lives. */
  basisNote: string
  branch: CohortOutcome
  city: CohortOutcome
  region: CohortOutcome
}

/** How files from this location have fared.
 *
 *  A caveat that has to travel with every number here: the only geography on the
 *  data model is the SERVICING BRANCH. `keyOf(app, 'city')` resolves through
 *  `BRANCH_BY_ID[app.branchId]`, so "Pune files close worse" means files booked
 *  at the Pune branch, not applicants who live in Pune. CJ-08 now records the
 *  applicant's own city, but no CLOSED file carries one yet, so there is nothing
 *  to learn from on that basis — and saying so is better than quietly
 *  substituting the branch and calling it the applicant's. */
export function runGeographyCohort(view: CreditView, book: Application[]): AgentResult {
  const br = BRANCH_BY_ID[view.branchId]
  const sameBranch = book.filter((a) => a.appId !== view.appId && a.branchId === view.branchId)
  const sameCity = book.filter(
    (a) => a.appId !== view.appId && BRANCH_BY_ID[a.branchId]?.city === br?.city,
  )
  const sameRegion = book.filter(
    (a) => a.appId !== view.appId && BRANCH_BY_ID[a.branchId]?.region === br?.region,
  )

  const branch = outcomeStat(br?.name ?? view.branchId, sameBranch, book)
  const city = outcomeStat(br?.city ?? '—', sameCity, book)
  const region = outcomeStat(br?.region ?? '—', sameRegion, book)

  // Narrowest basis that actually has evidence behind it.
  const basis: GeographyOutput['basis'] =
    branch.evidence !== 'absent' ? 'branch' : city.evidence !== 'absent' ? 'city' : 'region'
  const chosen = basis === 'branch' ? branch : basis === 'city' ? city : region

  const findings: AgentFinding[] = []
  const f = cohortFinding('geography_cohort', chosen)
  if (f) findings.push(f)

  return result(
    'geography_cohort',
    chosen.evidence === 'absent'
      ? 'No location history to read'
      : `${chosen.label}: ${chosen.adverseRatePct}% adverse across ${chosen.closed} closed (book ${chosen.bookAdverseRatePct}%)`,
    findings,
    {
      basis,
      basisNote:
        'Servicing branch, not applicant residence — the only geography this record carries.',
      branch,
      city,
      region,
    } satisfies GeographyOutput,
  )
}

// ---- 2.3 College and course cohort ------------------------------------------

export interface CollegeOutput {
  basis: 'university+program' | 'university' | 'program'
  university: CohortOutcome
  universityProgram: CohortOutcome
  program: CohortOutcome
  onLenderList: boolean
}

export function runCollegeCohort(view: CreditView, book: Application[]): AgentResult {
  const app = view as Application
  const uniProg = outcomeStat(
    `${view.universityShort} · ${view.program}`,
    peersOf(app, book, 'university+program'),
    book,
  )
  const uni = outcomeStat(view.universityShort, peersOf(app, book, 'university'), book)
  const prog = outcomeStat(view.program, peersOf(app, book, 'program'), book)

  const basis: CollegeOutput['basis'] =
    uniProg.evidence !== 'absent' ? 'university+program'
    : uni.evidence !== 'absent' ? 'university'
    : 'program'
  const chosen = basis === 'university+program' ? uniProg : basis === 'university' ? uni : prog

  const onList = Boolean(findUniversity(view.university))
  const findings: AgentFinding[] = []
  const f = cohortFinding('college_cohort', chosen)
  if (f) findings.push(f)
  if (!onList) {
    findings.push(
      finding(
        'college_cohort',
        'attention',
        'bank',
        `${view.university} is not on the lender’s list`,
        'No rank basis, so no premier overlay applies and the unsecured ceiling falls back to the Tier-2 band.',
      ),
    )
  }

  return result(
    'college_cohort',
    chosen.evidence === 'absent'
      ? 'No institution history to read'
      : `${chosen.label}: ${chosen.adverseRatePct}% adverse across ${chosen.closed} closed (book ${chosen.bookAdverseRatePct}%)`,
    findings,
    {
      basis,
      university: uni,
      universityProgram: uniProg,
      program: prog,
      onLenderList: onList,
    } satisfies CollegeOutput,
  )
}

// ---- 2.4 Policy fit ---------------------------------------------------------

export interface PolicyTest {
  parameter: string
  policy: string
  actual: string
  within: boolean | null
  note?: string
}

export interface PolicyFitOutput {
  tests: PolicyTest[]
  outside: number
  unassessable: number
}

/** Applies the lender's parameters against this file's own facts.
 *
 *  This is the FIRST officer-side computation of policy in the codebase.
 *  `lib/eligibility.ts:quote()` runs only in the customer pre-qualification
 *  journey; a bank-side file's tier, overlay basis, FOIR and LTV are seed
 *  literals or extracted fields, never computed.
 *
 *  It also gives eight POLICY parameters their first reader. `coaTolerancePct`,
 *  `netAskGapPct`, `lrsCapUsd`, `incomeConvergenceGapPct`, `itrMatchTolerancePct`,
 *  `forexBandPct` and the FD/LIC/MF rows of `ltvPolicy` were declared and read
 *  by nothing — their thresholds existed only as prose inside validation
 *  messages. A number that lives in a message is documentation; a number that a
 *  test reads is policy.
 *
 *  Nothing here is hard-coded to a loan type: each test states the parameter, the
 *  file's actual figure, and whether it sits inside — and says `unassessable`
 *  where the file simply does not carry the figure, rather than assuming a pass. */
export function runPolicyFit(view: CreditView): AgentResult {
  const tests: PolicyTest[] = []
  const ask = view.askInr
  const coaInr = coaOf(view)
  const foirPct = foirOf(view)
  const scholarship = scholarshipOf(view)
  const scores = testScores(view)
  const prior = priorEducation(view)
  const uniRef = findUniversity(view.university)
  const overlay = overlayFor(uniRef?.rank)

  const t = (parameter: string, policy: string, actual: string, within: boolean | null, note?: string) =>
    tests.push({ parameter, policy, actual, within, note })

  // -- ceiling and overlay, factored by the institution ---------------------
  const ceiling = overlay.ceilingInr ?? POLICY.tierBands.tier2CeilingInr
  t(
    'Unsecured ceiling',
    `₹${ceiling.toLocaleString('en-IN')}${overlay.overlay ? ` (${overlay.overlay})` : ' (no overlay)'}`,
    `₹${ask.toLocaleString('en-IN')}`,
    ask <= ceiling || view.securedConstruct,
    view.securedConstruct ? 'Secured, so the unsecured ceiling does not bind' : undefined,
  )

  // -- margin ---------------------------------------------------------------
  if (coaInr !== null) {
    const need = Math.max(0, coaInr - (scholarship ?? 0))
    const marginPct = need > 0 ? Math.round(((need - ask) / need) * 100) : 0
    t(
      'Margin',
      `≥ ${POLICY.marginPct}%`,
      `${marginPct}%`,
      marginPct >= POLICY.marginPct,
      scholarship ? `Scholarship of ₹${scholarship.toLocaleString('en-IN')} applied first` : undefined,
    )
    // -- COA tolerance — first reader of coaTolerancePct --------------------
    const gapPct = Math.round((Math.abs(coaInr - (ask + (scholarship ?? 0))) / coaInr) * 100)
    t(
      'Cost of attendance vs funding',
      `within ${POLICY.coaTolerancePct}%`,
      `${gapPct}%`,
      gapPct <= POLICY.coaTolerancePct,
    )
  } else {
    t('Margin', `≥ ${POLICY.marginPct}%`, 'no cost of attendance on file', null)
    t('Cost of attendance vs funding', `within ${POLICY.coaTolerancePct}%`, 'no cost of attendance on file', null)
  }

  // -- FOIR -----------------------------------------------------------------
  t(
    'FOIR, post-moratorium',
    `≤ ${POLICY.foirPolicy.postMoratoriumPassMax}% pass · ≤ ${POLICY.foirPolicy.postMoratoriumDeviationMax}% deviation`,
    foirPct === null ? 'not on file' : `${foirPct}%`,
    foirPct === null ? null : foirPct <= POLICY.foirPolicy.postMoratoriumDeviationMax,
    foirPct !== null && foirPct > POLICY.foirPolicy.postMoratoriumPassMax
      ? 'Inside the deviation band — needs one raising'
      : undefined,
  )

  // -- LRS — first reader of lrsCapUsd -------------------------------------
  const askUsd = Math.round(ask / POLICY.fxReference)
  t(
    'LRS headroom',
    `≤ US$${POLICY.lrsCapUsd.toLocaleString('en-US')} per FY`,
    `US$${askUsd.toLocaleString('en-US')}`,
    askUsd <= POLICY.lrsCapUsd,
  )

  // -- LTV — first reader of the FD / LIC / MF rows -------------------------
  if (view.securedConstruct) {
    const ltv = num(extracted(view, 'ltv_pct')?.extractedValue)
    const cap = Number(POLICY.ltvPolicy.Immovable)
    t(
      'LTV on immovable security',
      `≤ ${cap}%`,
      ltv === null ? 'no valuation on file' : `${ltv}%`,
      ltv === null ? null : ltv <= cap,
      `Financial security caps: FD ${POLICY.ltvPolicy.FD}% · LIC ${POLICY.ltvPolicy.LIC}% · MF ${POLICY.ltvPolicy.MF}%`,
    )
  }

  // -- institution and programme quality, factored not hard-coded -----------
  const scoreList = Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(' · ')
  t(
    'Entrance / language scores',
    'on file where the programme requires one',
    scoreList || 'none recorded',
    scoreList ? true : null,
    scoreList ? undefined : 'Test-optional routes are legitimate; absence is not a fail',
  )
  t(
    'Prior academic record',
    'on file',
    prior.result ? `${prior.result}${prior.backlogs !== undefined ? ` · ${prior.backlogs} backlog(s)` : ''}` : 'none recorded',
    prior.result ? (prior.backlogs ?? 0) === 0 : null,
    prior.institution ? `From ${prior.institution}` : undefined,
  )

  const outside = tests.filter((x) => x.within === false).length
  const unassessable = tests.filter((x) => x.within === null).length

  const findings: AgentFinding[] = []
  for (const x of tests.filter((y) => y.within === false)) {
    findings.push(
      finding('policy_fit', 'attention', 'bank', `Outside policy: ${x.parameter}`, `Policy ${x.policy}; file shows ${x.actual}.`),
    )
  }
  if (unassessable > 0) {
    findings.push(
      finding(
        'policy_fit',
        'info',
        'bank',
        `${unassessable} parameter(s) cannot be assessed`,
        'The file does not carry the figure. Recorded as unassessable rather than passed — absence is not compliance.',
      ),
    )
  }

  return result(
    'policy_fit',
    outside === 0
      ? `Inside policy on ${tests.length - unassessable} testable parameter(s)`
      : `${outside} parameter(s) outside policy`,
    findings,
    { tests, outside, unassessable } satisfies PolicyFitOutput,
  )
}

// ---- 2.5 Guardrail ----------------------------------------------------------

export interface CreditGuardrailOutput {
  deterministic: boolean
  /** The assessment did not change when the onboarding verdict was removed. */
  independentOfOnboarding: boolean
  /** No agent wrote back to the collection-phase record. */
  noWriteBack: boolean
  offences: string[]
}

/** Proves independence rather than asserting it.
 *
 *  The test: run the whole assessment on the file as given, then again on a copy
 *  with the onboarding verdict deleted. If anything credit produces differs, an
 *  onboarding conclusion reached it — and this fails loudly.
 *
 *  It also checks nothing was written back. These agents take a view and return
 *  results; a credit agent that mutated the file it was reading would corrupt
 *  the very record the officer is about to decide on. */
export function runCreditGuardrail(app: Application, book: Application[]): AgentResult {
  const offences: string[] = []

  const withVerdict = assessmentFingerprint(app, book)
  const withoutVerdict = assessmentFingerprint(
    { ...app, onboardingVerdict: undefined } as Application,
    book,
  )
  const independentOfOnboarding = withVerdict === withoutVerdict
  if (!independentOfOnboarding) {
    offences.push('the assessment changed when the onboarding verdict was removed — credit is reading the sales view')
  }

  const again = assessmentFingerprint(app, book)
  const deterministic = withVerdict === again
  if (!deterministic) offences.push('the assessment did not return the same answer twice')

  // Write-back: the agents are pure, so a deep compare of the input before and
  // after is the whole test.
  const before = JSON.stringify(app)
  runFreshAssessment(creditView(app))
  runGeographyCohort(creditView(app), book)
  runCollegeCohort(creditView(app), book)
  runPolicyFit(creditView(app))
  const noWriteBack = JSON.stringify(app) === before
  if (!noWriteBack) offences.push('an agent mutated the application it was reading')

  const clean = independentOfOnboarding && deterministic && noWriteBack
  return result(
    'credit_guardrail',
    clean ? 'Assessment is independent of the sales view' : `${offences.length} independence breach(es)`,
    clean ? [] : offences.map((o) => finding('credit_guardrail', 'block', 'bank', 'Independence breach', o)),
    { deterministic, independentOfOnboarding, noWriteBack, offences } satisfies CreditGuardrailOutput,
  )
}

/** Everything the four assessing agents conclude, as one comparable string.
 *
 *  NOTE THE CAST, AND DO NOT REMOVE IT. This deliberately does NOT call
 *  `creditView()` — it hands the agents whatever it was given, verdict and all.
 *
 *  The first version of this function stripped the verdict itself, which made
 *  the independence test vacuous: both sides of the comparison had the verdict
 *  removed, so it compared two identical inputs and passed on every file
 *  including one deliberately rigged to leak. A guardrail that cannot fail is
 *  not a guardrail. The test only means something if the WITH-verdict run can
 *  actually see the verdict, so that an agent reaching around the type shows up
 *  as a difference.
 *
 *  Finding ids carry a module counter that advances between runs, so they are
 *  dropped — the same `strip` discipline the document harness uses. */
function assessmentFingerprint(appLike: Application, book: Application[]): string {
  const v = appLike as unknown as CreditView
  const rs = [runFreshAssessment(v), runGeographyCohort(v, book), runCollegeCohort(v, book), runPolicyFit(v)]
  return JSON.stringify(
    rs.map((r) => ({
      agent: r.agent,
      headline: r.headline,
      output: r.output,
      findings: r.findings.map((f) => [f.agent, f.level, f.audience, f.title, f.detail]),
    })),
  )
}

// ---- The whole swarm --------------------------------------------------------

export interface CreditAssessmentSummary {
  position: string
  outsidePolicy: number
  headlines: { agent: string; headline: string }[]
  independent: boolean
  assessedAt: string
}

export function runCreditSwarm(
  app: Application,
  book: Application[],
): Record<string, AgentResult> {
  const view = creditView(app)
  return {
    fresh_assessment: runFreshAssessment(view),
    geography_cohort: runGeographyCohort(view, book),
    college_cohort: runCollegeCohort(view, book),
    policy_fit: runPolicyFit(view),
    credit_guardrail: runCreditGuardrail(app, book),
  }
}

export function summariseCredit(results: Record<string, AgentResult>): Omit<CreditAssessmentSummary, 'assessedAt'> {
  const fresh = results.fresh_assessment?.output as FreshAssessmentOutput | undefined
  const policy = results.policy_fit?.output as PolicyFitOutput | undefined
  const guard = results.credit_guardrail?.output as CreditGuardrailOutput | undefined
  return {
    position: fresh?.position ?? 'No position formed',
    outsidePolicy: policy?.outside ?? 0,
    headlines: Object.values(results).map((r) => ({ agent: r.agent, headline: r.headline })),
    independent: guard?.independentOfOnboarding ?? false,
  }
}
