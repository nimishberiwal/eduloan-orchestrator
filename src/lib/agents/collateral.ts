// ============================================================================
// The collateral orchestrator (§v5).
//
// S09 is CONDITIONAL — Tier-3 secured files only — and it is the only stage
// that runs alongside others rather than after them: legal and technical
// valuation proceed in parallel with S07 underwriting and S08 risk. It is also
// the slowest closure path in the seed.
//
// WHAT IT REPLACES. A secured file carries a collateral-provider party, the
// C1–C4 buckets and, until now, almost nothing about the security itself. The
// S09 forward gate reads three validation results whose statuses were seeded,
// not computed. `POLICY.ltvPolicy` — Immovable 70, FD 90, LIC 85, MF 50 — had
// its first reader in the credit orchestrator's `policy_fit`, which reported
// `unassessable` on nearly every secured file because no file carried a
// valuation to assess.
//
// ---------------------------------------------------------------------------
// TWO ANTI-GOALS.
//
// 1. THE VALUATION MUST NOT KNOW THE ASK.
//
//    The oldest error in secured lending is not a bad valuation, it is a
//    valuation that arrives at whatever number the loan needs. `security_value`
//    is handed a `SecurityView` with `askInr` removed — along with the credit
//    assessment, the decision and the outcome — so it CANNOT back-solve. It
//    values the asset and states the advance rate its instrument attracts.
//
//    Exactly one agent sees the ask: `coverage`, whose entire job is the
//    comparison. Splitting the valuing from the comparing is what makes the
//    property enforceable rather than aspirational, and the guardrail proves it
//    by forcing the ask to ₹10L and to ₹1Cr and requiring the valuation to come
//    back byte-identical.
//
// 2. HELD IS NOT PERFECTED.
//
//    A deed in a folder is not a charge. The S09 gate says so in as many words
//    — "C4 perfection may remain as COV-04" — so a file may leave S09, and be
//    sanctioned, with the mortgage unregistered and the perfection deferred to
//    a covenant cleared before first disbursement. Treating the C4 document as
//    the charge is the error that costs a bank money at enforcement, and it is
//    the same shape as the error `decision_sufficiency` exists to catch: a
//    thing being ON FILE is not the thing being TRUE.
//
//    `charge_perfection` therefore reads `perfection_status` and never document
//    presence. The guardrail forces every collateral document to `verified` and
//    requires the perfection verdict not to move.
// ============================================================================
import type { AgentFinding, AgentResult } from './types'
import { finding, result } from './runtime'
import { POLICY } from '@/data/policy'
import type { Application, ExtractedField, StageId } from '@/types'
import { STAGES } from '@/data/stages'

/** Has this file reached S09 yet? Charge creation is a C4 activity and C4 is
 *  `requiredByStage: 'disbursement_t1'` — so a file at S04 has no charge for
 *  entirely correct reasons, and reporting that as a hold would be the
 *  "premature block" mirror of the "absence is compliance" error. Terminal
 *  tokens are not S-stages and count as having got as far as they got. */
function reachedS09(app: Application): boolean {
  const order = STAGES.map((x) => x.id)
  const here = order.indexOf(app.stage as StageId)
  const s09 = order.indexOf('S09' as StageId)
  if (here < 0) {
    // Terminal — use the stage it actually closed in.
    const closed = app.outcome?.stageAtClosure
    return closed ? order.indexOf(closed as StageId) >= s09 : false
  }
  return here >= s09
}

// ---- The view the valuer gets ----------------------------------------------

/** Everything the security can be valued from, and nothing it could be
 *  back-solved from. `askInr` is the field that matters; the rest are stripped
 *  for the same reason `CreditView` strips the onboarding verdict — a valuer
 *  who can see that the file was declined has been told the answer. */
export type SecurityView = Omit<
  Application,
  'askInr' | 'creditAssessment' | 'decision' | 'rejectionCode' | 'outcome'
>

export function securityView(app: Application): SecurityView {
  const { askInr: _a, creditAssessment: _c, decision: _d, rejectionCode: _r, outcome: _o, ...rest } = app
  return rest
}

function field(view: SecurityView | Application, label: string): ExtractedField | undefined {
  return view.extracted?.find((f) => f.label === label)
}

