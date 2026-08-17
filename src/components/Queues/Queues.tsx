// ============================================================================
// Queues (work-list) view (§12.2)
// ============================================================================
import { useMemo, useState, useEffect } from 'react'
import { ArrowUpDown, Bell, ExternalLink, Send, Users } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { applyFilters } from '@/lib/filters'
import { deptOf, summaryNextAction, ROLES } from '@/lib/stateMachine'
import { daysInStage } from '@/lib/format'
import { inr } from '@/lib/format'
import type { Application, Department } from '@/types'
import { StatusChip, Btn } from '@/components/common/ui'
import { BlockerBadge } from '@/components/common/badges'
import { STAGE_NAME } from '@/data/stages'
import { openHitlCount } from '@/lib/hitl'
import { HitlQueue } from './HitlQueue'

const DEPTS: Department[] = ['Sales', 'Ops', 'Credit', 'Risk', 'Compliance', 'Admin']

export function Queues() {
  const apps = useStore((s) => s.applications)
  const role = useStore((s) => s.role)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const nudge = useStore((s) => s.nudge)
  const openApp = useStore((s) => s.openApp)
  const reassign = useStore((s) => s.reassign)
  const pushToast = useStore((s) => s.pushToast)
  const openComposer = useStore((s) => s.openComposer)
  const openBulkComposer = useStore((s) => s.openBulkComposer)

  const decisions = useStore((s) => s.hitlDecisions)
  const [view, setView] = useState<'worklist' | 'hitl'>('worklist')
  const [dept, setDept] = useState<Department | 'Unassigned'>(deptOf(role))
  const [sortDesc, setSortDesc] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Role switch lands officer on their department (§12.2)
  useEffect(() => {
    setDept(deptOf(role))
    setSelected(new Set())
  }, [role])

  const filtered = useMemo(() => applyFilters(apps, search, filters, role), [apps, search, filters, role])
  const hitlCount = useMemo(() => openHitlCount(apps, decisions), [apps, decisions])
  const rows = useMemo(() => {
    const list = filtered.filter((a) => a.owner.department === dept)
    return [...list].sort((a, b) => {
      const da = daysInStage(a.stageEnteredAt)
      const db = daysInStage(b.stageEnteredAt)
      return sortDesc ? db - da : da - db
    })
  }, [filtered, dept, sortDesc])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const bulkNudge = () => {
    if (role !== 'Admin' && role !== 'Sales') {
      pushToast('error', 'Bulk actions are Admin (Sales limited to own portfolio).')
      return
    }
    selected.forEach((id) => nudge(id))
    setSelected(new Set())
  }
  const bulkReassign = () => {
    if (role !== 'Admin') {
      pushToast('error', 'Bulk reassign is Admin-only (§5).')
      return
    }
    selected.forEach((id) => reassign(id, dept as Department, ROLES.find((r) => r.department === dept)?.officer ?? 'R. Iyer'))
    setSelected(new Set())
  }

  if (view === 'hitl') {
    return (
      <div className="thin-scroll h-full overflow-auto p-4">
        <ViewSwitch view={view} setView={setView} hitlCount={hitlCount} />
        <HitlQueue />
      </div>
    )
  }

  return (
    <div className="thin-scroll h-full overflow-auto p-4">
      <ViewSwitch view={view} setView={setView} hitlCount={hitlCount} />
      <div className="mb-3 inline-flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-white p-1 shadow-card">
        {DEPTS.map((d) => {
          const count = filtered.filter((a) => a.owner.department === d).length
          const active = dept === d
          return (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`rounded-lg px-3 py-1.5 text-13 font-medium transition-colors ${
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d}
              <span className={`ml-1.5 tnum ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-13">
          <span className="font-medium text-brand-700">{selected.size} selected</span>
          <Btn size="sm" tone="primary" onClick={() => openBulkComposer([...selected])}>
            <Send size={13} /> Contact {selected.size}
          </Btn>
          <Btn size="sm" onClick={bulkNudge}><Bell size={13} /> Bulk nudge</Btn>
          <Btn size="sm" onClick={bulkReassign}><Users size={13} /> Bulk reassign</Btn>
          <button className="text-12 text-slate-500 underline-offset-2 hover:underline" onClick={() => setSelected(new Set())}>clear</button>
        </div>
      )}

      <div className="thin-scroll overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-card">
        <table className="w-full text-13">
          <thead className="border-b border-[var(--line)] bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2.5"></th>
              <th className="px-3 py-2.5 text-left">APP ID</th>
              <th className="px-3 py-2.5 text-left">Student</th>
              <th className="px-3 py-2.5 text-left">Stage / status</th>
              <th className="px-3 py-2.5 text-right">Ask</th>
              <th className="px-3 py-2.5 text-left">Blocker</th>
              <th className="px-3 py-2.5 text-left">
                <button className="inline-flex items-center gap-1 hover:text-slate-700" onClick={() => setSortDesc((v) => !v)}>
                  Days <ArrowUpDown size={12} />
                </button>
              </th>
              <th className="px-3 py-2.5 text-left">Owner</th>
              <th className="px-3 py-2.5 text-left">Next action</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <QueueRow
                key={a.appId}
                app={a}
                checked={selected.has(a.appId)}
                onToggle={() => toggle(a.appId)}
                onOpen={() => openApp(a.appId)}
                onNudge={() => nudge(a.appId)}
                onContact={() => openComposer(a.appId, 'message')}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400">No applications in this queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-11 text-slate-400">
        Auto-assignment = round-robin within a department on forward-move (logged in audit).
      </p>
    </div>
  )
}

function ViewSwitch({
  view, setView, hitlCount,
}: {
  view: 'worklist' | 'hitl'
  setView: (v: 'worklist' | 'hitl') => void
  hitlCount: number
}) {
  return (
    <div className="mb-3 inline-flex rounded-xl border border-[var(--line)] bg-white p-1 shadow-card">
      {([['worklist', 'Work-list'], ['hitl', 'HITL review']] as const).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`rounded-lg px-3 py-1.5 text-13 font-medium transition-colors ${
            view === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {label}
          {id === 'hitl' && hitlCount > 0 && (
            <span className={`ml-1.5 tnum ${view === id ? 'text-white/80' : 'text-amber-600'}`}>{hitlCount}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function QueueRow({
  app, checked, onToggle, onOpen, onNudge, onContact,
}: {
  app: Application
  checked: boolean
  onToggle: () => void
  onOpen: () => void
  onNudge: () => void
  onContact: () => void
}) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-brand-600" />
      </td>
      <td className="px-3 py-2.5 font-mono text-12 font-semibold tnum text-slate-600">{app.appId}</td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-slate-800">{app.studentName}</div>
        <div className="text-11 text-slate-400">{app.universityShort}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="mb-0.5 text-11 text-slate-400">{STAGE_NAME[app.stage]}</div>
        <StatusChip status={app.status} />
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tnum text-slate-700">{inr(app.askInr)}</td>
      <td className="px-3 py-2.5"><BlockerBadge app={app} /></td>
      <td className="px-3 py-2.5 tnum text-slate-600">{daysInStage(app.stageEnteredAt)}d</td>
      <td className="px-3 py-2.5 text-12 text-slate-600">{app.owner.officer}</td>
      <td className="px-3 py-2.5 text-12 text-slate-500">{summaryNextAction(app)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-0.5">
          <Btn size="sm" tone="ghost" onClick={onOpen} title="Open"><ExternalLink size={13} /></Btn>
          <Btn size="sm" tone="ghost" onClick={onContact} title="Contact customer"><Send size={13} /></Btn>
          <Btn size="sm" tone="ghost" onClick={onNudge} title="Nudge"><Bell size={13} /></Btn>
        </div>
      </td>
    </tr>
  )
}
