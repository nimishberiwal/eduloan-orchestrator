// ============================================================================
// CRM composer (§v2 req 1) — a single global drawer for reaching the customer,
// opened from the App-360 action bar, the CRM tab, Queues rows, Queues bulk
// selection and the Batches drill-down. Handles Email / SMS / WhatsApp sends
// and Call logging.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Mail, MessageSquare, Phone, Send, X } from 'lucide-react'
import type { CallOutcome, CommChannel } from '@/types'
import { useStore } from '@/store/appStore'
import { COMM_TEMPLATES } from '@/data/comms'
import { fmtDate } from '@/lib/format'
import { Btn, Chip, Field, Select, TextArea } from '@/components/common/ui'

const CHANNELS: { id: CommChannel; label: string; icon: typeof Mail }[] = [
  { id: 'Email', label: 'Email', icon: Mail },
  { id: 'SMS', label: 'SMS', icon: MessageSquare },
  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'Call', label: 'Call', icon: Phone },
]

const CALL_OUTCOMES: { id: CallOutcome; label: string }[] = [
  { id: 'connected', label: 'Connected' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'busy', label: 'Busy' },
  { id: 'callback_requested', label: 'Callback requested' },
  { id: 'wrong_number', label: 'Wrong number' },
]

/** Stage-aware template suggestions — "wherever a communication is required". */
const STAGE_TEMPLATES: Record<string, string[]> = {
  S01: ['welcome'],
  S02: ['welcome', 'doc_request'],
  S03: ['doc_request', 'nudge'],
  S04: ['doc_request', 'nudge', 'inactivity_warning'],
  S05: ['doc_rejected', 'nudge'],
  S06: ['nudge'],
  S07: ['nudge'],
  S08: ['nudge'],
  S09: ['doc_request'],
  S10: ['decision_comm'],
  S11: ['sanction_issued', 'acceptance_reminder', 'sanction_expiry'],
  S12: ['acceptance_reminder'],
  S13: ['tranche_disbursed', 'doc_request'],
}

