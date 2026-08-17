// ============================================================================
// HITL detection (§v3) — derives review cases from live application state.
//
// Cases are DERIVED, not stored: the queue always reflects the current file. An
// officer's decision (cleared / escalated / declined) is what gets persisted,
// keyed by appId + trigger.
// ============================================================================
import type { Application, HitlCase, HitlStatus, HitlTrigger } from '@/types'
import { HITL_BY_TRIGGER, HITL_DEFS } from '@/data/hitl'
import { isTerminalStage } from '@/lib/reports'
import { nowIso } from '@/lib/clock'

/** Persisted officer decisions, keyed `appId|trigger`. */
export type HitlDecisions = Record<string, {
  status: HitlStatus
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
}>

export function hitlKey(appId: string, trigger: HitlTrigger): string {
  return `${appId}|${trigger}`
}

/** 1-based S-stage position; terminals rank high. */
function stageRank(stage: Application['stage']): number {
  const m = /^S(\d\d)$/.exec(String(stage))
  return m ? parseInt(m[1], 10) : 99
}

function val(app: Application, id: string): string | undefined {
  return app.validations.find((v) => v.catalogueId === id)?.status
}
function extracted(app: Application, label: string): string | undefined {
  return app.extracted.find((f) => f.label === label)?.extractedValue
}

/** Which HITL triggers currently fire on this application. */
export function detectTriggers(app: Application): HitlTrigger[] {
  if (isTerminalStage(app.stage)) return []
  const out: HitlTrigger[] = []

  // Programmatic accreditation claimed but unlisted — VAL-INT-09 / VAL-CRS-08.
  if (val(app, 'VAL-INT-09') === 'fail' || val(app, 'VAL-CRS-08') === 'fail') {
    out.push('programmatic_accreditation_unlisted')
  }

  // Premier overlay borderline — the overlay claim failed, or the ask sits
  // within 10% of the ceiling (an edge call a human should make).
  const overlayFailed = val(app, 'VAL-CRS-09') === 'fail'
  const nearCeiling =
    app.overlayCeilingInr != null &&
    app.askInr <= app.overlayCeilingInr &&
    app.askInr >= app.overlayCeilingInr * 0.9
  if (overlayFailed || nearCeiling) out.push('premier_overlay_borderline')

  // Credential evaluation pending / borderline — VAL-CRS-12 or VAL-EXT-09.
  // NOTE: a rule reads `pending` both when its outcome is genuinely awaited AND
  // when the file simply hasn't reached its trigger stage yet. Only the former
  // is a review case, so the stage gate is checked first.
  const credOutcome = extracted(app, 'credential_evaluation_outcome')
  const reachedCredStage = stageRank(app.stage) >= 7 // VAL-EXT-09 / VAL-CRS-12 trigger at S07
  if (
    val(app, 'VAL-CRS-12') === 'fail' ||
    val(app, 'VAL-EXT-09') === 'fail' ||
    (reachedCredStage && val(app, 'VAL-EXT-09') === 'pending') ||
    (credOutcome && /pending|conditions/i.test(credOutcome))
  ) {
    out.push('credential_eval_pending')
  }

  // Sponsored programme — a sponsorship amount is declared.
  const sponsor = extracted(app, 'sponsor_amount')
  if ((sponsor && sponsor !== '0') || val(app, 'VAL-EXT-16') === 'fail' || val(app, 'VAL-CRS-15') === 'fail') {
    out.push('sponsored_mba_verification')
  }

  // Test-optional admit with no entrance score.
  if (extracted(app, 'test_optional_admission') === 'true' || val(app, 'VAL-CRS-05') === 'fail') {
    out.push('test_optional_no_entrance')
  }

  // Existing education loan on the bureau — VAL-CRS-25 / VAL-EXT-21.
  if (val(app, 'VAL-CRS-25') === 'fail' || val(app, 'VAL-EXT-21') === 'fail') {
    out.push('existing_ug_el_exposure')
  }

  // Conditional admit.
  if (extracted(app, 'admission_status') === 'Conditional' || val(app, 'VAL-CRS-11') === 'fail') {
    out.push('conditional_admit')
  }

  return out
}

/** Build the live queue across the portfolio, applying persisted decisions. */
export function buildHitlQueue(apps: Application[], decisions: HitlDecisions): HitlCase[] {
  const cases: HitlCase[] = []
  for (const app of apps) {
    for (const trigger of detectTriggers(app)) {
      const def = HITL_BY_TRIGGER[trigger]
      const d = decisions[hitlKey(app.appId, trigger)]
      cases.push({
        id: hitlKey(app.appId, trigger),
        appId: app.appId,
        trigger,
        title: def.title,
        detail: def.question,
        raisedAt: app.stageEnteredAt,
        stage: app.stage,
        status: d?.status ?? 'open',
        owner: def.owner,
        resolution: d?.resolution,
        resolvedAt: d?.resolvedAt,
        resolvedBy: d?.resolvedBy,
      })
    }
  }
  // Unresolved first, then by severity, then newest.
  const sev = (t: HitlTrigger) => ({ critical: 0, warn: 1, info: 2 }[HITL_BY_TRIGGER[t].severity])
  return cases.sort((a, b) => {
    const openA = a.status === 'open' || a.status === 'in_review' ? 0 : 1
    const openB = b.status === 'open' || b.status === 'in_review' ? 0 : 1
    if (openA !== openB) return openA - openB
    const s = sev(a.trigger) - sev(b.trigger)
    if (s !== 0) return s
    return b.raisedAt.localeCompare(a.raisedAt)
  })
}

export function openHitlCount(apps: Application[], decisions: HitlDecisions): number {
  return buildHitlQueue(apps, decisions).filter((c) => c.status === 'open' || c.status === 'in_review').length
}

/** Open cases for one application — used by the App-360 badge. */
export function hitlForApp(app: Application, decisions: HitlDecisions): HitlCase[] {
  return buildHitlQueue([app], decisions)
}

export { HITL_DEFS, nowIso }
