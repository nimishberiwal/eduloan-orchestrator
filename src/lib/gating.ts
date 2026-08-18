// ============================================================================
// Forward-gate evaluation (§4). Returns failing gate items with their verbatim
// fail messages so the UI can show them inline.
// ============================================================================
import { gateForExit } from '@/data/stages'
import { VALIDATION_BY_ID, renderMessage } from '@/data/validations'
import type { Application, StageId } from '@/types'

export interface GateFailure {
  id: string
  title: string
  message: string
  kind: 'validation' | 'bucket' | 'checker' | 'covenant' | 'onboarding' | 'collateral'
}

export interface GateEvaluation {
  exit: StageId
  description: string
  nonOverridable: boolean
  passed: boolean
  failures: GateFailure[]
}

function isResolved(app: Application, valId: string): boolean {
  const r = app.validations.find((v) => v.catalogueId === valId)
  if (!r) return true // rule not applicable to this app => treated as resolved
  return r.status === 'pass' || r.status === 'waived'
}

export function evaluateGate(app: Application): GateEvaluation | null {
  const stage = app.stage
  if (!/^S0[1-9]$|^S1[0-3]$/.test(stage)) return null
  const spec = gateForExit(stage as StageId)
  if (!spec) return null

  const failures: GateFailure[] = []

  // Validation-driven gates
  for (const valId of spec.requiredValidations) {
    if (!isResolved(app, valId)) {
      const def = VALIDATION_BY_ID[valId]
      const result = app.validations.find((v) => v.catalogueId === valId)
      failures.push({
        id: valId,
        title: def?.title ?? valId,
        message: result
          ? renderMessage(def?.failMessage ?? '', result.tokens)
          : def?.failMessage ?? '',
        kind: 'validation',
      })
    }
  }

  // S04: bucket-driven — all buckets with required_by_stage = sanction at least uploaded
  if (stage === 'S04') {
    const notUploaded = app.buckets.filter((b) => b.requiredByStage === 'sanction' && b.present)
    for (const b of notUploaded) {
      const docs = app.documents.filter((d) => d.bucketId === b.id && d.mandate !== 'O')
      const anyPending = docs.some((d) => d.status === 'requested')
      if (anyPending) {
        failures.push({
          id: b.id,
          title: `${b.code} ${b.title}`,
          message: `Bucket ${b.code} (${b.title}) has documents still requested — must be at least uploaded before exiting S04.`,
          kind: 'bucket',
        })
      }
    }
  }

  // S11 → S13 style covenant hard-blocks: any open covenant whose clearBy is
  // "first disbursement" / "final disbursement" blocks the move out of S11/S12.
  if (stage === 'S11' || stage === 'S12') {
    const blocking = app.covenants.filter(
      (c) => c.status === 'open' && /disbursement/i.test(c.clearBy),
    )
    for (const c of blocking) {
      failures.push({
        id: c.id,
        title: `${c.id} ${c.title}`,
        message: `Open covenant ${c.id} — "${c.title}" hard-blocks ${c.clearBy}.`,
        kind: 'covenant',
      })
    }
  }

  // S05 → S06: the onboarding orchestrator's readiness verdict (§v5).
  //
  // This is the handover. `defaultDeptForStage` reassigns the file from Ops to
  // Credit at S06, so S05's exit is the moment collection ends and assessment
  // begins — and the point at which "is this file complete enough" stops being
  // a rhetorical question.
  //
  // Absence of a verdict is NOT a failure. A file that has never been assessed
  // is held by its validations like any other; inventing a block for one the
  // orchestrator has not looked at would make every legacy file unmovable.
  // An override clears the gate WITHOUT rewriting the verdict — `ready` stays
  // false and `overriddenBy` records who disagreed. The file moves; the record
  // does not pretend it was complete.
  if (
    stage === 'S05' &&
    app.onboardingVerdict &&
    !app.onboardingVerdict.ready &&
    !app.onboardingVerdict.overriddenBy
  ) {
    const v = app.onboardingVerdict
    failures.push({
      id: 'ONBOARDING',
      title: 'Not complete enough to hand to credit',
      message:
        v.blockingReasons.length > 0
          ? v.blockingReasons.join(' · ')
          : 'The onboarding assessment has not cleared this file.',
      kind: 'onboarding',
    })
  }

  // S09 → S10: the collateral orchestrator's verdict (§v5).
  //
  // Conditional by construction — an unsecured file gets `applicable: false`
  // and is never held here. The gate's own description allows an unperfected
  // charge to leave S09 carried by COV-04, and the orchestrator honours that:
  // what it blocks on is a shortfall, an adverse title, or a charge that is
  // neither perfected nor carried.
  //
  // Same shape as S05: absence of a verdict is not a failure, and an override
  // clears the gate WITHOUT rewriting the verdict.
  if (
    stage === 'S09' &&
    app.collateralVerdict &&
    app.collateralVerdict.applicable &&
    !app.collateralVerdict.ready &&
    !app.collateralVerdict.overriddenBy
  ) {
    const v = app.collateralVerdict
    failures.push({
      id: 'COLLATERAL',
      title: 'The security does not stand up as it is',
      message:
        v.blockingReasons.length > 0
          ? v.blockingReasons.join(' · ')
          : 'The collateral assessment has not cleared this file.',
      kind: 'collateral',
    })
  }

  // S10: maker-checker must be countersigned
  if (stage === 'S10' && app.pendingChecker) {
    failures.push({
      id: 'CHECKER',
      title: 'Maker-checker countersign pending',
      message: `Decision by ${app.pendingChecker.maker} awaits checker countersign (different officer, same-or-higher authority).`,
      kind: 'checker',
    })
  }

  return {
    exit: stage as StageId,
    description: spec.description,
    nonOverridable: spec.nonOverridable,
    passed: failures.length === 0,
    failures,
  }
}
