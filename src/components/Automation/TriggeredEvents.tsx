// ============================================================================
// Triggered-event log + approval queue for destructive automation (§v2 req 2).
// ============================================================================
import { useState } from 'react'
import { Check, ShieldAlert, X } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { fmtDateTime } from '@/lib/format'
import { STAGE_NAME } from '@/data/stages'
import { Btn, Chip, EmptyState, Field, Modal, TextArea } from '@/components/common/ui'
import type { AutomationEvent } from '@/types'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  applied: 'green',
  pending_approval: 'amber',
  approved: 'blue',
  rejected: 'red',
  skipped: 'slate',
}

export function TriggeredEvents() {
  const log = useStore((s) => s.automationLog)
  const pending = useStore((s) => s.pendingAutomation)
  const approve = useStore((s) => s.approvePendingAutomation)
  const reject = useStore((s) => s.rejectPendingAutomation)
  const openApp = useStore((s) => s.openApp)
  const [rejecting, setRejecting] = useState<AutomationEvent | null>(null)
  const [reason, setReason] = useState('')

  return (
    <div className="space-y-4">
      {/* Approval queue */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
        <h3 className="flex items-center gap-1.5 text-13 font-semibold text-slate-700">
          <ShieldAlert size={14} className="text-amber-500" />
          Awaiting approval
          <span className="ml-1 tnum text-slate-400">{pending.length}</span>
        </h3>
        <p className="mt-0.5 text-11 text-slate-500">
          Destructive actions (closing or rejecting a file) are never applied automatically — an officer must approve them.
        </p>

        {pending.length === 0 ? (
          <EmptyState>Nothing awaiting approval.</EmptyState>
        ) : (
          <div className="mt-2 space-y-1.5">
            {pending.map((e) => (
              <div key={e.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-11">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="red">{e.action.label}</Chip>
                    <button onClick={() => openApp(e.appId)} className="font-mono font-semibold text-brand-600 hover:underline">
                      {e.appId}
                    </button>
                    <span className="text-slate-500">{String(e.stage)} · {STAGE_NAME[String(e.stage)] ?? ''}</span>
                    <span className="font-mono text-slate-400">{e.ruleId}</span>
                  </span>
                  <span className="text-slate-400">{fmtDateTime(e.ts)}</span>
                </div>
                <div className="mt-1 text-12 text-slate-600">{e.detail}</div>
                <div className="mt-1.5 flex gap-2">
                  <Btn size="sm" tone="primary" onClick={() => approve(e.id)}>
                    <Check size={12} /> Approve & apply
                  </Btn>
                  <Btn size="sm" onClick={() => { setRejecting(e); setReason('') }}>
                    <X size={12} /> Dismiss
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full log */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
        <h3 className="text-13 font-semibold text-slate-700">
          Event log <span className="ml-1 tnum text-slate-400">{log.length}</span>
        </h3>
        {log.length === 0 ? (
          <EmptyState>No automation has run yet. Use “Run sweep now”.</EmptyState>
        ) : (
          <div className="thin-scroll mt-2 max-h-[28rem] overflow-auto">
            <table className="w-full text-12">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1 text-left">When</th>
                  <th className="py-1 text-left">Rule</th>
                  <th className="py-1 text-left">Application</th>
                  <th className="py-1 text-left">Action</th>
                  <th className="py-1 text-left">Status</th>
                  <th className="py-1 text-left">Decided by</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-1 whitespace-nowrap text-11 text-slate-400">{fmtDateTime(e.ts)}</td>
                    <td className="py-1">
                      <span className="font-mono text-11 text-slate-500">{e.ruleId}</span>
                      <div className="text-11 text-slate-400">{e.ruleName}</div>
                    </td>
                    <td className="py-1">
                      <button onClick={() => openApp(e.appId)} className="font-mono text-11 font-semibold text-brand-600 hover:underline">
                        {e.appId}
                      </button>
                      <div className="text-11 text-slate-400">{String(e.stage)}</div>
                    </td>
                    <td className="py-1 text-slate-600">{e.action.label}</td>
                    <td className="py-1"><Chip tone={STATUS_TONE[e.status] ?? 'slate'}>{e.status.replace('_', ' ')}</Chip></td>
                    <td className="py-1 text-11 text-slate-500">
                      {e.decidedBy ?? (e.status === 'applied' ? 'System' : '—')}
                      {e.decisionNote && <div className="text-slate-400">{e.decisionNote}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <Modal title="Dismiss automation action" onClose={() => setRejecting(null)}>
          <p className="mb-3 text-12 text-slate-600">
            <b>{rejecting.action.label}</b> on {rejecting.appId} ({rejecting.ruleId}).
          </p>
          <Field label="Reason">
            <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action not appropriate?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn size="sm" onClick={() => setRejecting(null)}>Cancel</Btn>
            <Btn size="sm" tone="danger" disabled={!reason.trim()} onClick={() => { reject(rejecting.id, reason); setRejecting(null) }}>
              Dismiss action
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
