// ============================================================================
// The disbursement gating orchestrator (§v5).
//
// The third orchestrator, and the only one that repeats. Onboarding runs once
// at S05 and credit runs once around S06/S07; this one runs on EVERY tranche of
// every file, forever. That is the whole argument for it: the checks are
// arithmetic and paperwork, the volume is unbounded, and the failure mode is a
// statutory breach rather than a bad lending call.
//
// WHAT IT REPLACES. `Tranche.gates` is a stored array of hand-typed booleans.
// Nothing computed them. `toggleField` reaches into every tranche and flips
// CRS-23/EXT-18 imperatively when `endorsement_verified` changes, which is the
// only reason any tranche gate has ever moved. The LRS cap, the FEMA paperwork,
// the payee and the rate were seeded true and never tested against the file.
// `POLICY.lrsCapUsd` and `POLICY.forexBandPct` got their first reader in the
// credit orchestrator, at assessment time — which is not the moment either of
// them binds. They bind here, per tranche, when money actually moves.
//
// ---------------------------------------------------------------------------
// THE ANTI-GOAL, and it runs the OPPOSITE way to the other two.
//
// Onboarding and credit are each given LESS than the full record: a
// `SufficiencyView` with the decision stripped, a `CreditView` with the
// onboarding verdict stripped. Both anti-goals are about not seeing something.
//
// This one must see MORE. The LRS cap is an ANNUAL AGGREGATE across every
// remittance for the resident. A file with four tranches of USD 70,000 has four
// tranches that are each comfortably inside a USD 250,000 cap and a schedule
// that breaches it by USD 30,000. Any evaluation that looks at one tranche at a
// time passes all four. So:
//
//   `runLrsAggregate` takes the WHOLE schedule and returns one verdict for the
//   file. There is deliberately no per-tranche LRS function to call by mistake,
//   and `perTrancheLrsWouldPass` exists ONLY as the guardrail's negative
//   control — it is the wrong answer, kept so the right one can be shown to
//   differ from it.
//
// SECOND ANTI-GOAL: this orchestrator measures whether money MAY move and must
// be unable to make it movable. Every function here is pure and takes the
// application by value. It exports no mutator. `releaseTranche` and
// `countersignTranche`, under maker-checker, remain the only path to money.
// The guardrail asserts the record is byte-identical after a full run.
// ============================================================================
import type { AgentFinding, AgentId, AgentResult } from './types'
import { finding, result } from './runtime'
import { POLICY } from '@/data/policy'
import type {
  Application,
  ComputedGate,
  GateSeverity,
  Tranche,
  TrancheVerdict,
} from '@/types'
export type { ComputedGate, GateSeverity, TrancheVerdict }

// ---- What a computed gate is -----------------------------------------------

/** How much authority a failing gate carries.
 *
 *  `statutory` gates CANNOT be overridden. The LRS ceiling is a FEMA limit and
 *  Form A2 is the instrument the remittance is made under; neither is a matter
 *  on which an officer holds discretion, so offering an override box for them
 *  would be offering a control the bank does not actually have. This mirrors
 *  `nonOverridable` on the S03 KYC and S08 sanctions-screen gates — the same
 *  distinction, made in the same vocabulary, for the same reason.
 *
 *  `overridable` gates hold the tranche but an officer may proceed on record,
 *  exactly as the S05 onboarding gate works. */
// ---- 3.1 LRS aggregate ------------------------------------------------------

export interface LrsOutput {
  capUsd: number
  scheduledUsd: number
  headroomUsd: number
  within: boolean
  /** Tranches counted. All of them, whatever their status — a remitted tranche
   *  has already consumed headroom and a scheduled one is about to. */
  counted: number
  /** Honest about what it cannot see. */
  basis: string
}

/** The cap applies to the FILE, not to an instalment.
 *
 *  Takes the whole schedule by construction. There is no per-tranche variant to
 *  reach for — see the header, and see `perTrancheLrsWouldPass` below, which is
 *  the wrong answer kept only so the guardrail can prove this one differs. */
