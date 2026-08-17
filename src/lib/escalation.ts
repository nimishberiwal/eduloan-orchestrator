// ============================================================================
// Assignment SLA & escalation matrix (§v2 req 10).
//
// "If a user does not complete the task assigned to them within 48 hours it is
//  automatically logged and escalated to their manager."
//
// Design note: the SLA measures BANK-side responsiveness. A file waiting on the
// customer or a third party is not the assignee's delay, so its clock is
// PAUSED. Without that rule almost every aged file would read as breached and
// the escalation register would be meaningless.
// ============================================================================
import type { Application, EscalationEvent, EscalationRung, OfficerRef, SlaState } from '@/types'
import { ESCALATION_MATRIX, matrixFor } from '@/data/rules'
import { OFFICER_BY_ID, escalationChain, resolveOfficer } from '@/data/org'
import { POLICY } from '@/data/policy'
import { hoursSince, nowIso } from '@/lib/clock'
import { isTerminalStage } from '@/lib/reports'

export interface SlaInfo {
  state: SlaState | 'paused'
  hoursElapsed: number
  hoursRemaining: number
  paused: boolean
  pauseReason?: string
}

export function slaFor(app: Application, now: string = nowIso()): SlaInfo {
  const elapsed = Math.max(0, hoursSince(app.assignment.assignedAt, now))
  const limit = app.assignment.slaHours || POLICY.assignmentSlaHours

  if (app.blocker.kind === 'customer' || app.blocker.kind === 'third_party') {
    return {
      state: 'paused',
      hoursElapsed: elapsed,
      hoursRemaining: limit - elapsed,
      paused: true,
      pauseReason: `awaiting ${app.blocker.kind === 'customer' ? 'the customer' : 'a third party'}`,
    }
  }

  const state: SlaState =
    elapsed >= limit ? 'breached'
    : elapsed >= POLICY.assignmentDueSoonHours ? 'due_soon'
    : 'on_track'

  return { state, hoursElapsed: elapsed, hoursRemaining: limit - elapsed, paused: false }
}

/** Which escalation rung an elapsed duration has reached (null = none yet). */
export function rungFor(app: Application, hoursElapsed: number): EscalationRung | null {
  const matrix = matrixFor(app.owner.department)
  let hit: EscalationRung | null = null
  for (const rung of matrix) {
    if (hoursElapsed >= rung.afterHours) hit = rung
  }
  return hit
}

/** Resolve the officer a given rung escalates to, walking the reporting line. */
export function escalationTarget(app: Application, rung: EscalationRung): OfficerRef | null {
  const officer = resolveOfficer(app.owner)
  if (!officer) return null
  const chain = escalationChain(officer.id)
  // Prefer an exact title match ("Team Lead" / "Department Head"), else step up
  // the chain by level.
  const byTitle = chain.find((o) => o.title.toLowerCase().includes(rung.toTitle.toLowerCase()))
  return byTitle ?? chain[Math.min(rung.level - 1, chain.length - 1)] ?? null
}

export function escalationChainFor(app: Application): OfficerRef[] {
  const officer = resolveOfficer(app.owner)
  return officer ? escalationChain(officer.id) : []
}

export interface SweepResult {
  events: EscalationEvent[]
  byApp: Record<string, number> // appId → new escalation level
}

/** Detect newly-breached assignments and produce escalation events.
 *  Only escalates one rung PAST the level already recorded, so repeated sweeps
 *  are idempotent. */
export function sweepEscalations(
  apps: Application[],
  now: string = nowIso(),
  seq: () => string = () => `ESC-${Math.random()}`,
): SweepResult {
  const events: EscalationEvent[] = []
  const byApp: Record<string, number> = {}

  for (const app of apps) {
    if (isTerminalStage(app.stage)) continue
    const sla = slaFor(app, now)
    if (sla.paused || sla.state !== 'breached') continue

    const rung = rungFor(app, sla.hoursElapsed)
    if (!rung) continue
    if (rung.level <= app.assignment.escalationLevel) continue // already escalated

    const from = resolveOfficer(app.owner)
    const to = escalationTarget(app, rung)
    if (!from || !to) continue

    events.push({
      id: seq(),
      ts: now,
      appId: app.appId,
      stage: app.stage,
      fromOfficerId: from.id,
      toOfficerId: to.id,
      level: rung.level,
      reason: `No action for ${Math.round(sla.hoursElapsed)}h against a ${app.assignment.slaHours}h SLA at ${app.stage}`,
      hoursOverdue: Math.round(sla.hoursElapsed - app.assignment.slaHours),
    })
    byApp[app.appId] = rung.level
  }

  return { events, byApp }
}

export function officerName(id: string): string {
  return OFFICER_BY_ID[id]?.name ?? id
}
export function officerTitle(id: string): string {
  return OFFICER_BY_ID[id]?.title ?? '—'
}

export { ESCALATION_MATRIX }
