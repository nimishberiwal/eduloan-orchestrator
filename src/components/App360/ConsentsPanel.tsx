// ============================================================================
// Consent ledger (§v3) — the seven consent-gated digital sources from the
// BRD-18-21 Document Checklist.
//
// The product point: "waiting on the customer" has two distinct meanings — a
// document they must upload, and a consent they must grant. Granting one
// consent releases a whole class of documents at once.
// ============================================================================
import { useState } from 'react'
import { Check, Download, ShieldCheck, X } from 'lucide-react'
import type { Application, ConsentArtifact } from '@/types'
import { useStore } from '@/store/appStore'
import { CONSENT_BY_TYPE, CONSENT_STATUS_TONE } from '@/data/consents'
import { sourceLabel } from '@/data/sources'
import { docsUnlockedBy, sourcingMix } from '@/lib/sourcing'
import { fmtDate } from '@/lib/format'
import { Btn, Chip, Field, Modal, TextArea } from '@/components/common/ui'

export function ConsentsPanel({ app }: { app: Application }) {
  const requestConsent = useStore((s) => s.requestConsent)
  const grantConsent = useStore((s) => s.grantConsent)
  const revokeConsent = useStore((s) => s.revokeConsent)
  const declineConsent = useStore((s) => s.declineConsent)
  const runAutoFetch = useStore((s) => s.runAutoFetch)
  const [declining, setDeclining] = useState<ConsentArtifact | null>(null)
  const [reason, setReason] = useState('')

  const mix = sourcingMix(app)
  const granted = app.consents.filter((c) => c.status === 'granted').length

  return (
    <div>
      {/* Sourcing economics for this file */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Consents granted" value={`${granted} / ${app.consents.length}`} />
        <Stat label="Auto-fetchable" value={String(mix.byMode.auto_fetch + mix.byMode.internal)} sub="no customer action" tone="emerald" />
        <Stat label="Behind consent" value={String(mix.byMode.consent_fetch)} sub={`${mix.outstandingBlockedOnConsent} still blocked`} tone="blue" />
        <Stat label="Manual upload" value={String(mix.byMode.manual_upload)} sub={`${mix.outstandingManual} outstanding`} tone="amber" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn size="sm" tone="primary" onClick={() => runAutoFetch(app.appId)}>
          <Download size={13} /> Run auto-fetch
        </Btn>
        <span className="text-11 text-slate-500">
          Pulls every public-registry document (NSDL, Passport Seva, CHEA, ABET, SEVIS, SRO…) — no consent needed.
        </span>
      </div>

      <div className="space-y-2">
        {app.consents.map((c) => {
          const def = CONSENT_BY_TYPE[c.type]
          const unlocked = docsUnlockedBy(app, c.type)
          const stillOutstanding = unlocked.filter((d) => d.status === 'requested').length
          return (
            <div key={c.id} className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ShieldCheck size={14} className="text-slate-400" />
                    <span className="text-13 font-semibold text-slate-800">{c.label}</span>
                    <Chip tone={(CONSENT_STATUS_TONE[c.status] ?? 'slate') as 'green'}>
                      {c.status.replace('_', ' ')}
                    </Chip>
                    <span className="text-11 text-slate-400">
                      {c.partyName} · {c.partyRole.replace('_', '-')}
                    </span>
                  </div>
                  <p className="mt-1 text-11 leading-snug text-slate-500">{def?.mechanism}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {def?.unlocks.map((u) => (
                      <Chip key={u} tone="slate">{sourceLabel(u)}</Chip>
                    ))}
                    <span className="text-11 text-slate-400">
                      unlocks {unlocked.length} document{unlocked.length === 1 ? '' : 's'}
                      {stillOutstanding > 0 && <b className="text-amber-600"> · {stillOutstanding} still outstanding</b>}
                    </span>
                  </div>
                  {c.status === 'granted' && (
                    <div className="mt-1 text-11 text-slate-400">
                      handle {c.handle} · granted {fmtDate(c.decidedAt)} · expires {fmtDate(c.expiresAt)}
                    </div>
                  )}
                  {c.declineReason && (
                    <div className="mt-1 text-11 text-red-600">Declined — {c.declineReason}</div>
                  )}
                </div>

                <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                  {c.status !== 'granted' && (
                    <>
                      {c.status === 'not_requested' && (
                        <Btn size="sm" onClick={() => requestConsent(app.appId, c.type)}>Request</Btn>
                      )}
                      <Btn size="sm" tone="primary" onClick={() => grantConsent(app.appId, c.type)}>
                        <Check size={12} /> Grant &amp; fetch
                      </Btn>
                      <Btn size="sm" onClick={() => { setDeclining(c); setReason('') }}>
                        <X size={12} /> Decline
                      </Btn>
                    </>
                  )}
                  {c.status === 'granted' && (
                    <Btn size="sm" onClick={() => revokeConsent(app.appId, c.type)}>Revoke</Btn>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {declining && (
        <Modal title={`Decline — ${declining.label}`} onClose={() => setDeclining(null)}>
          <p className="mb-3 text-12 text-slate-600">
            The documents behind this consent will fall back to <b>manual upload</b> — the file is not blocked, but
            the customer must now provide them directly.
          </p>
          <Field label="Reason">
            <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was consent refused?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn size="sm" onClick={() => setDeclining(null)}>Cancel</Btn>
            <Btn size="sm" tone="danger" disabled={!reason.trim()}
              onClick={() => { declineConsent(app.appId, declining.type, reason); setDeclining(null) }}>
              Record decline
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const color =
    tone === 'emerald' ? 'text-emerald-600'
    : tone === 'blue' ? 'text-blue-600'
    : tone === 'amber' ? 'text-amber-600'
    : 'text-slate-800'
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="text-11 text-slate-400">{sub}</div>}
    </div>
  )
}