export function runLrsAggregate(app: Application): AgentResult {
  const tranches = app.tranches ?? []
  const scheduledUsd = tranches.reduce((n, t) => n + (t.amountUsd || 0), 0)
  const capUsd = POLICY.lrsCapUsd
  const headroomUsd = capUsd - scheduledUsd
  const within = scheduledUsd <= capUsd

  const findings: AgentFinding[] = []
  if (!within) {
    findings.push(
      finding(
        'lrs_aggregate',
        'block',
        'bank',
        'Schedule exceeds the LRS ceiling',
        `The ${tranches.length} tranche(s) on this file total USD ${scheduledUsd.toLocaleString('en-US')} against a cap of USD ${capUsd.toLocaleString('en-US')} — over by USD ${Math.abs(headroomUsd).toLocaleString('en-US')}. No single tranche breaches it; the schedule does. The excess must come off the schedule before any tranche is released.`,
      ),
    )
  } else if (tranches.length > 0 && headroomUsd < capUsd * 0.1) {
    findings.push(
      finding(
        'lrs_aggregate',
        'attention',
        'bank',
        'Little LRS headroom left',
        `USD ${headroomUsd.toLocaleString('en-US')} remains under the cap after this schedule. A further remittance this year is unlikely to fit.`,
      ),
    )
  }

  const basis =
    'This file’s own schedule only. Remittances the applicant has made through another bank in the same financial year are not visible here and would consume the same cap.'

  return result(
    'lrs_aggregate',
    tranches.length === 0
      ? 'No tranche schedule to measure'
      : within
        ? `USD ${headroomUsd.toLocaleString('en-US')} of headroom under the cap`
        : `Schedule is over the cap by USD ${Math.abs(headroomUsd).toLocaleString('en-US')}`,
    findings,
    { capUsd, scheduledUsd, headroomUsd, within, counted: tranches.length, basis } satisfies LrsOutput,
  )
}

/** THE WRONG ANSWER, ON PURPOSE — the guardrail's negative control.
 *
 *  This is what a per-tranche LRS check looks like, and it is what the codebase
 *  would have had if the cap had been implemented the obvious way. It passes a
 *  schedule of four USD 70,000 tranches because no single one exceeds USD
 *  250,000. Nothing calls it except `runDisbursementGuardrail`, which asserts
 *  that on a rigged file this returns `true` while `runLrsAggregate` blocks. If
 *  those two ever agree on the rigged file, the aggregate view has stopped
 *  doing anything and the control has gone dead. */
export function perTrancheLrsWouldPass(app: Application): boolean {
  return (app.tranches ?? []).every((t) => (t.amountUsd || 0) <= POLICY.lrsCapUsd)
}

// ---- 3.2 FEMA paperwork -----------------------------------------------------

/** Where each kind of tranche is allowed to land. VAL-CRS-22 names both. */
const EXPECTED_PAYEE: Record<Tranche['type'], string> = {
  'Tuition-SWIFT-to-university': 'the university, by SWIFT',
  'Living-to-foreign-account-or-forex-card': 'the student’s own foreign account or forex card',
}

export interface FemaOutput {
  perTranche: { trancheId: string; n: number; a2OnFile: boolean; payee: string; purpose: string }[]
  missing: number
}

export function runFemaCompliance(app: Application): AgentResult {
  const tranches = app.tranches ?? []
  const perTranche = tranches.map((t) => ({
    trancheId: t.id,
    n: t.n,
    a2OnFile: t.a2FemaOnFile === true,
    payee: EXPECTED_PAYEE[t.type],
    purpose: 'Education-Abroad',
  }))
  const missing = perTranche.filter((p) => !p.a2OnFile).length

  const findings: AgentFinding[] = []
  for (const p of perTranche) {
    if (!p.a2OnFile) {
      findings.push(
        finding(
          'fema_compliance',
          'block',
          'bank',
          `Tranche ${p.n} has no Form A2 on file`,
          `The remittance is made under Form A2 with a FEMA declaration; without it there is no instrument to remit under. Purpose is Education-Abroad and the payee must be ${p.payee}.`,
        ),
      )
    }
  }

  return result(
    'fema_compliance',
    tranches.length === 0
      ? 'No tranches to check'
      : missing === 0
        ? 'Form A2 and the FEMA declaration are on every tranche'
        : `${missing} tranche(s) without Form A2`,
    findings,
    { perTranche, missing } satisfies FemaOutput,
  )
}

