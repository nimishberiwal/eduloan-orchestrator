// ============================================================================
// Portfolio rollups (§v2 req 6, 7, 8).
//
// These were previously private compute* functions inside Analytics.tsx. They
// live here so Analytics (on-screen) and Reports (export) consume ONE
// implementation — and every rollup now carries ₹ value alongside count.
// ============================================================================
import type { Application, ClosureKind, Stage, StageId } from '@/types'
import { STAGES } from '@/data/stages'
import { CODE_LABEL } from '@/data/reasonCodes'
import { agingRag, daysBetween, daysInStage, sanctionCountdown } from '@/lib/format'
import { effectiveBand } from '@/lib/doa'
import { BRANCH_BY_ID } from '@/data/org'
import { median } from '@/lib/groupBy'
import { slaStateOf } from '@/lib/filters'

export const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id)
const TERMINALS: Stage[] = ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'DISBURSED_ACTIVE']
export const isTerminalStage = (s: Stage) => TERMINALS.includes(s)

export interface CountValue {
  count: number
  valueInr: number
}

function cv(apps: Application[]): CountValue {
  return { count: apps.length, valueInr: apps.reduce((t, a) => t + a.askInr, 0) }
}

// ---- Stage rollup — the "₹40cr at S1, ₹100cr at S2" answer (req 6) ---------
export interface StageRow extends CountValue {
  stage: StageId
  name: string
  medianDays: number
  blocked: number
}

export function stageValueRollup(apps: Application[]): StageRow[] {
  return STAGES.map((s) => {
    const list = apps.filter((a) => a.stage === s.id)
    return {
      stage: s.id,
      name: s.name,
      ...cv(list),
      medianDays: median(list.map((a) => daysInStage(a.stageEnteredAt))),
      blocked: list.filter((a) => a.blocker.kind !== 'none').length,
    }
  })
}

// ---- Funnel: how far applications got, by count AND exposure ---------------
export interface FunnelRow extends CountValue {
  stage: StageId
  name: string
  pctReached: number
  dropOff: number | null
}

export function funnelRollup(apps: Application[]): FunnelRow[] {
  const reached = STAGE_ORDER.map((sid, idx) => {
    const list = apps.filter((a) =>
      a.stageHistory.some((h) => STAGE_ORDER.indexOf(h.stage as StageId) >= idx),
    )
    return { stage: sid, name: STAGES[idx].name, ...cv(list) }
  })
  const first = reached[0]?.count || 1
  let prev = first
  return reached.map((r, i) => {
    const pctReached = Math.round((r.count / first) * 100)
    const dropOff = i === 0 ? null : prev > 0 ? Math.round(((prev - r.count) / prev) * 100) : 0
    prev = r.count
    return { ...r, pctReached, dropOff }
  })
}

// ---- TAT -------------------------------------------------------------------
export interface TatRow {
  stage: StageId
  name: string
  median: number
  p90: number
  n: number
}

