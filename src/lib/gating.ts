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
  kind: 'validation' | 'bucket' | 'checker' | 'covenant'
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