// ---- 3.3 Visa sequencing ----------------------------------------------------

export interface VisaOutput {
  endorsed: boolean
  source: string
  /** Tranche numbers the endorsement rule currently holds. */
  held: number[]
}

/** VAL-CRS-23 — the visa gates the money, and it gates BOTH kinds of tranche.
 *
 *  The rule as written: endorsement before the first major (tuition)
 *  disbursement, and living tranches gated on visa. So an un-endorsed file
 *  releases nothing. Read from the extracted field the console already toggles,
 *  falling back to the validation results. */
export function runVisaGating(app: Application): AgentResult {
  const field = app.extracted?.find((f) => f.label === 'endorsement_verified')
  const byField = field ? field.extractedValue.trim().toLowerCase() === 'true' : undefined
  const crs23 = app.validations?.find((v) => v.catalogueId === 'VAL-CRS-23')
  const ext18 = app.validations?.find((v) => v.catalogueId === 'VAL-EXT-18')
  const byValidation =
    crs23 || ext18
      ? [crs23, ext18].every((v) => !v || v.status === 'pass' || v.status === 'waived')
      : undefined

  const endorsed = byField ?? byValidation ?? false
  const source = field
    ? 'extracted field endorsement_verified'
    : crs23 || ext18
      ? 'VAL-CRS-23 / VAL-EXT-18'
      : 'nothing on file — treated as not endorsed'

  // Only tranches that have not already gone. A remitted tranche is history:
  // re-gating it would report a block on money that has already left, and the
  // officer cannot act on it either way. `scheduled` and `gated` are the live
  // ones. (The seed carries a remitted tranche 1 whose visa gates read true on
  // a file where `endorsement_verified` is false — history and the current
  // field genuinely disagree, and history wins.)
  const live = (app.tranches ?? []).filter((t) => t.status === 'scheduled' || t.status === 'gated')
  const held = endorsed ? [] : live.map((t) => t.n)

  const findings: AgentFinding[] = []
  if (!endorsed && held.length > 0) {
    findings.push(
      finding(
        'visa_gating',
        'block',
        'bank',
        'Visa is not endorsed',
        `Tranche(s) ${held.join(', ')} are held. Endorsement is required before the first tuition disbursement, and living tranches are gated on the visa as well. Read from ${source}.`,
      ),
    )
  }

  return result(
    'visa_gating',
    endorsed ? 'Visa endorsed — sequencing satisfied' : `Visa not endorsed — ${held.length} tranche(s) held`,
    findings,
    { endorsed, source, held } satisfies VisaOutput,
  )
}

// ---- 3.4 Rate band ----------------------------------------------------------

export interface FxRow {
  trancheId: string
  n: number
  fxUsed: number
  deviationPct: number
  withinBand: boolean
  /** amountUsd × fxUsed, against the amountInr actually on the tranche. */
  impliedInr: number
  statedInr: number
  arithmeticOk: boolean
}
export interface FxOutput {
  referenceRate: number
  bandPct: number
  rows: FxRow[]
  outside: number
}

export function runFxBand(app: Application): AgentResult {
  const ref = POLICY.fxReference
  const bandPct = POLICY.forexBandPct
  const rows: FxRow[] = (app.tranches ?? []).map((t) => {
    const fxUsed = t.fxUsed || 0
    const deviationPct = ref > 0 ? ((fxUsed - ref) / ref) * 100 : 0
    const impliedInr = Math.round((t.amountUsd || 0) * fxUsed)
    const statedInr = t.amountInr || 0
    return {
      trancheId: t.id,
      n: t.n,
      fxUsed,
      deviationPct: Math.round(deviationPct * 100) / 100,
      withinBand: Math.abs(deviationPct) <= bandPct,
      impliedInr,
      statedInr,
      // ±₹1 per rupee of rounding on the multiplication, no more.
      arithmeticOk: Math.abs(impliedInr - statedInr) <= 1,
    }
  })
  const outside = rows.filter((r) => !r.withinBand || !r.arithmeticOk).length

  const findings: AgentFinding[] = []
  for (const r of rows) {
    if (!r.withinBand) {
      findings.push(
        finding(
          'fx_band',
          'block',
          'bank',
          `Tranche ${r.n} rate is outside the band`,
          `₹${r.fxUsed} against a reference of ₹${ref} is ${r.deviationPct > 0 ? '+' : ''}${r.deviationPct}%, outside ±${bandPct}%.`,
        ),
      )
    }
    if (!r.arithmeticOk) {
      findings.push(
        finding(
          'fx_band',
          'attention',
          'bank',
          `Tranche ${r.n} rupee figure does not follow from the rate`,
          `The USD amount × ₹${r.fxUsed} gives ₹${r.impliedInr.toLocaleString('en-IN')}, but the tranche carries ₹${r.statedInr.toLocaleString('en-IN')}.`,
        ),
      )
    }
  }

  return result(
    'fx_band',
    rows.length === 0
      ? 'No tranches to rate-check'
      : outside === 0
        ? `Every tranche within ±${bandPct}% of ₹${ref}`
        : `${outside} tranche(s) outside the band or mis-multiplied`,
    findings,
    { referenceRate: ref, bandPct, rows, outside } satisfies FxOutput,
  )
}

