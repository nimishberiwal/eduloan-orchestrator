// ============================================================================
// Shared filtering (search + saved-filter predicates) for Kanban & Queues.
// ============================================================================
import type { Application, FilterClause, FilterField, FilterPredicate, RoleId } from '@/types'
import { agingRag, daysInStage, sanctionCountdown } from '@/lib/format'
import { effectiveBand } from '@/lib/doa'
import { deptOf } from '@/lib/stateMachine'
import { BRANCH_BY_ID } from '@/data/org'
import { amountBandOf } from '@/lib/groupBy'
import { hoursSince } from '@/lib/clock'
import { POLICY } from '@/data/policy'

export function matchesSearch(app: Application, q: string): boolean {
  if (!q.trim()) return true
  const s = q.toLowerCase()
  return (
    app.appId.toLowerCase().includes(s) ||
    app.studentName.toLowerCase().includes(s) ||
    app.university.toLowerCase().includes(s) ||
    app.program.toLowerCase().includes(s) ||
    // §v2 — the portfolio is now branch/officer aware
    app.owner.officer.toLowerCase().includes(s) ||
    (BRANCH_BY_ID[app.branchId]?.name.toLowerCase().includes(s) ?? false) ||
    (BRANCH_BY_ID[app.branchId]?.city.toLowerCase().includes(s) ?? false)
  )
}

// ---- Composable clauses (§v2 req 9) ----------------------------------------
/** Extract the comparable value for a clause field. */
function fieldValue(app: Application, field: FilterField): string | number | boolean {
  switch (field) {
    case 'stage': return String(app.stage)
    case 'status': return app.status
    case 'department': return app.owner.department
    case 'officer': return app.owner.officer
    case 'branchId': return app.branchId
    case 'city': return BRANCH_BY_ID[app.branchId]?.city ?? ''
    case 'region': return BRANCH_BY_ID[app.branchId]?.region ?? ''
    case 'channel': return app.channel
    case 'tier': return app.tier
    case 'band': return effectiveBand(app)
    case 'blocker': return app.blocker.kind
    case 'intake': return app.intake
    case 'university': return app.university
    case 'program': return app.program
    case 'askInr': return app.askInr
    case 'daysInStage': return daysInStage(app.stageEnteredAt)
    case 'slaState': return slaStateOf(app)
    case 'outcomeKind': return app.outcome?.kind ?? 'open'
    case 'outcomeCode': return app.outcome?.code ?? ''
    case 'amountBand': return amountBandOf(app.askInr)
    case 'hasDeviation': return app.deviations.some((d) => d.status === 'open')
    case 'escalated': return (app.assignment?.escalationLevel ?? 0) > 0
    default: return ''
  }
}

/** SLA state is computed here (rather than lib/escalation) so filters have no
 *  forward dependency; escalation.ts reuses the same rule in Phase 7. */
function slaStateOf(app: Application): string {
  // The SLA measures BANK-side responsiveness — a file waiting on the customer
  // or a third party is not the assignee's delay, so its clock is paused.
  if (app.blocker.kind === 'customer' || app.blocker.kind === 'third_party') return 'paused'
  if (!app.assignment) return 'on_track'
  const elapsed = hoursSince(app.assignment.assignedAt)
  if (elapsed >= app.assignment.slaHours) return 'breached'
  if (elapsed >= POLICY.assignmentDueSoonHours) return 'due_soon'
  return 'on_track'
}
export { slaStateOf }

export function matchesClause(app: Application, c: FilterClause): boolean {
  const v = fieldValue(app, c.field)
  switch (c.op) {
    case 'eq': return String(v) === String(c.value)
    case 'in': return Array.isArray(c.value) && (c.value as string[]).map(String).includes(String(v))
    case 'gte': return Number(v) >= Number(c.value)
    case 'lte': return Number(v) <= Number(c.value)
    case 'between': {
      const [lo, hi] = c.value as [number, number]
      return Number(v) >= lo && Number(v) <= hi
    }
    case 'contains': return String(v).toLowerCase().includes(String(c.value).toLowerCase())
    default: return true
  }
}

export function matchesClauses(app: Application, clauses: FilterClause[]): boolean {
  return clauses.every((c) => matchesClause(app, c))
}

export function matchesFilter(app: Application, f: FilterPredicate, role: RoleId): boolean {
  switch (f) {
    case 'my_queue':
      return app.owner.department === deptOf(role)
    case 'pending_customer':
      return app.blocker.kind === 'customer'
    case 'aging_red':
      return agingRag(daysInStage(app.stageEnteredAt)) === 'red'
    case 'deviations_open':
      return app.deviations.some((d) => d.status === 'open')
    case 'pending_checker':
      return app.status === 'pending_checker' || !!app.pendingChecker
    case 'sanction_expiring_30': {
      const { days, rag } = sanctionCountdown(app.sanctionExpiryDate)
      return rag != null && !isNaN(days) && days <= 30
    }
    case 'band_2':
      return effectiveBand(app) === 'Band-2' || effectiveBand(app) === 'Committee'
    case 'tier3_secured':
      return app.securedConstruct
    default:
      return true
  }
}

export function applyFilters(
  apps: Application[],
  search: string,
  filters: FilterPredicate[],
  role: RoleId,
  clauses: FilterClause[] = [],
): Application[] {
  return apps.filter(
    (a) =>
      matchesSearch(a, search) &&
      filters.every((f) => matchesFilter(a, f, role)) &&
      matchesClauses(a, clauses),
  )
}