export function tatRollup(apps: Application[]): TatRow[] {
  const per: Record<string, number[]> = {}
  for (const a of apps) {
    const h = a.stageHistory
    for (let i = 0; i < h.length - 1; i++) {
      const d = Math.max(0, daysBetween(h[i + 1].enteredAt, h[i].enteredAt))
      ;(per[h[i].stage] ??= []).push(d)
    }
  }
  return STAGE_ORDER.filter((s) => per[s]?.length).map((s) => {
    const arr = per[s].slice().sort((x, y) => x - y)
    return {
      stage: s,
      name: STAGES[STAGE_ORDER.indexOf(s)].name,
      median: percentile(arr, 50),
      p90: percentile(arr, 90),
      n: arr.length,
    }
  })
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

// ---- Closure / rejection forensics (req 8) --------------------------------
export interface ClosureRow extends CountValue {
  code: string
  label: string
  kind: ClosureKind
  medianDaysToClose: number
  byStage: Record<string, number>
}

export function closureRollup(apps: Application[]): ClosureRow[] {
  const closed = apps.filter((a) => a.outcome)
  const map = new Map<string, Application[]>()
  for (const a of closed) {
    const k = a.outcome!.code
    const arr = map.get(k)
    if (arr) arr.push(a)
    else map.set(k, [a])
  }
  const rows: ClosureRow[] = []
  for (const [code, list] of map) {
    const byStage: Record<string, number> = {}
    for (const a of list) {
      const s = String(a.outcome!.stageAtClosure)
      byStage[s] = (byStage[s] ?? 0) + 1
    }
    rows.push({
      code,
      label: CODE_LABEL[code] ?? list[0].outcome!.label,
      kind: list[0].outcome!.kind,
      ...cv(list),
      medianDaysToClose: median(list.map((a) => a.outcome!.daysToClosure)),
      byStage,
    })
  }
  return rows.sort((a, b) => b.count - a.count)
}

/** Where in the journey applications die — count + exposure per stage. */
export interface ClosureByStageRow extends CountValue {
  stage: string
  rejected: number
  withdrawn: number
  expired: number
}

export function closureByStage(apps: Application[]): ClosureByStageRow[] {
  const closed = apps.filter((a) => a.outcome)
  const map = new Map<string, Application[]>()
  for (const a of closed) {
    const k = String(a.outcome!.stageAtClosure)
    const arr = map.get(k)
    if (arr) arr.push(a)
    else map.set(k, [a])
  }
  return [...map.entries()]
    .map(([stage, list]) => ({
      stage,
      ...cv(list),
      rejected: list.filter((a) => a.outcome!.kind === 'rejected').length,
      withdrawn: list.filter((a) => a.outcome!.kind === 'withdrawn').length,
      expired: list.filter((a) => a.outcome!.kind === 'expired').length,
    }))
    .sort((a, b) => a.stage.localeCompare(b.stage))
}

export function closureByKind(apps: Application[]): (CountValue & { kind: ClosureKind | 'open' })[] {
  // `disbursed` must be here. The list was the three bad endings, written when
  // those were the only kinds that existed — so the moment §V3 gave
  // DISBURSED_ACTIVE an Outcome, seven closed files were silently dropped from
  // the closure mix while `closureRollup` counted them. Two panels on the same
  // screen disagreeing about how many files had closed.
  const kinds: (ClosureKind | 'open')[] = ['rejected', 'withdrawn', 'expired', 'disbursed']
  return kinds.map((kind) => ({ kind, ...cv(apps.filter((a) => a.outcome?.kind === kind)) }))
}

// ---- Operational rollups ---------------------------------------------------
export function blockerRollup(apps: Application[]) {
  return (['customer', 'bank', 'third_party'] as const).map((kind) => ({
    kind,
    ...cv(apps.filter((a) => a.blocker.kind === kind)),
  }))
}

export function agingRollup(apps: Application[]) {
  const open = apps.filter((a) => !isTerminalStage(a.stage))
  return (['green', 'amber', 'red'] as const).map((rag) => ({
    rag,
    ...cv(open.filter((a) => agingRag(daysInStage(a.stageEnteredAt)) === rag)),
  }))
}

export function doaRollup(apps: Application[]) {
  return (['Band-1', 'Band-2', 'Committee'] as const).map((band) => ({
    band,
    ...cv(apps.filter((a) => effectiveBand(a) === band)),
  }))
}

export function channelRollup(apps: Application[]) {
  return (['Digital', 'Branch', 'DSA', 'Partner'] as const).map((channel) => {
    const list = apps.filter((a) => a.channel === channel)
    const through = list.filter((a) =>
      ['S11', 'S12', 'S13', 'DISBURSED_ACTIVE'].includes(String(a.stage)),
    )
    return {
      channel,
      ...cv(list),
      approved: through.length,
      approvedValueInr: through.reduce((t, a) => t + a.askInr, 0),
      conversionPct: list.length ? Math.round((through.length / list.length) * 100) : 0,
    }
  })
}

export function branchRollup(apps: Application[]) {
  const map = new Map<string, Application[]>()
  for (const a of apps) {
    const arr = map.get(a.branchId)
    if (arr) arr.push(a)
    else map.set(a.branchId, [a])
  }
  return [...map.entries()]
    .map(([branchId, list]) => ({
      branchId,
      branch: BRANCH_BY_ID[branchId]?.name ?? branchId,
      city: BRANCH_BY_ID[branchId]?.city ?? '—',
      region: BRANCH_BY_ID[branchId]?.region ?? '—',
      ...cv(list),
      open: list.filter((a) => !isTerminalStage(a.stage)).length,
      closed: list.filter((a) => a.outcome).length,
      medianDays: median(list.map((a) => daysInStage(a.stageEnteredAt))),
    }))
    .sort((a, b) => b.valueInr - a.valueInr)
}

export function deviationRollup(apps: Application[]) {
  const map = new Map<string, { count: number; valueInr: number }>()
  for (const a of apps) {
    for (const d of a.deviations) {
      if (d.status !== 'open') continue
      const cur = map.get(d.defId) ?? { count: 0, valueInr: 0 }
      map.set(d.defId, { count: cur.count + 1, valueInr: cur.valueInr + a.askInr })
    }
  }
  return [...map.entries()].map(([type, v]) => ({ type, ...v }))
}

export function expiringRollup(apps: Application[]) {
  return apps
    .map((a) => {
      const { days, rag } = sanctionCountdown(a.sanctionExpiryDate)
      return {
        appId: a.appId,
        studentName: a.studentName,
        days,
        rag,
        expiry: a.sanctionExpiryDate,
        askInr: a.askInr,
        owner: a.owner.officer,
      }
    })
    .filter((e) => e.rag != null && !isNaN(e.days) && e.days <= 30)
    .sort((a, b) => a.days - b.days)
}

export function slaRollup(apps: Application[]) {
  const open = apps.filter((a) => !isTerminalStage(a.stage))
  return (['on_track', 'due_soon', 'breached', 'paused'] as const).map((state) => ({
    state,
    ...cv(open.filter((a) => slaStateOf(a) === state)),
  }))
}

// ---- Headline ---------------------------------------------------------------
export function portfolioSummary(apps: Application[]) {
  const open = apps.filter((a) => !isTerminalStage(a.stage))
  const sanctioned = apps.filter((a) =>
    ['S11', 'S12', 'S13', 'DISBURSED_ACTIVE'].includes(String(a.stage)),
  )
  const closed = apps.filter((a) => a.outcome)
  const decided = sanctioned.length + closed.length
  return {
    total: cv(apps),
    open: cv(open),
    sanctioned: cv(sanctioned),
    closed: cv(closed),
    approvalRatePct: decided ? Math.round((sanctioned.length / decided) * 100) : 0,
  }
}
