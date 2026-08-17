// ============================================================================
// One batch group — headline metrics, a stage-mix bar, and drill-down.
// ============================================================================
import { ChevronRight, Users } from 'lucide-react'
import type { Group } from '@/lib/groupBy'
import { useStore } from '@/store/appStore'
import { inr } from '@/lib/format'
import { STAGES } from '@/data/stages'
import { StatusChip } from '@/components/common/ui'
import { BlockerBadge } from '@/components/common/badges'

// Same phase colours as the Kanban column rules, so the two views agree.
const PHASE: { match: (s: string) => boolean; cls: string; label: string }[] = [
  { match: (s) => ['S01', 'S02'].includes(s), cls: 'bg-slate-300', label: 'Intake' },
  { match: (s) => ['S03', 'S04', 'S05'].includes(s), cls: 'bg-sky-400', label: 'KYC & docs' },
  { match: (s) => ['S06', 'S07'].includes(s), cls: 'bg-violet-400', label: 'Credit' },
  { match: (s) => ['S08', 'S09'].includes(s), cls: 'bg-amber-400', label: 'Risk & collateral' },
  { match: (s) => ['S10', 'S11'].includes(s), cls: 'bg-brand-500', label: 'Decision & sanction' },
  { match: (s) => ['S12', 'S13', 'DISBURSED_ACTIVE'].includes(s), cls: 'bg-emerald-500', label: 'Docs & disbursal' },
  { match: (s) => ['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(s), cls: 'bg-red-400', label: 'Closed' },
]

export function GroupCard({
  group, metric, maxValue, open, onToggle,
}: {
  group: Group
  metric: 'count' | 'value'
  maxValue: number
  open: boolean
  onToggle: () => void
}) {
  const openApp = useStore((s) => s.openApp)
  const measure = metric === 'value' ? group.valueInr : group.count
  const pct = maxValue > 0 ? (measure / maxValue) * 100 : 0

  const mix = PHASE.map((p) => ({
    ...p,
    n: group.apps.filter((a) => p.match(String(a.stage))).length,
  })).filter((p) => p.n > 0)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
      <button onClick={onToggle} className="w-full px-3.5 pt-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-14 font-semibold text-slate-800">{group.label}</div>
            <div className="mt-0.5 text-11 text-slate-500">
              {group.count} application{group.count === 1 ? '' : 's'} · {group.openCount} open
            </div>
          </div>
          <div className="text-right">
            <div className="text-15 font-semibold tnum text-slate-800">{inr(group.valueInr)}</div>
            <div className="text-11 tnum text-slate-400">median {group.medianDays}d</div>
          </div>
        </div>

        {/* relative size within the batch view */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>

        {/* stage mix */}
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
          {mix.map((p) => (
            <div
              key={p.label}
              className={p.cls}
              style={{ width: `${(p.n / group.count) * 100}%` }}
              title={`${p.label}: ${p.n}`}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between pb-3 text-11 text-slate-500">
          <span>{group.blocked > 0 ? `${group.blocked} blocked` : 'none blocked'}</span>
          <span className="inline-flex items-center gap-0.5 font-medium text-brand-600">
            {open ? 'Hide' : 'Drill in'}
            <ChevronRight size={12} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </span>
        </div>
      </button>

      {open && (
        <div className="thin-scroll max-h-72 overflow-y-auto border-t border-[var(--line)] bg-slate-50/60">
          <table className="w-full text-12">
            <tbody>
              {group.apps.slice(0, 60).map((a) => (
                <tr
                  key={a.appId}
                  onClick={() => openApp(a.appId)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-white"
                >
                  <td className="px-3 py-1.5 font-mono text-11 tnum text-slate-500">{a.appId}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-700">{a.studentName}</td>
                  <td className="px-2 py-1.5 text-slate-500">{String(a.stage)}</td>
                  <td className="px-2 py-1.5"><StatusChip status={a.status} /></td>
                  <td className="px-2 py-1.5"><BlockerBadge app={a} /></td>
                  <td className="px-3 py-1.5 text-right font-semibold tnum text-slate-700">{inr(a.askInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {group.apps.length > 60 && (
            <div className="px-3 py-2 text-center text-11 text-slate-400">
              showing first 60 of {group.apps.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { STAGES, Users }
