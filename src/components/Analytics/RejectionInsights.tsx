// ============================================================================
// Rejection & closure insights (§v2 req 8).
//
// The v1 board only ever told the positive story. This answers the three
// questions a credit committee actually asks about failure: WHO was closed,
// WHEN in the journey they died, and WHY.
// ============================================================================
import { useMemo, useState } from 'react'
import type { Application, ClosureKind } from '@/types'
import { useStore } from '@/store/appStore'
import { inr, fmtDate } from '@/lib/format'
import { STAGE_NAME } from '@/data/stages'
import { BRANCH_BY_ID } from '@/data/org'
import { closureByKind, closureByStage, closureRollup } from '@/lib/reports'
import { Card, Empty, Stat } from './Analytics'
import { Chip } from '@/components/common/ui'

// `disbursed` is a closure that went well, so it must not read like the other
// three. This panel is titled for rejections but `closureByKind` returns every
// ClosureKind, and a green row is the point: without it the view shows only
// losses and implies the book is nothing else.
const KIND_TONE: Record<ClosureKind, 'red' | 'orange' | 'purple' | 'green'> = {
  rejected: 'red',
  withdrawn: 'orange',
  expired: 'purple',
  disbursed: 'green',
}

export function RejectionInsights({
  apps, metric,
}: {
  apps: Application[]
  metric: 'value' | 'count'
}) {
  const openApp = useStore((s) => s.openApp)
  const [kindFilter, setKindFilter] = useState<ClosureKind | 'all'>('all')

  const closed = useMemo(() => apps.filter((a) => a.outcome), [apps])
  const scoped = useMemo(
    () => (kindFilter === 'all' ? closed : closed.filter((a) => a.outcome!.kind === kindFilter)),
    [closed, kindFilter],
  )
  const byKind = useMemo(() => closureByKind(apps), [apps])
  const byStage = useMemo(() => closureByStage(scoped), [scoped])
  const byReason = useMemo(() => closureRollup(scoped), [scoped])

  const lostValue = closed.reduce((t, a) => t + a.askInr, 0)
  const medianDays = scoped.length
    ? Math.round(scoped.reduce((t, a) => t + a.outcome!.daysToClosure, 0) / scoped.length)
    : 0

  if (closed.length === 0) {
    return <Empty>No closed applications in the current scope.</Empty>
  }

  return (
    <div>
      {/* Headline */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Closed files" value={String(closed.length)} sub={`of ${apps.length} in scope`} tone="red" />
        <Stat label="Value not converted" value={inr(lostValue)} sub="cumulative ask" tone="red" />
        <Stat label="Avg days to closure" value={`${medianDays}d`} sub="from registration" />
        <Stat
          label="Loss rate"
          value={`${Math.round((closed.length / Math.max(1, apps.length)) * 100)}%`}
          sub="of applications in scope"
        />
      </div>

      {/* Kind filter */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Closure type</span>
        {(['all', 'rejected', 'withdrawn', 'expired'] as const).map((k) => {
          const row = byKind.find((b) => b.kind === k)
          const on = kindFilter === k
          return (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-full border px-2.5 py-1 text-11 font-medium capitalize transition-colors ${
                on ? 'border-slate-800 bg-slate-800 text-white' : 'border-[var(--line)] bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {k}
              {k !== 'all' && row && <span className={on ? 'ml-1 text-white/70' : 'ml-1 text-slate-400'}>{row.count}</span>}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* WHEN — where in the journey they died */}
        <Card title="Where applications die — stage at closure" span2>
          <div className="space-y-1.5">
            {byStage.map((s) => {
              const peak = Math.max(...byStage.map((x) => (metric === 'value' ? x.valueInr : x.count)), 1)
              const measure = metric === 'value' ? s.valueInr : s.count
              return (
                <div key={s.stage} className="flex items-center gap-2 text-12">
                  <span className="w-9 font-mono text-slate-400">{s.stage}</span>
                  <span className="w-36 truncate text-slate-500">{STAGE_NAME[s.stage] ?? ''}</span>
                  <div className="flex h-4 flex-1 overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-red-500" style={{ width: `${(s.rejected / Math.max(1, s.count)) * (measure / peak) * 100}%` }} />
                    <div className="h-full bg-orange-400" style={{ width: `${(s.withdrawn / Math.max(1, s.count)) * (measure / peak) * 100}%` }} />
                    <div className="h-full bg-purple-400" style={{ width: `${(s.expired / Math.max(1, s.count)) * (measure / peak) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right font-semibold tnum text-slate-700">{inr(s.valueInr)}</span>
                  <span className="w-7 text-right tnum text-slate-400">{s.count}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
            <Legend cls="bg-red-500" label="Rejected" />
            <Legend cls="bg-orange-400" label="Withdrawn" />
            <Legend cls="bg-purple-400" label="Expired" />
          </div>
        </Card>

        {/* Split by kind */}
        <Card title="Closure mix">
          <div className="space-y-2">
            {byKind.map((k) => (
              <div key={k.kind}>
                <div className="flex items-baseline justify-between text-12">
                  <span className="capitalize text-slate-600">{k.kind}</span>
                  <span className="tnum text-slate-500">{inr(k.valueInr)} · {k.count}</span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={
                      k.kind === 'rejected' ? 'h-full bg-red-500'
                      : k.kind === 'withdrawn' ? 'h-full bg-orange-400'
                      : 'h-full bg-purple-400'
                    }
                    style={{ width: `${(k.count / Math.max(1, closed.length)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* WHY — reason pareto */}
        <Card title="Why — reason Pareto" span2>
          <div className="space-y-2">
            {byReason.map((r) => {
              const peak = Math.max(...byReason.map((x) => (metric === 'value' ? x.valueInr : x.count)), 1)
              const measure = metric === 'value' ? r.valueInr : r.count
              return (
                <div key={r.code}>
                  <div className="flex items-baseline justify-between gap-2 text-12">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-slate-600">{r.code}</span>
                      <Chip tone={KIND_TONE[r.kind]}>{r.kind}</Chip>
                    </span>
                    <span className="tnum text-slate-500">
                      {inr(r.valueInr)} · {r.count} · med {r.medianDaysToClose}d
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={
                        r.kind === 'rejected' ? 'h-full bg-red-500'
                        : r.kind === 'withdrawn' ? 'h-full bg-orange-400'
                        : 'h-full bg-purple-400'
                      }
                      style={{ width: `${(measure / peak) * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 truncate text-11 text-slate-400">{r.label}</div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* WHO — the register */}
        <Card title="Closure register" span2>
          <div className="thin-scroll max-h-96 overflow-auto">
            <table className="w-full text-12">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1 text-left">APP ID</th>
                  <th className="py-1 text-left">Student</th>
                  <th className="py-1 text-left">Closed at</th>
                  <th className="py-1 text-left">Reason</th>
                  <th className="py-1 text-left">By</th>
                  <th className="py-1 text-left">Branch</th>
                  <th className="py-1 text-right">Days</th>
                  <th className="py-1 text-right">Value</th>
                  <th className="py-1 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {scoped
                  .slice()
                  .sort((a, b) => (b.outcome!.closedAt > a.outcome!.closedAt ? 1 : -1))
                  .map((a) => (
                    <tr
                      key={a.appId}
                      onClick={() => openApp(a.appId)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-1 font-mono text-11 tnum text-slate-500">{a.appId}</td>
                      <td className="py-1 font-medium text-slate-700">{a.studentName}</td>
                      <td className="py-1 text-slate-500">{String(a.outcome!.stageAtClosure)}</td>
                      <td className="py-1">
                        <span className="font-mono text-11 text-slate-600">{a.outcome!.code}</span>
                      </td>
                      <td className="py-1 text-slate-500">{a.outcome!.decidedBy}</td>
                      <td className="py-1 text-slate-500">{BRANCH_BY_ID[a.branchId]?.city ?? '—'}</td>
                      <td className="py-1 text-right tnum text-slate-500">{a.outcome!.daysToClosure}</td>
                      <td className="py-1 text-right font-semibold tnum text-slate-700">{inr(a.askInr)}</td>
                      <td className="py-1 text-right text-11 text-slate-400">{fmtDate(a.outcome!.closedAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-sm ${cls}`} />
      {label}
    </span>
  )
}