// ---- Assembling the per-tranche verdict -------------------------------------

/** Turns the four agents' outputs into one row per tranche.
 *
 *  Severity is fixed per gate, not per file: the LRS ceiling and Form A2 are
 *  `statutory` wherever they appear, visa sequencing and the rate band are
 *  `overridable`. That mapping is the whole of the authority model and it lives
 *  in one place on purpose. */
export function trancheVerdicts(app: Application): TrancheVerdict[] {
  const lrs = runLrsAggregate(app).output as LrsOutput
  const fema = runFemaCompliance(app).output as FemaOutput
  const visa = runVisaGating(app).output as VisaOutput
  const fx = runFxBand(app).output as FxOutput

  return (app.tranches ?? []).map((t) => {
    const femaRow = fema.perTranche.find((p) => p.trancheId === t.id)
    const fxRow = fx.rows.find((r) => r.trancheId === t.id)

    // A SETTLED tranche is not re-gated, on any of the four checks.
    //
    // `released` and `remitted` mean the money has gone. Reporting a hold on it
    // states a problem no officer can act on and none of the gates are asking a
    // live question: Form A2 was filed or the remittance could not have been
    // made, and the rate used is now history rather than a rate to approve. The
    // LRS aggregate still COUNTS these tranches — they consumed the year's
    // headroom — which is a different thing from gating them.
    const settled = t.status === 'remitted' || t.status === 'released'
    const settledNote = `Already ${t.status}; not re-gated.`

    const gates: ComputedGate[] = [
      {
        ref: 'VAL-CRS-21',
        label: 'LRS aggregate within cap',
        // The FILE's verdict, repeated onto every tranche. A tranche cannot be
        // individually inside a cap the schedule as a whole breaches.
        passed: settled || lrs.within,
        severity: 'statutory',
        detail: settled
          ? settledNote
          : lrs.within
          ? `USD ${lrs.headroomUsd.toLocaleString('en-US')} headroom across ${lrs.counted} tranche(s).`
          : `Schedule totals USD ${lrs.scheduledUsd.toLocaleString('en-US')} against a USD ${lrs.capUsd.toLocaleString('en-US')} cap.`,
        agent: 'lrs_aggregate',
      },
      {
        ref: 'VAL-CRS-22',
        label: 'Form A2 + FEMA declaration',
        passed: settled || femaRow?.a2OnFile === true,
        severity: 'statutory',
        detail: settled
          ? settledNote
          : femaRow?.a2OnFile === true
            ? `On file. Purpose Education-Abroad, payee ${femaRow.payee}.`
            : `Absent. Payee would be ${femaRow?.payee ?? 'unknown'}.`,
        agent: 'fema_compliance',
      },
      {
        ref: 'VAL-CRS-23',
        label: 'Visa endorsement',
        // A settled tranche is not re-gated — see `runVisaGating`.
        passed: settled || visa.endorsed || !visa.held.includes(t.n),
        severity: 'overridable',
        detail: visa.endorsed
          ? `Endorsed, per ${visa.source}.`
          : visa.held.includes(t.n)
            ? `Not endorsed, per ${visa.source}.`
            : `Already ${t.status}; not re-gated.`,
        agent: 'visa_gating',
      },
      {
        ref: 'VAL-CRS-24',
        label: 'Rate within band',
        passed: settled || (fxRow ? fxRow.withinBand && fxRow.arithmeticOk : true),
        severity: 'overridable',
        detail: settled
          ? settledNote
          : fxRow
          ? `₹${fxRow.fxUsed} is ${fxRow.deviationPct > 0 ? '+' : ''}${fxRow.deviationPct}% against ₹${fx.referenceRate} (±${fx.bandPct}% allowed).`
          : 'No rate on this tranche.',
        agent: 'fx_band',
      },
    ]

    const failing = gates.filter((g) => !g.passed)
    return {
      trancheId: t.id,
      n: t.n,
      type: t.type,
      releasable: failing.length === 0,
      gates,
      statutoryBlocks: failing.filter((g) => g.severity === 'statutory').map((g) => g.ref),
    }
  })
}