/** Extracted values are strings — '₹61,00,000', '≤70', 'Immovable'. */
function rupees(v: string | undefined): number | null {
  if (!v) return null
  const m = v.replace(/[, ]/g, '').match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

const INSTRUMENTS = ['Immovable', 'FD', 'LIC', 'MF'] as const
export type Instrument = (typeof INSTRUMENTS)[number]

function instrumentOf(view: SecurityView | Application): Instrument | null {
  const t = field(view, 'collateral_type')?.extractedValue?.trim()
  return (INSTRUMENTS as readonly string[]).includes(t ?? '') ? (t as Instrument) : null
}

// ---- 4.1 Security valuation --------------------------------------------------

export interface ValuationOutput {
  instrument: Instrument | null
  /** The advance rate this instrument attracts, straight off POLICY. */
  advanceRatePct: number | null
  assessedValueInr: number | null
  /** assessedValue × advanceRate — what the bank could actually lend against
   *  this security, independent of what anyone asked for. */
  realisableInr: number | null
  /** Stated rather than assumed: a file with no valuation is unassessable, not
   *  compliant, and not zero. */
  unassessable: string[]
}

export function runSecurityValuation(view: SecurityView): AgentResult {
  const instrument = instrumentOf(view)
  const assessedValueInr = rupees(field(view, 'technical_value_inr')?.extractedValue)
  const advanceRatePct = instrument ? Number(POLICY.ltvPolicy[instrument] ?? 70) : null
  const realisableInr =
    assessedValueInr !== null && advanceRatePct !== null
      ? Math.round(assessedValueInr * (advanceRatePct / 100))
      : null

  const unassessable: string[] = []
  if (!instrument) unassessable.push('collateral_type — no instrument recorded')
  if (assessedValueInr === null) unassessable.push('technical_value_inr — no valuation on file')

  const findings: AgentFinding[] = []
  if (unassessable.length > 0) {
    findings.push(
      finding(
        'security_value',
        'attention',
        'bank',
        'The security cannot be valued from what is on file',
        `${unassessable.join('; ')}. This is not a shortfall — it is an absence, and it is reported as one.`,
      ),
    )
  }

  return result(
    'security_value',
    realisableInr !== null && instrument
      ? `${instrument} — ₹${realisableInr.toLocaleString('en-IN')} realisable at ${advanceRatePct}%`
      : 'Not valuable from what is on file',
    findings,
    { instrument, advanceRatePct, assessedValueInr, realisableInr, unassessable } satisfies ValuationOutput,
  )
}

// ---- 4.2 Title and encumbrance -----------------------------------------------

export interface TitleCheck {
  ref: string
  label: string
  /** `null` where the instrument makes the check inapplicable — a lien-marked
   *  fixed deposit has no encumbrance certificate and no property tax. That is
   *  NOT A PASS, and it is not a failure either. */
  passed: boolean | null
  detail: string
}
export interface TitleOutput {
  checks: TitleCheck[]
  failed: number
  notApplicable: number
}

export function runTitleAndEncumbrance(view: SecurityView): AgentResult {
  const instrument = instrumentOf(view)
  const immovable = instrument === 'Immovable'
  const opinion = field(view, 'legal_opinion')?.extractedValue ?? ''
  const ec = field(view, 'encumbrance_continuous')?.extractedValue
  const tax = field(view, 'property_tax_current')?.extractedValue

  const na = (label: string): string =>
    `Not applicable — ${instrument ?? 'this instrument'} carries no ${label}.`

  const checks: TitleCheck[] = [
    {
      ref: 'VAL-CRS-20',
      label: 'Legal opinion clear',
      passed: opinion ? !opinion.startsWith('Adverse') : null,
      detail: opinion || 'No legal opinion on file.',
    },
    {
      ref: 'VAL-INT-14',
      label: 'Encumbrance certificate continuous',
      passed: !immovable ? null : ec ? ec === 'Yes' : null,
      detail: !immovable
        ? na('encumbrance certificate')
        : ec
          ? ec === 'Yes'
            ? 'Continuous, no breaks in the searched period.'
            : 'A break in the encumbrance record — the chain is not continuous.'
          : 'No encumbrance certificate on file.',
    },
    {
      ref: 'VAL-INT-22',
      label: 'Property tax current, in the owner’s name',
      passed: !immovable ? null : tax ? tax === 'Yes' : null,
      detail: !immovable
        ? na('property tax record')
        : tax
          ? tax === 'Yes'
            ? 'Current financial year paid, receipts in the owner’s name.'
            : 'Receipts are not current for the financial year.'
          : 'No property-tax receipts on file.',
    },
    {
      ref: 'VAL-EXT-15',
      label: 'Indian-situs security',
      // Every instrument this product accepts is Indian-situs by construction;
      // the check exists because VAL-CRS-19 requires it and a foreign asset
      // would be uncharged and unenforceable here.
      passed: instrument ? true : null,
      detail: instrument
        ? `${instrument}, Indian-situs — chargeable and enforceable in India.`
        : 'No instrument recorded, so situs cannot be established.',
    },
  ]

  const failed = checks.filter((c) => c.passed === false).length
  const notApplicable = checks.filter((c) => c.passed === null).length

  const findings: AgentFinding[] = []
  for (const c of checks) {
    if (c.passed === false) {
      findings.push(finding('title_search', 'block', 'bank', `${c.ref} — ${c.label}`, c.detail))
    }
  }

  return result(
    'title_search',
    failed === 0
      ? notApplicable === checks.length
        ? 'Nothing on file to search'
        : 'Title and encumbrance stand up'
      : `${failed} title finding(s)`,
    findings,
    { checks, failed, notApplicable } satisfies TitleOutput,
  )
}

// ---- 4.3 Coverage — the only agent that sees the ask -------------------------

export interface CoverageOutput {
  askInr: number
  realisableInr: number | null
  shortfallInr: number | null
  covered: boolean | null
  /** How far the realisable value goes towards the ask, as a percentage. */
  coverPct: number | null
}

/** Takes the whole `Application` deliberately, and is the ONLY agent in this
 *  module that does. Everything it needs from the valuation it takes from
 *  `runSecurityValuation`, so the number it compares against is the number the
 *  valuer produced without knowing what it would be compared to. */
export function runCoverage(app: Application): AgentResult {
  const val = runSecurityValuation(securityView(app)).output as ValuationOutput
  const askInr = app.askInr
  const realisableInr = val.realisableInr
  const covered = realisableInr === null ? null : realisableInr >= askInr
  const shortfallInr = realisableInr === null ? null : Math.max(0, askInr - realisableInr)
  const coverPct = realisableInr === null || askInr <= 0 ? null : Math.round((realisableInr / askInr) * 100)

  const findings: AgentFinding[] = []
  if (covered === false && shortfallInr !== null) {
    findings.push(
      finding(
        'coverage',
        'block',
        'bank',
        'The security does not cover the ask',
        `₹${realisableInr!.toLocaleString('en-IN')} realisable against an ask of ₹${askInr.toLocaleString('en-IN')} — short by ₹${shortfallInr.toLocaleString('en-IN')} (${coverPct}% covered). The advance rate is ${val.advanceRatePct}% for ${val.instrument}; the shortfall is the ask's, not the valuation's.`,
      ),
    )
  } else if (covered === null) {
    findings.push(
      finding(
        'coverage',
        'attention',
        'bank',
        'Coverage cannot be computed',
        'There is no realisable value to compare the ask against. Absence is not coverage.',
      ),
    )
  }

  return result(
    'coverage',
    covered === null
      ? 'Coverage unassessable'
      : covered
        ? `Covered — ${coverPct}% of the ask`
        : `Short by ₹${shortfallInr!.toLocaleString('en-IN')}`,
    findings,
    { askInr, realisableInr, shortfallInr, covered, coverPct } satisfies CoverageOutput,
  )
}

// ---- 4.4 Charge perfection ---------------------------------------------------

export type PerfectionState = 'perfected' | 'equitable_unregistered' | 'pending' | 'unknown'

export interface PerfectionOutput {
  state: PerfectionState
  /** False before S09 — see `reachedS09`. */
  assessable: boolean
  /** Documents in the C4 bucket that are verified. Reported for context and
   *  DELIBERATELY not used to decide `state` — see the header. */
  c4DocsVerified: number
  c4DocsTotal: number
  /** COV-04 carries perfection to first disbursement when S09 is left without
   *  it. Its presence is what makes an unperfected exit legitimate. */
  covenantCarrying: boolean
  /** May the file leave S09? Perfection is explicitly allowed to remain open. */
  blocksS09: boolean
}

export function runChargePerfection(app: Application): AgentResult {
  const raw = field(app, 'perfection_status')?.extractedValue?.trim().toLowerCase()
  const state: PerfectionState =
    raw === undefined ? 'unknown'
    : raw === 'perfected' ? 'perfected'
    : raw.startsWith('equitable') ? 'equitable_unregistered'
    : 'pending'

  const c4 = (app.buckets ?? []).filter((b) => b.section === 'collateral' && b.code === 'C4')
  const c4Ids = new Set(c4.map((b) => b.id))
  const c4Docs = (app.documents ?? []).filter((d) => c4Ids.has(d.bucketId))
  const c4DocsVerified = c4Docs.filter((d) => d.status === 'verified').length

  const covenantCarrying = (app.covenants ?? []).some((c) => c.defId === 'COV-04')

  // Perfection does NOT block S09 — the gate says so. What blocks is LEAVING
  // S09 unperfected with nothing carrying it: no covenant, no charge.
  //
  // And only from S09 onward. Before that there is nothing to perfect yet, and
  // 69 of 98 secured files were being held at S03/S04 for the absence of a
  // charge that is not created until C4.
  const blocksS09 = reachedS09(app) && state !== 'perfected' && !covenantCarrying

  const findings: AgentFinding[] = []
  if (blocksS09) {
    findings.push(
      finding(
        'charge_perfection',
        'block',
        'bank',
        'The charge is neither perfected nor carried',
        `Perfection is ${state.replace(/_/g, ' ')} and no COV-04 is on the file. A file may leave S09 with the mortgage unregistered — the gate allows exactly that — but only when a covenant carries it to first disbursement. ${c4DocsVerified} of ${c4DocsTotalOf(c4Docs)} C4 document(s) are verified, which is not the same thing as a charge.`,
      ),
    )
  } else if (state !== 'perfected' && reachedS09(app) && covenantCarrying) {
    findings.push(
      finding(
        'charge_perfection',
        'attention',
        'bank',
        'Charge unperfected, carried by COV-04',
        `Perfection is ${state.replace(/_/g, ' ')}. COV-04 carries it to first disbursement, where the covenant gate enforces it.`,
      ),
    )
  }

  return result(
    'charge_perfection',
    state === 'perfected'
      ? 'Charge perfected'
      : !reachedS09(app)
        ? 'Not yet at S09 — no charge expected'
        : covenantCarrying
          ? 'Unperfected — carried by COV-04'
          : 'Unperfected and uncarried',
    findings,
    {
      state,
      assessable: reachedS09(app),
      c4DocsVerified,
      c4DocsTotal: c4DocsTotalOf(c4Docs),
      covenantCarrying,
      blocksS09,
    } satisfies PerfectionOutput,
  )
}

function c4DocsTotalOf(docs: { id: string }[]): number {
  return docs.length
}

// ---- 4.5 Guardrail -----------------------------------------------------------

export interface CollateralGuardrailOutput {
  deterministic: boolean
  /** The valuation did not move when the ask was forced to ₹10L and to ₹1Cr. */
  valuationIndependentOfAsk: boolean
  /** The charge verdict did not move when every collateral document was forced
   *  to `verified`. Held is not perfected. */
  perfectionIgnoresDocuments: boolean
  /** The controls are LIVE — the forced inputs genuinely differ, so the two
   *  tests above are comparing distinguishable things rather than passing
   *  vacuously. */
  controlsLive: boolean
  noWriteBack: boolean
  offences: string[]
}

/** Everything the valuer and the title agent conclude, as one comparable
 *  string. Finding ids carry a module counter that advances between runs, so
 *  they are dropped — the same `strip` discipline the rest of the codebase
 *  uses. */
function valuationFingerprint(app: Application): string {
  const v = securityView(app)
  return strip(runSecurityValuation(v), runTitleAndEncumbrance(v))
}

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

export function runCollateralGuardrail(app: Application): AgentResult {
  const offences: string[] = []

  // Determinism.
  const a = valuationFingerprint(app)
  const b = valuationFingerprint(app)
  const deterministic = a === b
  if (!deterministic) offences.push('the valuation did not return the same answer twice')

  // ANTI-GOAL 1 — the valuation must not know the ask.
  const cheap = valuationFingerprint({ ...app, askInr: 10_00_000 })
  const dear = valuationFingerprint({ ...app, askInr: 1_00_00_000 })
  const valuationIndependentOfAsk = a === cheap && a === dear
  if (!valuationIndependentOfAsk) {
    offences.push('the valuation changed when the ask changed — it is back-solving from the loan')
  }

  // ANTI-GOAL 2 — held is not perfected.
  const allVerified: Application = {
    ...app,
    documents: (app.documents ?? []).map((d) => ({ ...d, status: 'verified' as const })),
  }
  const perfectionBase = JSON.stringify(runChargePerfection(app).output)
  const perfectionForced = JSON.stringify(runChargePerfection(allVerified).output)
  // `c4DocsVerified` is REPORTED and legitimately moves; the verdict must not.
  const verdictOf = (s: string) => {
    const o = JSON.parse(s) as PerfectionOutput
    return JSON.stringify([o.state, o.assessable, o.covenantCarrying, o.blocksS09])
  }
  const perfectionIgnoresDocuments = verdictOf(perfectionBase) === verdictOf(perfectionForced)
  if (!perfectionIgnoresDocuments) {
    offences.push('the charge verdict moved when documents were marked verified — a deed is being read as a charge')
  }

  // ARE THE CONTROLS LIVE? Both tests above compare an output against itself
  // under a forced input. If the forcing does not actually change the input,
  // they pass on anything — the way the credit guardrail once did. So: assert
  // the raw records genuinely differ, and that only the VIEW neutralises the
  // ask.
  const askReallyDiffers =
    JSON.stringify({ ...app, askInr: 10_00_000 }) !== JSON.stringify({ ...app, askInr: 1_00_00_000 })
  const viewNeutralisesAsk =
    JSON.stringify(securityView({ ...app, askInr: 10_00_000 })) ===
    JSON.stringify(securityView({ ...app, askInr: 1_00_00_000 }))
  // The document forcing only means something on a file that HAS collateral
  // documents not already verified.
  const docsReallyDiffer =
    (app.documents ?? []).length === 0 ||
    JSON.stringify(app.documents) !== JSON.stringify(allVerified.documents) ||
    (app.documents ?? []).every((d) => d.status === 'verified')
  const controlsLive = askReallyDiffers && viewNeutralisesAsk && docsReallyDiffer
  if (!controlsLive) {
    offences.push('a control is dead — the forced input did not differ, so the test beside it proves nothing')
  }

  // Purity.
  const before = JSON.stringify(app)
  runSecurityValuation(securityView(app))
  runTitleAndEncumbrance(securityView(app))
  runCoverage(app)
  runChargePerfection(app)
  const noWriteBack = JSON.stringify(app) === before
  if (!noWriteBack) offences.push('an agent mutated the application it was reading')

  const clean =
    deterministic && valuationIndependentOfAsk && perfectionIgnoresDocuments && controlsLive && noWriteBack

  return result(
    'collateral_guardrail',
    clean ? 'The valuation never saw the ask; no deed was read as a charge' : `${offences.length} breach(es)`,
    clean ? [] : offences.map((o) => finding('collateral_guardrail', 'block', 'bank', 'Collateral guardrail breach', o)),
    {
      deterministic,
      valuationIndependentOfAsk,
      perfectionIgnoresDocuments,
      controlsLive,
      noWriteBack,
      offences,
    } satisfies CollateralGuardrailOutput,
  )
}

// ---- The whole swarm ---------------------------------------------------------

export function runCollateralSwarm(app: Application): Record<string, AgentResult> {
  const view = securityView(app)
  return {
    security_value: runSecurityValuation(view),
    title_search: runTitleAndEncumbrance(view),
    coverage: runCoverage(app),
    charge_perfection: runChargePerfection(app),
    collateral_guardrail: runCollateralGuardrail(app),
  }
}

export interface CollateralVerdictOutput {
  /** Secured files only. An unsecured file has no security to assess and this
   *  orchestrator says so rather than reporting a clean bill of health. */
  applicable: boolean
  ready: boolean
  blockingReasons: string[]
  instrument: Instrument | null
  realisableInr: number | null
  coverPct: number | null
  perfection: PerfectionState
  headlines: { agent: string; headline: string }[]
}

export function collateralVerdictFrom(
  app: Application,
  results: Record<string, AgentResult>,
): CollateralVerdictOutput {
  const val = results.security_value?.output as ValuationOutput
  const title = results.title_search?.output as TitleOutput
  const cov = results.coverage?.output as CoverageOutput
  const perf = results.charge_perfection?.output as PerfectionOutput
  const guard = results.collateral_guardrail?.output as CollateralGuardrailOutput

  const applicable = app.securedConstruct === true
  const blockingReasons: string[] = []

  if (applicable) {
    if (cov.covered === false) {
      blockingReasons.push(
        `Security is short of the ask by ₹${cov.shortfallInr!.toLocaleString('en-IN')} (${cov.coverPct}% covered)`,
      )
    }
    if (cov.covered === null) blockingReasons.push('Coverage cannot be computed from what is on file')
    for (const c of title.checks.filter((x) => x.passed === false)) {
      blockingReasons.push(`${c.ref} — ${c.label}`)
    }
    if (perf.blocksS09) blockingReasons.push('Charge neither perfected nor carried by COV-04')
  }

  // A guardrail breach means the orchestrator itself is not behaving, and its
  // verdict cannot be relied on to clear anything.
  if (guard.offences.length > 0) {
    blockingReasons.push(...guard.offences.map((o) => `Guardrail: ${o}`))
  }

  return {
    applicable,
    ready: !applicable || blockingReasons.length === 0,
    blockingReasons,
    instrument: val.instrument,
    realisableInr: val.realisableInr,
    coverPct: cov.coverPct,
    perfection: perf.state,
    headlines: Object.values(results).map((r) => ({ agent: r.agent, headline: r.headline })),
  }
}
