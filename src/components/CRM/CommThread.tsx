// ============================================================================
// Customer communication thread — all channels in one timeline, with the
// compose / call entry points (§v2 req 1).
// ============================================================================
import { Mail, MessageSquare, Phone, PhoneOff, Send } from 'lucide-react'
import type { Application, CommChannel } from '@/types'
import { useStore } from '@/store/appStore'
import { fmtDateTime } from '@/lib/format'
import { Btn, Chip, EmptyState } from '@/components/common/ui'
import { roleCan } from '@/lib/stateMachine'

const ICON: Record<CommChannel, typeof Mail> = {
  Email: Mail,
  SMS: MessageSquare,
  WhatsApp: MessageSquare,
  Call: Phone,
}
const TONE: Record<CommChannel, 'blue' | 'green' | 'teal' | 'purple'> = {
  Email: 'blue',
  SMS: 'teal',
  WhatsApp: 'green',
  Call: 'purple',
}

export function CommThread({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const openComposer = useStore((s) => s.openComposer)
  const canContact = roleCan(role, 'request_docs') || roleCan(role, 'nudge')

  const counts = app.comms.reduce<Record<string, number>>((acc, c) => {
    acc[c.channel] = (acc[c.channel] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canContact && (
          <>
            <Btn size="sm" tone="primary" onClick={() => openComposer(app.appId, 'message')}>
              <Send size={13} /> Contact customer
            </Btn>
            <Btn size="sm" onClick={() => openComposer(app.appId, 'call')}>
              <Phone size={13} /> Log a call
            </Btn>
          </>
        )}
        <div className="ml-auto flex gap-1.5">
          {(['Email', 'SMS', 'WhatsApp', 'Call'] as CommChannel[]).map((ch) =>
            counts[ch] ? (
              <Chip key={ch} tone={TONE[ch]}>{ch} {counts[ch]}</Chip>
            ) : null,
          )}
        </div>
      </div>

      {app.comms.length === 0 ? (
        <EmptyState>
          No communications yet. Use “Contact customer” to send an email, SMS or WhatsApp, or log a call.
        </EmptyState>
      ) : (
        <div className="space-y-1.5">
          {app.comms.map((c) => {
            const Icon = c.callOutcome && c.callOutcome !== 'connected' ? PhoneOff : ICON[c.channel]
            const inbound = c.direction === 'inbound'
            return (
              <div
                key={c.id}
                className={`rounded-xl border bg-white p-2.5 shadow-card ${
                  inbound ? 'border-emerald-200 bg-emerald-50/40' : 'border-[var(--line)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 text-11">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={TONE[c.channel]}>
                      <Icon size={10} /> {c.channel}
                    </Chip>
                    <span className="font-medium text-slate-700">{c.subject}</span>
                    {c.auto && <span className="text-slate-400">· auto</span>}
                    {c.ruleId && <Chip tone="amber">{c.ruleId}</Chip>}
                    {c.callOutcome && (
                      <Chip tone={c.callOutcome === 'connected' ? 'green' : 'orange'}>
                        {c.callOutcome.replace('_', ' ')}
                        {c.durationSec ? ` · ${c.durationSec}s` : ''}
                      </Chip>
                    )}
                  </span>
                  <span className="flex-shrink-0 text-slate-400">{fmtDateTime(c.ts)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-12 text-slate-600">{c.body}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                  {c.to && <span>to {c.to}</span>}
                  <span>· {c.actor ?? 'System'}</span>
                  {c.status && <span>· {c.status}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
