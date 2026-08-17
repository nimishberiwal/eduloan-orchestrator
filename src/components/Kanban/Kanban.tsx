// ============================================================================
// Pipeline (Kanban) — default view (§12.1)
// ============================================================================
import { memo, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { STAGES, STAGE_NAME } from '@/data/stages'
import { applyFilters, matchesClauses } from '@/lib/filters'
import { ColumnFilterPopover, sortColumn, type ColumnSort } from '@/components/common/ColumnFilterPopover'
import { inr } from '@/lib/format'
import type { Application, Stage, StageId } from '@/types'
import {
  AgingDot, BlockerBadge, CheckerBadge, CovenantBadge, DeviationBadge, DoABandChip, SanctionExpiryChip, TierChip,
} from '@/components/common/badges'
import { StatusChip } from '@/components/common/ui'

const TERMINAL_STAGES: Stage[] = ['DISBURSED_ACTIVE', 'REJECTED', 'WITHDRAWN', 'EXPIRED']

// Stage grouping accent — a calm top-rule colour per phase of the journey.
const STAGE_ACCENT: Record<StageId, string> = {
  S01: 'bg-slate-300', S02: 'bg-slate-300',
  S03: 'bg-sky-400', S04: 'bg-sky-400', S05: 'bg-sky-400',
  S06: 'bg-violet-400', S07: 'bg-violet-400',
  S08: 'bg-rose-400', S09: 'bg-amber-400',
  S10: 'bg-brand-500', S11: 'bg-emerald-400', S12: 'bg-emerald-400', S13: 'bg-emerald-500',
}

export function Kanban() {
  const apps = useStore((s) => s.applications)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const role = useStore((s) => s.role)
  const clauses = useStore((s) => s.filterClauses)
  const [showClosed, setShowClosed] = useState(false)

  const filtered = useMemo(
    () => applyFilters(apps, search, filters, role, clauses),
    [apps, search, filters, role, clauses],
  )

  const byStage = (stage: string) => filtered.filter((a) => a.stage === stage)
  const closed = filtered.filter((a) => TERMINAL_STAGES.includes(a.stage))

  return (
    <div className="thin-scroll flex h-full gap-3 overflow-x-auto px-4 py-4">
      {STAGES.map((s) => (
        <StageColumn key={s.id} id={s.id} name={s.name} accent={STAGE_ACCENT[s.id]} items={byStage(s.id)} />
      ))}

      {/* Collapsed Closed column */}
      <div className="flex w-[264px] flex-shrink-0 flex-col">
        <button
          onClick={() => setShowClosed((v) => !v)}
          className="mb-2.5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-slate-100 px-3 py-2.5 transition-colors hover:bg-slate-200/70"
        >
          <span className="flex items-center gap-1 text-13 font-semibold text-slate-600">
            <ChevronRight size={14} className={`transition-transform ${showClosed ? 'rotate-90' : ''}`} />
            Closed
          </span>
          <span className="text-13 font-semibold tnum text-slate-500">{closed.length}</span>
        </button>
        {showClosed && (
          <div className="flex flex-col gap-2">
            {closed.map((a) => (
              <AppCard key={a.appId} app={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** One stage column: sticky header + its own scroll area, capped card count.
 *  At ~200+ applications a column can hold dozens of cards; the cap keeps the
 *  first paint cheap and the "Show all" affordance keeps it honest. */
const CARD_CAP = 25

function StageColumn({
  id, name, accent, items: allItems,
}: {
  id: string
  name: string
  accent: string
  items: Application[]
}) {
  const [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState<ColumnSort>('aging_desc')
  const columnClauses = useStore((s) => s.columnFilters[id])

  // Column-local filter + sort (req 9) — the global filters have already run.
  const items = useMemo(() => {
    const filtered = columnClauses?.length
      ? allItems.filter((a) => matchesClauses(a, columnClauses))
      : allItems
    return sortColumn(filtered, sort)
  }, [allItems, columnClauses, sort])

  const sum = items.reduce((t, a) => t + a.askInr, 0)
  const visible = showAll ? items : items.slice(0, CARD_CAP)
  const hidden = items.length - visible.length
  const filteredOut = allItems.length - items.length

  return (
    <div className="flex w-[264px] flex-shrink-0 flex-col overflow-hidden">
      <div className="mb-2.5 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
        <div className={`h-1 w-full ${accent}`} />
        <div className="flex items-baseline justify-between gap-1 px-3 py-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold tracking-wide text-slate-400">{id}</span>
            <div className="truncate text-13 font-semibold leading-tight text-slate-700">{name}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-right">
              <div className="text-13 font-semibold tnum text-slate-700">{items.length}</div>
              {sum > 0 && <div className="text-[10px] tnum text-slate-400">{inr(sum)}</div>}
            </div>
            <ColumnFilterPopover stage={id} sort={sort} onSortChange={setSort} />
          </div>
        </div>
        {filteredOut > 0 && (
          <div className="border-t border-[var(--line)] bg-brand-50 px-3 py-1 text-[10px] text-brand-700">
            {filteredOut} hidden by column filter
          </div>
        )}
      </div>

      <div className="thin-scroll flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {visible.map((a) => (
          <AppCard key={a.appId} app={a} />
        ))}
        {hidden > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="rounded-xl border border-dashed border-slate-300 py-2 text-11 font-medium text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            Show all {items.length} — {hidden} more
          </button>
        )}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-11 text-slate-300">
            Empty
          </div>
        )}
      </div>
    </div>
  )
}

const AppCard = memo(function AppCard({ app }: { app: Application }) {
  const openApp = useStore((s) => s.openApp)
  return (
    <button
      onClick={() => openApp(app.appId)}
      className="group w-full rounded-xl border border-[var(--line)] bg-white p-3 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-11 font-semibold tnum text-slate-400 group-hover:text-brand-600">{app.appId}</span>
        <AgingDot app={app} />
      </div>
      <div className="mt-1 text-14 font-semibold leading-tight text-slate-800">{app.studentName}</div>
      <div className="text-11 text-slate-500">{app.universityShort} · {app.program}</div>
      <div className="mt-1.5 text-15 font-semibold tnum text-slate-800">{inr(app.askInr)}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        <TierChip app={app} />
        <DoABandChip app={app} />
        <BlockerBadge app={app} />
        <DeviationBadge app={app} />
        <CovenantBadge app={app} />
        <CheckerBadge app={app} />
        <SanctionExpiryChip app={app} />
      </div>
      {TERMINAL_STAGES.includes(app.stage) && (
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <StatusChip status={app.status} />
          <span className="text-[10px] text-slate-400">{STAGE_NAME[app.stage]}</span>
        </div>
      )}
    </button>
  )
})
