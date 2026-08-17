// ============================================================================
// Grouping & cohort helpers (§v2 req 4, 5) — batch mode and the peer panel.
// ============================================================================
import type { Application, Stage } from '@/types'
import { BRANCH_BY_ID, OFFICER_BY_ID } from '@/data/org'
import { STAGE_NAME } from '@/data/stages'
import { daysInStage } from '@/lib/format'
import { effectiveBand } from '@/lib/doa'

export type GroupKey =
  | 'branch' | 'city' | 'region' | 'department' | 'officer' | 'stage' | 'status'
  | 'channel' | 'tier' | 'band' | 'amountBand' | 'intake' | 'university'
  | 'blocker' | 'outcomeKind' | 'programLevel'

export const GROUP_KEYS: { key: GroupKey; label: string }[] = [
  { key: 'branch', label: 'Branch' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'amountBand', label: 'Loan amount' },
  { key: 'stage', label: 'Stage' },
  { key: 'channel', label: 'Channel' },
  { key: 'university', label: 'University' },
  { key: 'tier', label: 'Tier / security' },
  { key: 'band', label: 'DoA band' },
  { key: 'officer', label: 'Officer' },
  { key: 'department', label: 'Department' },
  { key: 'intake', label: 'Intake' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'outcomeKind', label: 'Closure type' },
  { key: 'programLevel', label: 'Program level' },
]

// ---- Amount bands ----------------------------------------------------------
export const AMOUNT_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'A', label: '≤ ₹10L', min: 0, max: 10_00_000 },
  { id: 'B', label: '₹10–25L', min: 10_00_000, max: 25_00_000 },
  { id: 'C', label: '₹25–50L', min: 25_00_000, max: 50_00_000 },
  { id: 'D', label: '₹50–75L', min: 50_00_000, max: 75_00_000 },
  { id: 'E', label: '₹75L – ₹1Cr', min: 75_00_000, max: Number.MAX_SAFE_INTEGER },
]

export function amountBandOf(inr: number): string {
  const b = AMOUNT_BANDS.find((x) => inr > x.min && inr <= x.max) ?? AMOUNT_BANDS[0]
  return b.id
}
export function amountBandLabel(id: string): string {
  return AMOUNT_BANDS.find((b) => b.id === id)?.label ?? id
}

// ---- Key extraction --------------------------------------------------------
export function keyOf(app: Application, k: GroupKey): string {
  switch (k) {
    case 'branch': return app.branchId
    case 'city': return BRANCH_BY_ID[app.branchId]?.city ?? '—'
    case 'region': return BRANCH_BY_ID[app.branchId]?.region ?? '—'
    case 'department': return app.owner.department
    case 'officer': return app.owner.officer
    case 'stage': return String(app.stage)
    case 'status': return app.status
    case 'channel': return app.channel
    case 'tier': return app.tier
    case 'band': return effectiveBand(app)
    case 'amountBand': return amountBandOf(app.askInr)
    case 'intake': return app.intake
    case 'university': return app.university
    case 'blocker': return app.blocker.kind
    case 'outcomeKind': return app.outcome?.kind ?? 'open'
    case 'programLevel': return app.programLevel
    default: return '—'
  }
}

export function labelOf(k: GroupKey, key: string): string {
  switch (k) {
    case 'branch': return BRANCH_BY_ID[key]?.name ?? key
    case 'amountBand': return amountBandLabel(key)
    case 'stage': return `${key} · ${STAGE_NAME[key] ?? ''}`.trim()
    case 'officer': return OFFICER_BY_ID[key]?.name ?? key
    case 'blocker': return key === 'none' ? 'Not blocked' : key.replace('_', '-')
    case 'outcomeKind': return key === 'open' ? 'Still open' : key
    default: return key
  }
}

/** Sort order for a group key — bands and stages read best in natural order. */
function orderIndex(k: GroupKey, key: string): number {
  if (k === 'amountBand') return AMOUNT_BANDS.findIndex((b) => b.id === key)
  if (k === 'stage') return /^S(\d\d)$/.test(key) ? parseInt(key.slice(1), 10) : 90
  return -1
}

// ---- Aggregation -----------------------------------------------------------
export interface Group {
  key: string
  label: string
  apps: Application[]
  count: number
  valueInr: number
  medianDays: number
  blocked: number
  openCount: number
}

export function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const TERMINALS: Stage[] = ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'DISBURSED_ACTIVE']

export function groupApps(apps: Application[], k: GroupKey): Group[] {
  const map = new Map<string, Application[]>()
  for (const a of apps) {
    const key = keyOf(a, k)
    const arr = map.get(key)
    if (arr) arr.push(a)
    else map.set(key, [a])
  }
  const groups: Group[] = []
  for (const [key, list] of map) {
    groups.push({
      key,
      label: labelOf(k, key),
      apps: list,
      count: list.length,
      valueInr: list.reduce((t, a) => t + a.askInr, 0),
      medianDays: median(list.map((a) => daysInStage(a.stageEnteredAt))),
      blocked: list.filter((a) => a.blocker.kind !== 'none').length,
      openCount: list.filter((a) => !TERMINALS.includes(a.stage)).length,
    })
  }
  const oi = (g: Group) => orderIndex(k, g.key)
  return groups.sort((a, b) => {
    const ia = oi(a)
    const ib = oi(b)
    if (ia >= 0 || ib >= 0) return ia - ib
    return b.valueInr - a.valueInr // otherwise biggest exposure first
  })
}

// ---- Cross-tab (rows × cols) ----------------------------------------------
export interface CrossTab {
  rows: { key: string; label: string }[]
  cols: { key: string; label: string }[]
  cells: number[][]
  rowTotals: number[]
  colTotals: number[]
  grandTotal: number
}

export function crossTab(
  apps: Application[],
  rowKey: GroupKey,
  colKey: GroupKey,
  metric: 'count' | 'value',
): CrossTab {
  const rowGroups = groupApps(apps, rowKey)
  const colKeysSeen = groupApps(apps, colKey)
  const rows = rowGroups.map((g) => ({ key: g.key, label: g.label }))
  const cols = colKeysSeen.map((g) => ({ key: g.key, label: g.label }))
  const colIndex = new Map(cols.map((c, i) => [c.key, i]))

  const cells = rows.map(() => new Array(cols.length).fill(0))
  rowGroups.forEach((rg, ri) => {
    for (const a of rg.apps) {
      const ci = colIndex.get(keyOf(a, colKey))
      if (ci === undefined) continue
      cells[ri][ci] += metric === 'count' ? 1 : a.askInr
    }
  })

  const rowTotals = cells.map((r) => r.reduce((t, v) => t + v, 0))
  const colTotals = cols.map((_, ci) => cells.reduce((t, r) => t + r[ci], 0))
  return {
    rows, cols, cells, rowTotals, colTotals,
    grandTotal: rowTotals.reduce((t, v) => t + v, 0),
  }
}

// ---- Peer cohort (§v2 req 4) ----------------------------------------------
export type PeerScope = 'university' | 'university+program' | 'program' | 'university+intake'

export function peersOf(
  app: Application,
  apps: Application[],
  scope: PeerScope = 'university',
): Application[] {
  return apps.filter((o) => {
    if (o.appId === app.appId) return false
    switch (scope) {
      case 'university': return o.university === app.university
      case 'program': return o.program === app.program
      case 'university+program': return o.university === app.university && o.program === app.program
      case 'university+intake': return o.university === app.university && o.intake === app.intake
    }
  })
}