// ---- 3.5 Guardrail ----------------------------------------------------------

export interface DisbursementGuardrailOutput {
  deterministic: boolean
  /** No agent wrote to the record it was reading. */
  noWriteBack: boolean
  /** The aggregate cap check differs from a per-tranche one on a file rigged to
   *  split a breach across instalments. If this goes false the aggregate view
   *  has stopped being load-bearing. */
  aggregateBeatsPerTranche: boolean
  /** Nothing this module produced can move money — asserted by running a full
   *  assessment and requiring every tranche status to be untouched. */
  cannotRelease: boolean
  offences: string[]
}

/** The rigged file for the negative control.
 *
 *  Four tranches, each USD 70,000. Every one is comfortably inside the USD
 *  250,000 cap; together they are USD 30,000 over it. A per-tranche check passes
 *  this file. The aggregate must not. Built from a real application so every
 *  other field is realistic, and never persisted anywhere. */
function riggedSplitFile(app: Application): Application {
  const per = Math.floor(POLICY.lrsCapUsd * 0.28) // 4 × 28% = 112% of the cap
  const tranches: Tranche[] = [1, 2, 3, 4].map((n) => ({
    id: `RIG-${n}`,
    n,
    type: 'Tuition-SWIFT-to-university',
    semester: `Rigged ${n}`,
    amountUsd: per,
    amountInr: Math.round(per * POLICY.fxReference),
    fxUsed: POLICY.fxReference,
    gates: [],
    status: 'scheduled',
    a2FemaOnFile: true,
  }))
  return { ...app, tranches }
}

export function runDisbursementGuardrail(app: Application): AgentResult {
  const offences: string[] = []

  // Determinism — the four agents twice.
  const a = strip(runLrsAggregate(app), runFemaCompliance(app), runVisaGating(app), runFxBand(app))
  const b = strip(runLrsAggregate(app), runFemaCompliance(app), runVisaGating(app), runFxBand(app))
  const deterministic = a === b
  if (!deterministic) offences.push('the four checks did not return the same answer twice')

  // Write-back — the agents are pure, so a deep compare of the input is the
  // whole test. This matters more here than anywhere else in the codebase: the
  // thing on the other side of these gates is a wire transfer.
  const before = JSON.stringify(app)
  runLrsAggregate(app)
  runFemaCompliance(app)
  runVisaGating(app)
  runFxBand(app)
  trancheVerdicts(app)
  const noWriteBack = JSON.stringify(app) === before
  if (!noWriteBack) offences.push('an agent mutated the application it was reading')

  // Cannot release — no tranche changed status or gate array under a full run.
  const statusesBefore = JSON.stringify((app.tranches ?? []).map((t) => [t.status, t.gates, t.a2FemaOnFile]))
  trancheVerdicts(app)
  const statusesAfter = JSON.stringify((app.tranches ?? []).map((t) => [t.status, t.gates, t.a2FemaOnFile]))
  const cannotRelease = statusesBefore === statusesAfter
  if (!cannotRelease) offences.push('a tranche status or gate moved during assessment')

  // THE NEGATIVE CONTROL. See `perTrancheLrsWouldPass`.
  const rigged = riggedSplitFile(app)
  const perTranchePasses = perTrancheLrsWouldPass(rigged)
  const aggregateBlocks = !(runLrsAggregate(rigged).output as LrsOutput).within
  const aggregateBeatsPerTranche = perTranchePasses && aggregateBlocks
  if (!aggregateBeatsPerTranche) {
    offences.push(
      'the aggregate LRS check no longer differs from a per-tranche one on a file rigged to split a breach — the control is dead',
    )
  }

  const clean = deterministic && noWriteBack && cannotRelease && aggregateBeatsPerTranche
  return result(
    'disbursement_guardrail',
    clean ? 'The four only measured; nothing moved' : `${offences.length} breach(es)`,
    clean ? [] : offences.map((o) => finding('disbursement_guardrail', 'block', 'bank', 'Release-check breach', o)),
    {
      deterministic,
      noWriteBack,
      aggregateBeatsPerTranche,
      cannotRelease,
      offences,
    } satisfies DisbursementGuardrailOutput,
  )
}

