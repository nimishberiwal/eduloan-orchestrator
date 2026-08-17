// ============================================================================
// Peer cohort (§v2 req 4) — "see other applicants for this course / university".
// ============================================================================
import { useMemo, useState } from 'react'
import type { Application } from '@/types'
import { useStore } from '@/store/appStore'
import { peersOf, type PeerScope } from '@/lib/groupBy'
import { daysInStage, inr } from '@/lib/format'
import { STAGE_NAME } from '@/data/stages'
import { BRANCH_BY_ID } from '@/data/org'
import { Chip, EmptyState, StatusChip } from '@/components/common/ui'
import { BlockerBadge } from '@/components/common/badges'
import { isTerminalStage } from '@/lib/reports'

const SCOPES: { id: PeerScope; label: (a: Application) => string }[] = [
  { id: 'university', label: (a) => `Same university — ${a.universityShort}` },
  { id: 'university+program', label: (a) => `Same course — ${a.program}` },
  { id: 'program', label: (a) => `Same program anywhere — ${a.program}` },
  { id: 'university+intake', label: (a) => `${a.universityShort} · ${a.intake}` },
]

export function PeerPanel({ app }: { app: Application }) {
  const apps = useStore((s) => s.applications)
  const openApp = useStore((s) => s.openApp)
  const [scope, setScope] = useState<PeerScope>('university')

  const peers = useMemo(() => peersOf(app, apps, scope), [app, apps, scope])

  const stats = useMemo(() => {
    const open = peers.filter((p) => !isTerminalStage(p.stage))
    const closed = peers.filter((p) => p.outcome)
    const value = peers.reduce((t, p) => t + p.askInr, 0)
    const avg = peers.length ? Math.round(value / peers.length) : 0
    return { open: open.length, closed: closed.length, value, avg }
  }, [peers])

  return (
    <div>
      {/* Scope picker */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`rounded-full border px-2.5 py-1 text-11 font-medium transition-colors ${
              scope === s.id
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-[var(--line)] bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {s.label(app)}
          </button>
        ))}
      </div>

      {/* Cohort summary */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini label="Peer applications" value={String(peers.length)} />
        <Mini label="Still open" value={String(stats.open)} />
        <Mini label="Closed" value={String(stats.closed)} />
        <Mini label="Cohort exposure" value={inr(stats.value)} sub={`avg ${inr(stats.avg)}`} />
      </div>

      {peers.length === 0 ? (
        <EmptyState>No other applications in this cohort.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
          <table className="w-full text-12">
            <thead className="border-b border-[var(--line)] bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2.5 py-2 text-left">APP ID</th>
                <th className="px-2.5 py-2 text-left">Student</th>
                <th className="px-2.5 py-2 text-left">Program</th>
                <th className="px-2.5 py-2 text-left">Stage</th>
                <th className="px-2.5 py-2 text-left">Status</th>
                <th className="px-2.5 py-2 text-left">Blocker</th>
                <th className="px-2.5 py-2 text-left">Branch</th>
                <th className="px-2.5 py-2 text-right">Days</th>
                <th className="px-2.5 py-2 text-right">Ask</th>
              </tr>
            </thead>
            <tbody>
              {peers.slice(0, 80).map((p) => (
                <tr
                  key={p.appId}
                  onClick={() => openApp(p.appId)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-2.5 py-1.5 font-mono text-11 tnum text-slate-500">{p.appId}</td>
                  <td className="px-2.5 py-1.5 font-medium text-slate-700">{p.studentName}</td>
                  <td className="px-2.5 py-1.5 text-slate-500">{p.program}</td>
                  <td className="px-2.5 py-1.5 text-slate-500">
                    {String(p.stage)}
                    {p.outcome && <Chip tone="red">{p.outcome.code}</Chip>}
                  </td>
                  <td className="px-2.5 py-1.5"><StatusChip status={p.status} /></td>
                  <td className="px-2.5 py-1.5"><BlockerBadge app={p} /></td>
                  <td className="px-2.5 py-1.5 text-slate-500">{BRANCH_BY_ID[p.branchId]?.city ?? '—'}</td>
                  <td className="px-2.5 py-1.5 text-right tnum text-slate-500">{daysInStage(p.stageEnteredAt)}</td>
                  <td className="px-2.5 py-1.5 text-right font-semibold tnum text-slate-700">{inr(p.askInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {peers.length > 80 && (
            <div className="px-3 py-2 text-center text-11 text-slate-400">
              showing first 80 of {peers.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-2.5 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-14 font-semibold tnum text-slate-800">{value}</div>
      {sub && <div className="text-11 text-slate-400">{sub}</div>}
    </div>
  )
}

export { STAGE_NAME }
