// ============================================================================
// Stage-rule evaluation engine (§v2 req 2).
//
// Idempotency is not optional: `firedKey` prevents a second sweep from sending
// the same 200 nudges again.
// ============================================================================
import type { Application, RuleAction, RuleCondition, Stage, StageRule } from '@/types'
import { daysBetween, daysInStage, sanctionCountdown } from '@/lib/format'
import { hoursSince, nowIso } from '@/lib/clock'
import { isTerminalStage } from '@/lib/reports'

export interface PlannedAction {
  ruleId: string
  ruleName: string
  severity: StageRule['severity']
  appId: string
  studentName: string
  stage: Stage
  action: RuleAction
  detail: string
}

function fieldValue(app: Application, field: RuleCondition['field'], now: string): number | string {
  switch (field) {
    case 'daysInStage': return daysInStage(app.stageEnteredAt)
    case 'hoursSinceAssigned': return Math.round(hoursSince(app.assignment.assignedAt, now))
    case 'daysSinceCustomerActivity':
      return app.lastCustomerActivityAt ? Math.max(0, daysBetween(now, app.lastCustomerActivityAt)) : 0
    case 'askInr': return app.askInr
    case 'blockerKind': return app.blocker.kind
    case 'status': return app.status
    case 'openDeviations': return app.deviations.filter((d) => d.status === 'open').length
    case 'docsRequested': return app.documents.filter((d) => d.status === 'requested').length
    case 'sanctionDaysLeft': {
      const { days, rag } = sanctionCountdown(app.sanctionExpiryDate)
      return rag == null || isNaN(days) ? 99999 : days
    }
    case 'nudgeCount': return app.comms.filter((c) => c.templateId === 'nudge').length
    case 'failedIntegrations': return app.integrations.filter((i) => i.status === 'failed').length
    default: return 0
  }
}

export function evaluateCondition(app: Application, c: RuleCondition, now: string): boolean {
  const v = fieldValue(app, c.field, now)
  if (typeof c.value === 'string') {
    return c.op === 'eq' ? String(v) === c.value : false
  }
  const n = Number(v)
  switch (c.op) {
    case 'gt': return n > c.value
    case 'gte': return n >= c.value
    case 'lt': return n < c.value
    case 'lte': return n <= c.value
    case 'eq': return n === c.value
    default: return false
  }
}

/** Rules that currently match. Terminal applications are HARD-SKIPPED so that
 *  automation can never touch a closed file (this also protects the curated
 *  acceptance applications APP-2613 / APP-2614). */
export function matchRules(app: Application, rules: StageRule[], now: string = nowIso()): StageRule[] {
  if (isTerminalStage(app.stage)) return []
  return rules.filter((r) => {
    if (!r.enabled) return false
    if (r.stage !== 'ANY' && r.stage !== app.stage) return false
    return r.when.every((c) => evaluateCondition(app, c, now))
  })
}

export function planActions(app: Application, rule: StageRule, now: string = nowIso()): PlannedAction[] {
  return rule.then.map((action) => ({
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    appId: app.appId,
    studentName: app.studentName,
    stage: app.stage,
    action,
    detail: describe(app, rule, action, now),
  }))
}

function describe(app: Application, rule: StageRule, action: RuleAction, now: string): string {
  const facts = rule.when
    .map((c) => `${c.field} ${c.op} ${c.value} (actual ${fieldValue(app, c.field, now)})`)
    .join('; ')
  return `${action.label} — ${facts}`
}

/** Stable key so an already-applied rule never fires twice for the same file at
 *  the same stage. */
export function firedKey(ruleId: string, appId: string, stage: Stage): string {
  return `${ruleId}|${appId}|${stage}`
}

export interface SweepPlan {
  auto: PlannedAction[]
  queued: PlannedAction[]
  skipped: number
  matchedApps: number
}

export function sweepRules(
  apps: Application[],
  rules: StageRule[],
  alreadyFired: Set<string>,
  now: string = nowIso(),
): SweepPlan {
  const auto: PlannedAction[] = []
  const queued: PlannedAction[] = []
  let skipped = 0
  const matched = new Set<string>()

  for (const app of apps) {
    for (const rule of matchRules(app, rules, now)) {
      const key = firedKey(rule.id, app.appId, app.stage)
      if (alreadyFired.has(key)) {
        skipped++
        continue
      }
      matched.add(app.appId)
      for (const planned of planActions(app, rule, now)) {
        if (planned.action.destructive) queued.push(planned)
        else auto.push(planned)
      }
    }
  }

  return { auto, queued, skipped, matchedApps: matched.size }
}
