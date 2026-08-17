// ============================================================================
// Batches (§v2 req 5) — portfolio grouped by branch / city / loan amount /
// channel / university / officer, with a cross-tab and drill-down.
// ============================================================================
import { useMemo, useState } from 'react'
import { ChevronRight, Grid3x3, LayoutList } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { applyFilters } from '@/lib/filters'
import { GROUP_KEYS, type GroupKey, type Group, crossTab, groupApps } from '@/lib/groupBy'
import { inr } from '@/lib/format'
import { STAGE_NAME } from '@/data/stages'
import { CrossTabView } from './CrossTab'
import { GroupCard } from './GroupCard'

export function Batches() {
  const apps = useStore((s) => s.applications)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const clauses = useStore((s) => s.filterClauses)
  const role = useStore((s) => s.role)
  const groupBy = useStore((s) => s.groupBy)
  const groupBy2 = useStore((s) => s.groupBy2)
  const setGroupBy = useStore((s) => s.setGroupBy)

  const [mode, setMode] = useState<'cards' | 'matrix'>('cards')
  const [metric, setMetric] = useState<'count' | 'value'>('value')
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const scoped = useMemo(
    () => applyFilters(apps, search, filters, role, clauses),
    [apps, search, filters, role, clauses],
  )
  const groups: Group[] = useMemo(() => groupApps(scoped, groupBy), [scoped, groupBy])
  const matrix = useMemo(
    () => (mode === 'matrix' ? crossTab(scoped, groupBy, groupBy2, metric) : null),
    [scoped, groupBy, groupBy2, metric, mode],
  )

  const totalValue = scoped.reduce((t, a) => t + a.askInr, 0)

  return (
    <div className="thin-scroll h-full overflow-auto p-4">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Group by</div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-13 font-medium"
          >
            {GROUP_KEYS.map((g) => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </div>

        {mode === 'matrix' && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Against</div>
            <select
              value={groupBy2}
              onChange={(e) => setGroupBy(groupBy, e.target.value as GroupKey)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-13 font-medium"
            >
              {GROUP_KEYS.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Measure</div>
          <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5">
            {(['value', 'count'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-2.5 py-1 text-12 font-medium transition-colors ${
                  metric === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m === 'value' ? '₹ Value' : 'Count'}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">View</div>
          <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5">
            <button
              onClick={() => setMode('cards')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-12 font-medium transition-colors ${
                mode === 'cards' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutList size={13} /> Groups
            </button>
            <button
              onClick={() => setMode('matrix')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-12 font-medium transition-colors ${
                mode === 'matrix' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Grid3x3 size={13} /> Cross-tab
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Applications" value={String(scoped.length)} />
        <Stat label="Portfolio value" value={inr(totalValue)} />
        <Stat label="Groups" value={String(groups.length)} />
        <Stat
          label="Avg per group"
          value={groups.length ? inr(Math.round(totalValue / groups.length)) : '—'}
        />
      </div>

      {mode === 'matrix' && matrix ? (
        <CrossTabView tab={matrix} metric={metric} rowKey={groupBy} colKey={groupBy2} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.key}
              group={g}
              metric={metric}
              maxValue={Math.max(...groups.map((x) => (metric === 'value' ? x.valueInr : x.count)))}
              open={openGroup === g.key}
              onToggle={() => setOpenGroup(openGroup === g.key ? null : g.key)}
            />
          ))}
          {groups.length === 0 && (
            <div className="col-span-full py-12 text-center text-13 text-slate-400">
              No applications match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tnum text-slate-800">{value}</div>
    </div>
  )
}

export { STAGE_NAME, ChevronRight }
