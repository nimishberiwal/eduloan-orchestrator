// ============================================================================
// Escalation matrix + live escalation register (§v2 req 10).
// ============================================================================
import { useMemo } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { ESCALATION_BY_DEPT, ESCALATION_MATRIX } from '@/data/rules'
import { officerName, officerTitle, slaFor } from '@/lib/escalation'
import { isTerminalStage } from '@/lib/reports'
import { nowIso } from '@/lib/clock'
import { fmtDateTime, inr } from '@/lib/format'
import { Btn, Chip, EmptyState } from '@/components/common/ui'
import type { Department } from '@/types'

const DEPTS: Department[] = ['Sales', 'Ops', 'Credit', 'Risk', 'Compliance']

export function EscalationMatrix() {
  const apps = useStore((s) => s.applications)
  const escalations = useStore((s) => s.escalations)
  const acknowledge = useStore((s) => s.acknowledgeEscalation)
  const openApp = useStore((s) => s.openApp)
  const tick = useStore((s) => s.clockTick)

  // Live SLA picture, recomputed whenever the prototype clock moves.
  const atRisk = useMemo(() => {
    const now = nowIso()
    return apps
      .filter((a) => !isTerminalStage(a.stage))
      .map((a) => ({ app: a, sla: slaFor(a, now) }))
      .filter((r) => r.sla.state === 'breached' || r.sla.state === 'due_soon')
      .sort((a, b) => b.sla.hoursElapsed - a.sla.hoursElapsed)
  }, [apps, tick])

  return (
    <div className="space-y-4">
      {/* The matrix itself */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
        <h3 className="text-13 font-semibold text-slate-700">Escalation matrix</h3>
        <p className="mt-0.5 text-11 text-slate-500">
          An assignee who has not actioned a file within the SLA is escalated up their reporting line.
          The clock <b>pauses</b> while a file is waiting on the customer or a third party — that delay is not the assignee's.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-12">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-1.5 text-left">Department</th>
                <th className="py-1.5 text-left">Level 1</th>
                <th className="py-1.5 text-left">Level 2</th>
                <th className="py-1.5 text-left">Level 3</th>
              </tr>
            </thead>
            <tbody>
              {DEPTS.map((d) => {
                const m = ESCALATION_BY_DEPT[d] ?? ESCALATION_MATRIX
                return (
                  <tr key={d} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium text-slate-700">{d}</td>
                    {[0, 1, 2].map((i) => (
                      <td key={i} className="py-1.5 text-slate-600">
                        {m[i] ? (
                          <span className="inline-flex items-center gap-1">
                            <Chip tone={i === 0 ? 'amber' : i === 1 ? 'orange' : 'red'}>
                              after {m[i].afterHours}h
                            </Chip>
                            <ArrowUpRight size={11} className="text-slate-400" />
                            {m[i].toTitle}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live SLA watchlist */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
        <h3 className="text-13 font-semibold text-slate-700">
          At-risk assignments <span className="ml-1 tnum text-slate-400">{atRisk.length}</span>
        </h3>
        {atRisk.length === 0 ? (
          <EmptyState>Every open assignment is inside its SLA.</EmptyState>
        ) : (
          <div className="thin-scroll mt-2 max-h-80 overflow-auto">
            <table className="w-full text-12">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1 text-left">APP ID</th>
                  <th className="py-1 text-left">Stage</th>
                  <th className="py-1 text-left">Assignee</th>
                  <th className="py-1 text-left">Escalates to</th>
                  <th className="py-1 text-right">Held</th>
                  <th className="py-1 text-left">State</th>
                  <th className="py-1 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.slice(0, 60).map(({ app, sla }) => (
                  <tr key={app.appId} onClick={() => openApp(app.appId)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-1 font-mono text-11 tnum text-slate-500">{app.appId}</td>
                    <td className="py-1 text-slate-500">{String(app.stage)}</td>
                    <td className="py-1 text-slate-700">{app.owner.officer}</td>
                    <td className="py-1 text-slate-500">{escalatesTo(app.owner.department)}</td>
                    <td className="py-1 text-right tnum text-slate-600">{Math.round(sla.hoursElapsed)}h</td>
                    <td className="py-1">
                      <Chip tone={sla.state === 'breached' ? 'red' : 'amber'}>{String(sla.state).replace('_', ' ')}</Chip>
                    </td>
                    <td className="py-1 text-right font-semibold tnum text-slate-700">{inr(app.askInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Escalation register */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
        <h3 className="text-13 font-semibold text-slate-700">
          Escalation register <span className="ml-1 tnum text-slate-400">{escalations.length}</span>
        </h3>
        {escalations.length === 0 ? (
          <EmptyState>
            Nothing escalated yet. Run a sweep from the control strip above (advance the clock first to age the portfolio).
          </EmptyState>
        ) : (
          <div className="thin-scroll mt-2 max-h-80 space-y-1.5 overflow-auto">
            {escalations.map((e) => (
              <div key={e.id} className="rounded-lg border border-[var(--line)] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-11">
                  <span className="flex items-center gap-1.5">
                    <Chip tone={e.level >= 3 ? 'red' : e.level === 2 ? 'orange' : 'amber'}>Level {e.level}</Chip>
                    <button onClick={() => openApp(e.appId)} className="font-mono font-semibold text-brand-600 hover:underline">
                      {e.appId}
                    </button>
                    <span className="text-slate-500">{String(e.stage)}</span>
                  </span>
                  <span className="text-slate-400">{fmtDateTime(e.ts)}</span>
                </div>
                <div className="mt-1 text-12 text-slate-600">{e.reason}</div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-11 text-slate-500">
                  <span>
                    {officerName(e.fromOfficerId)} <ArrowUpRight size={10} className="inline" />{' '}
                    <b className="text-slate-700">{officerName(e.toOfficerId)}</b>{' '}
                    <span className="text-slate-400">({officerTitle(e.toOfficerId)})</span>
                    {' · '}{e.hoursOverdue}h overdue
                  </span>
                  {e.acknowledgedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <Check size={12} /> acknowledged
                    </span>
                  ) : (
                    <Btn size="sm" tone="ghost" onClick={() => acknowledge(e.id)}>Acknowledge</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function escalatesTo(dept: Department): string {
  const m = ESCALATION_BY_DEPT[dept] ?? ESCALATION_MATRIX
  return m[0]?.toTitle ?? '—'
}