export function CommComposer() {
  const appIds = useStore((s) => s.composerAppIds)
  const mode = useStore((s) => s.composerMode)
  const apps = useStore((s) => s.applications)
  const openComposer = useStore((s) => s.openComposer)
  const sendComm = useStore((s) => s.sendComm)
  const bulkSendComm = useStore((s) => s.bulkSendComm)
  const logCall = useStore((s) => s.logCall)

  const targets = useMemo(
    () => apps.filter((a) => appIds.includes(a.appId)),
    [apps, appIds],
  )
  const primary = targets[0]
  const isBulk = targets.length > 1

  const [channel, setChannel] = useState<CommChannel>('Email')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [duration, setDuration] = useState(120)
  const [notes, setNotes] = useState('')

  // Reset the form each time the drawer opens on a new target.
  useEffect(() => {
    if (!primary) return
    setChannel(mode === 'call' ? 'Call' : 'Email')
    setTemplateId('')
    setSubject('')
    setBody('')
    setNotes('')
    setOutcome('connected')
    setDuration(120)
  }, [primary?.appId, mode, appIds.length])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && openComposer(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [openComposer])

  if (!primary || !mode) return null

  const suggested = STAGE_TEMPLATES[String(primary.stage)] ?? []
  const available = COMM_TEMPLATES.filter(
    (t) => channel === 'Call' || t.channel === channel || suggested.includes(t.id),
  )

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const t = COMM_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setSubject(t.subject)
    // This is the first consumer of the template render() functions.
    setBody(
      t.render({
        student: primary.studentName,
        appId: primary.appId,
        docs: primary.documents.filter((d) => d.status === 'requested').map((d) => d.label).slice(0, 4).join(', ') || 'the pending items',
        doc: primary.documents.find((d) => d.status === 'rejected')?.label ?? 'the rejected document',
        validity: fmtDate(primary.sanctionExpiryDate),
        stamp: 'today',
        n: primary.tranches.find((x) => x.status !== 'remitted')?.n ?? 1,
        payee: 'the university',
      }),
    )
  }

  const canSend = channel === 'Call' ? true : subject.trim().length > 0 && body.trim().length > 0

  const submit = () => {
    if (channel === 'Call') {
      logCall(primary.appId, { outcome, durationSec: duration, notes })
    } else if (isBulk) {
      bulkSendComm(targets.map((t) => t.appId), { channel, templateId: templateId || undefined, subject, body })
    } else {
      sendComm(primary.appId, { channel, templateId: templateId || undefined, subject, body })
    }
    openComposer(null)
  }

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-slate-900/30 backdrop-blur-sm animate-fade-in" onClick={() => openComposer(null)}>
      <div
        className="flex h-full w-[min(30rem,100vw)] flex-col border-l border-[var(--line)] bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-14 font-semibold text-slate-800">
              {channel === 'Call' ? 'Log a call' : 'Contact customer'}
            </h3>
            <p className="mt-0.5 truncate text-11 text-slate-500">
              {isBulk ? (
                <>Sending to <b>{targets.length} applications</b></>
              ) : (
                <>{primary.studentName} · {primary.appId} · {String(primary.stage)}</>
              )}
            </p>
          </div>
          <button onClick={() => openComposer(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-4">
          {/* Channel */}
          <Field label="Channel">
            <div className="flex gap-1">
              {CHANNELS.map((c) => {
                const Icon = c.icon
                const on = channel === c.id
                const disabled = isBulk && c.id === 'Call'
                return (
                  <button
                    key={c.id}
                    disabled={disabled}
                    onClick={() => setChannel(c.id)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-12 font-medium transition-colors disabled:opacity-40 ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={13} /> {c.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {channel === 'Call' ? (
            <>
              <Field label="Outcome">
                <Select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Duration (seconds)">
                <input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-13"
                />
              </Field>
              <Field label="Call notes">
                <TextArea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, and what happens next…" />
              </Field>
              <p className="text-11 text-slate-400">
                Calling to {primary.studentName} on a masked number. The prototype records the disposition; it does not place a real call.
              </p>
            </>
          ) : (
            <>
              {!isBulk && suggested.length > 0 && (
                <Field label={`Suggested for ${String(primary.stage)}`}>
                  <div className="flex flex-wrap gap-1">
                    {suggested.map((id) => {
                      const t = COMM_TEMPLATES.find((x) => x.id === id)
                      if (!t) return null
                      return (
                        <button
                          key={id}
                          onClick={() => { setChannel(t.channel); applyTemplate(id) }}
                          className={`rounded-md border px-2 py-0.5 text-11 font-medium transition-colors ${
                            templateId === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {t.subject}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              <Field label="Template">
                <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">— write from scratch —</option>
                  {available.map((t) => (
                    <option key={t.id} value={t.id}>{t.subject} ({t.channel})</option>
                  ))}
                </Select>
              </Field>

              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-13"
                />
              </Field>

              <Field label="Message">
                <TextArea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message to the customer…" />
              </Field>

              {!isBulk && (
                <div className="flex items-center gap-2 text-11 text-slate-400">
                  <span>To:</span>
                  <Chip tone="slate">
                    {channel === 'Email' ? 'a•••@gmail.com' : '+91-98•••••' + primary.appId.slice(-3)}
                  </Chip>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3">
          <span className="text-11 text-slate-400">
            {isBulk ? `${targets.length} recipients` : 'Logged to the application timeline & audit trail'}
          </span>
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => openComposer(null)}>Cancel</Btn>
            <Btn size="sm" tone="primary" disabled={!canSend} onClick={submit}>
              <Send size={13} /> {channel === 'Call' ? 'Save call log' : isBulk ? `Send to ${targets.length}` : 'Send'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