/** Findings carry a module-counter id that advances between runs, so
 *  determinism is compared on everything else — the same `strip` the document,
 *  onboarding and credit harnesses use. */
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

// ---- The whole swarm --------------------------------------------------------

export function runDisbursementSwarm(app: Application): Record<string, AgentResult> {
  return {
    lrs_aggregate: runLrsAggregate(app),
    fema_compliance: runFemaCompliance(app),
    visa_gating: runVisaGating(app),
    fx_band: runFxBand(app),
    disbursement_guardrail: runDisbursementGuardrail(app),
  }
}

export interface DisbursementVerdictOutput {
  tranches: TrancheVerdict[]
  lrsHeadroomUsd: number
  /** Any tranche held by something no officer can clear. */
  anyStatutoryBlock: boolean
  headlines: { agent: string; headline: string }[]
}

export function disbursementVerdictFrom(
  app: Application,
  results: Record<string, AgentResult>,
): DisbursementVerdictOutput {
  const lrs = results.lrs_aggregate?.output as LrsOutput | undefined
  const verdicts = trancheVerdicts(app)
  return {
    tranches: verdicts,
    lrsHeadroomUsd: lrs?.headroomUsd ?? 0,
    anyStatutoryBlock: verdicts.some((v) => v.statutoryBlocks.length > 0),
    headlines: Object.values(results).map((r) => ({ agent: r.agent, headline: r.headline })),
  }
}

// ---- Releasability, with overrides ------------------------------------------

export interface Releasability {
  ok: boolean
  /** Gates still holding this tranche after overrides are applied. */
  blocking: ComputedGate[]
  /** Of those, the ones no officer can clear. */
  statutory: ComputedGate[]
}

/** Whether one tranche may be released, computed LIVE.
 *
 *  Deliberately recomputed from the application rather than read off
 *  `app.disbursementVerdict`. The verdict is a record of what the agents said
 *  when they last ran; releasing money on a stale copy of that is exactly the
 *  failure `declarationGate` was written to avoid ("a stored copy of a boolean
 *  that is recomputable is a copy that can go stale"). Only the OVERRIDES are
 *  read from the record, because an override is a human act with a timestamp
 *  and is not recomputable from anything. */
export function releasability(app: Application, trancheId: string): Releasability {
  const v = trancheVerdicts(app).find((x) => x.trancheId === trancheId)
  if (!v) return { ok: false, blocking: [], statutory: [] }

  const overrides = app.disbursementVerdict?.overrides ?? []
  const isOverridden = (g: ComputedGate) =>
    g.severity === 'overridable' &&
    overrides.some((o) => o.trancheId === trancheId && o.ref === g.ref)

  const blocking = v.gates.filter((g) => !g.passed && !isOverridden(g))
  return {
    ok: blocking.length === 0,
    blocking,
    statutory: blocking.filter((g) => g.severity === 'statutory'),
  }
}

/** Can this specific gate be overridden at all? The store asks before writing
 *  an override, so a statutory block is refused at the verb rather than being
 *  accepted and then quietly ignored at release. */
export function isOverridable(app: Application, trancheId: string, ref: string): boolean {
  const v = trancheVerdicts(app).find((x) => x.trancheId === trancheId)
  return v?.gates.find((g) => g.ref === ref)?.severity === 'overridable'
}
