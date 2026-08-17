// ============================================================================
// HITL review queue (§v3) — the pipeline's `hitl` node made operational.
//
// Cases are derived live from application state; only the officer's decision is
// persisted. That means the queue can never go stale against the file.
// ============================================================================
import { useMemo, useState } from 'react'
import { UserSearch } from 'lucide-react'
import type { HitlCase, HitlStatus } from '@/types'
import { useStore } from '@/store/appStore'
import { buildHitlQueue } from '@/lib/hitl'
import { HITL_BY_TRIGGER, HITL_DEFS, HITL_STATUS_TONE } from '@/data/hitl'
import { applyFilters } from '@/lib/filters'
import { inr } from '@/lib/format'
import { STAGE_NAME } from '@/data/stages'
import { Btn, Chip, EmptyState, Field, Modal, Select, TextArea } from '@/components/common/ui'

export function HitlQueue() {
  const all = useStore((s) => s.applications)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const clauses = useStore((s) => s.filterClauses)
  const role = useStore((s) => s.role)
  const decisions = useStore((s) => s.hitlDecisions)
  const openApp = useStore((s) => s.openApp)
  const resolveHitl = useStore((s) => s.resolveHitl)

  const [triggerFilter, setTriggerFilter] = useState<string>('')
  const [showResolved, setShowResolved] = useState(false)
  const [resolving, setResolving] = useState<HitlCase | null>(null)
  const [status, setStatus] = useState<HitlStatus>('cleared')
  const [note, setNote] = useState('')

  const apps = useMemo(
    () => applyFilters(all, search, filters, role, clauses),
    [all, search, filters, role, clauses],
  )
  const cases = useMemo(() => buildHitlQueue(apps, decisions), [apps, decisions])
  const visible = cases.filter(
    (c) =>
      (!triggerFilter || c.trigger === triggerFilter) &&
      (showResolved || c.status === 'open' || c.status === 'in_review'),
  )
  const openCount = cases.filter((c) => c.status === 'open' || c.status === 'in_review').length
  const byTrigger = HITL_DEFS.map((d) => ({
    def: d,
    n: cases.filter((c) => c.trigger === d.trigger && (c.status === 'open' || c.status === 'in_review')).length,
  }))
  const appOf = (id: string) => all.find((a) => a.appId === id)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <UserSearch size={16} />
        </span>
        <div className="leading-tight">
          <div className="text-13 font-semibold text-slate-800">Human-in-the-loop review</div>
          <div className="text-11 text-slate-500">
            {openCount} open case{openCount === 1 ? '' : 's'} — decisions automation deliberately refuses to make
          </div>
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-12 text-slate-600">
          <input type="checkbox" checked={showResolved} onChange={() => setShowResolved((v) => !v)} className="accent-brand-600" />
          Show resolved
        </label>
      </div>

      {/* Trigger filter */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setTriggerFilter('')}
          className={`rounded-full border px-2.5 py-1 text-11 font-medium transition-colors ${
            !triggerFilter ? 'border-slate-800 bg-slate-800 text-white' : 'border-[var(--line)] bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          All triggers {openCount}
        </button>
        {byTrigger.map(({ def, n }) => (
          <button
            key={def.trigger}
            onClick={() => setTriggerFilter(triggerFilter === def.trigger ? '' : def.trigger)}
            className={`rounded-full border px-2.5 py-1 text-11 font-medium transition-colors ${
              triggerFilter === def.trigger
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-[var(--line)] bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {def.title} <span className={triggerFilter === def.trigger ? 'text-white/70' : 'text-slate-400'}>{n}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState>No HITL cases match the current scope.</EmptyState>
      ) : (
        <div className="space-y-2">
          {visible.slice(0, 80).map((c) => {
            const def = HITL_BY_TRIGGER[c.trigger]
            const app = appOf(c.appId)
            return (
              <div key={c.id} className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone={def.severity === 'critical' ? 'red' : def.severity === 'warn' ? 'amber' : 'blue'}>
                        {def.severity}
                      </Chip>
                      <span className="text-13 font-semibold text-slate-800">{def.title}</span>
                      <Chip tone={HITL_STATUS_TONE[c.status] ?? 'slate'}>{c.status.replace('_', ' ')}</Chip>
                      <Chip tone="slate">{def.owner}</Chip>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-11 text-slate-500">
                      <button onClick={() => openApp(c.appId)} className="font-mono font-semibold text-brand-600 hover:underline">
                        {c.appId}
                      </button>
                      {app && <span>{app.studentName} · {app.universityShort}</span>}
                      <span>{String(c.stage)} · {STAGE_NAME[String(c.stage)] ?? ''}</span>
                      {app && <span className="font-semibold text-slate-700">{inr(app.askInr)}</span>}
                      <span className="font-mono text-slate-400">{def.brdRef}</span>
                    </div>
                    <p className="mt-1.5 max-w-3xl text-12 leading-snug text-slate-600">{def.question}</p>
                    {c.resolution && (
                      <p className="mt-1 text-11 text-emerald-700">
                        {c.resolvedBy}: {c.resolution}
                      </p>
                    )}
                  </div>
                  {(c.status === 'open' || c.status === 'in_review') && (
                    <Btn size="sm" tone="primary" onClick={() => { setResolving(c); setStatus('cleared'); setNote('') }}>
                      Review
                    </Btn>
                  )}
                </div>
              </div>
            )
          })}
          {visible.length > 80 && (
            <div className="py-2 text-center text-11 text-slate-400">showing first 80 of {visible.length}</div>
          )}
        </div>
      )}

      {resolving && (
        <Modal title={HITL_BY_TRIGGER[resolving.trigger].title} onClose={() => setResolving(null)} wide>
          <div className="mb-3 rounded-lg border border-[var(--line)] bg-slate-50 p-2 text-12 text-slate-600">
            <b>{resolving.appId}</b> · {String(resolving.stage)} — {HITL_BY_TRIGGER[resolving.trigger].question}
          </div>
          <Field label="Decision">
            <Select value={status} onChange={(e) => setStatus(e.target.value as HitlStatus)}>
              <option value="cleared">Cleared — proceed</option>
              <option value="in_review">In review — keep open</option>
              <option value="escalated">Escalate to a higher authority</option>
              <option value="declined">Decline — route to rejection</option>
            </Select>
          </Field>
          <Field label="Reviewer note">
            <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you verify, and what did you conclude?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn size="sm" onClick={() => setResolving(null)}>Cancel</Btn>
            <Btn size="sm" tone="primary" disabled={!note.trim()}
              onClick={() => { resolveHitl(resolving.appId, resolving.trigger, status, note); setResolving(null) }}>
              Record decision
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
