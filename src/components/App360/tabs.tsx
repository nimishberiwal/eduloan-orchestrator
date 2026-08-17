// ============================================================================
// Application 360 tab-strip content (§12.3.4)
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ExternalLink, RefreshCw, Send, ShieldCheck, UserPlus,
} from 'lucide-react'
import { useStore, addNote } from '@/store/appStore'
import { SECTION_LABEL, SECTION_ORDER, bucketStatus } from '@/data/buckets'
import { VALIDATION_BY_ID } from '@/data/validations'
import { effectiveBand, bandApprover } from '@/lib/doa'
import { fmtDate, fmtDateTime, inr, usd } from '@/lib/format'
import { POLICY } from '@/data/policy'
import type { Application, DocumentItem, PartySection, ValidationTier } from '@/types'
import { Btn, Chip, Field, MatchChip, Modal, EmptyState, StatusChip, TextArea } from '@/components/common/ui'
import { roleCan } from '@/lib/stateMachine'
import { CommThread } from '@/components/CRM/CommThread'
import { MODE_LABEL, MODE_TONE, SOURCE_BY_SYSTEM, sourceLabel } from '@/data/sources'
import { consentProgress, isBlockedOnConsent, sourcingMix } from '@/lib/sourcing'
import { ambiguityReason } from '@/data/classification'
import { briefFromRun, runUniversitySwarm } from '@/lib/agents/university'
import { BRIEF_TTL_HOURS, briefStaleness } from '@/lib/agents/university'

// ---- Documents -------------------------------------------------------------
export function DocumentsTab({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const verifyDoc = useStore((s) => s.verifyDoc)
  const waiveDocument = useStore((s) => s.waiveDocument)
  const canVerify = roleCan(role, 'verify_doc')
  const [waiving, setWaiving] = useState<DocumentItem | null>(null)
  const [waiveReason, setWaiveReason] = useState('')

  const tierFlipped = app.audit.some((a) => a.verb.startsWith('CHECKLIST_REGENERATED'))
  const addedParties = app.buckets.filter((b) => b.instance).length > 0
  const mix = sourcingMix(app)
  const consents = consentProgress(app)
  const setApp360Tab = useStore((s) => s.setApp360Tab)
  const runAutoFetch = useStore((s) => s.runAutoFetch)

  return (
    <div>
      {/* §v3 — how this checklist is actually sourced (BRD "Digital Source") */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sourcing</span>
        <span className="text-12 text-slate-600">
          <b className="tnum text-emerald-600">{mix.byMode.auto_fetch + mix.byMode.internal}</b> auto-fetchable
        </span>
        <span className="text-12 text-slate-600">
          <b className="tnum text-blue-600">{mix.byMode.consent_fetch}</b> behind consent
          <span className="text-slate-400"> ({consents.granted} of {consents.total} granted)</span>
        </span>
        <span className="text-12 text-slate-600">
          <b className="tnum text-amber-600">{mix.byMode.manual_upload}</b> manual upload
        </span>
        <span className="text-12 text-slate-600">
          <b className="tnum text-purple-600">{mix.byMode.bank_generated}</b> bank / panel
        </span>
        <span className="ml-auto flex items-center gap-2">
          {mix.outstandingBlockedOnConsent > 0 && (
            <button onClick={() => setApp360Tab('consents')}
              className="rounded-md bg-red-50 px-2 py-0.5 text-11 font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100">
              {mix.outstandingBlockedOnConsent} blocked on consent →
            </button>
          )}
          <Btn size="sm" onClick={() => runAutoFetch(app.appId)}>Run auto-fetch</Btn>
        </span>
      </div>

      {tierFlipped && (
        <div className="mb-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-800">
          <RefreshCw size={14} className="mt-0.5" />
          <span>Checklist regenerated (Premier-Overlay → Tier-3). Collateral buckets C1–C4 and L2 mortgage rows were added after VAL-CRS-09 failed.</span>
        </div>
      )}
      {addedParties && (
        <div className="mb-3 flex items-start gap-2 rounded border border-brand-200 bg-brand-50 p-2 text-[12px] text-brand-800">
          <UserPlus size={14} className="mt-0.5" />
          <span>Checklist extended for an additional co-applicant (buckets suffixed <span className="font-mono">#2</span>). Existing verified documents were preserved.</span>
        </div>
      )}
      {SECTION_ORDER.map((section) => {
        const buckets = app.buckets.filter((b) => b.section === section)
        if (buckets.length === 0) return null
        return (
          <details key={section} open className="mb-2 rounded-xl border border-[var(--line)] bg-white shadow-card">
            <summary className="cursor-pointer select-none px-3 py-2 text-13 font-semibold text-slate-700">
              {SECTION_LABEL[section]} <span className="text-[11px] font-normal text-slate-400">({buckets.length} buckets)</span>
            </summary>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-left">Bucket</th>
                    <th className="px-2 py-1 text-left">Document</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Source</th>
                    <th className="px-2 py-1 text-left">Valid until</th>
                    <th className="px-2 py-1 text-left">Ver</th>
                    <th className="px-2 py-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => {
                    const docs = app.documents.filter((d) => d.bucketId === b.id)
                    const bs = bucketStatus(app.documents, b.id)
                    return docs.map((d, di) => (
                      <tr key={d.id} className="border-t border-slate-50">
                        {di === 0 ? (
                          <td rowSpan={docs.length} className="border-r border-slate-100 px-2 py-1 align-top">
                            <div className="font-semibold text-slate-600">{b.code}</div>
                            <div className="text-[10px] text-slate-400">{b.title}</div>
                            <div className="mt-1"><DocChip status={bs} /></div>
                            <div className="mt-1 text-[9px] uppercase text-slate-400">{b.requiredByStage}</div>
                          </td>
                        ) : null}
                        <td className="px-2 py-1">
                          {d.label} {d.mandate === 'M' && <span className="text-red-400">*</span>}
                          {d.stale && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-700">expired at decision date</span>}
                          {d.classification && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <span className="rounded bg-slate-100 px-1 font-mono text-[9px] text-slate-500">
                                {d.classification.label}
                              </span>
                              <span className={`text-[9px] ${d.classification.status === 'classified' ? 'text-slate-400' : 'text-amber-600'}`}>
                                {Math.round(d.classification.confidence * 100)}%
                              </span>
                              {d.classification.status !== 'classified' && (
                                <button
                                  onClick={() => verifyDoc(app.appId, d.id, 'reject', `Low-confidence classification — ${ambiguityReason(d.label) ?? 'type could not be bound'}`)}
                                  className="rounded bg-amber-50 px-1 text-[9px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                                  title={ambiguityReason(d.label)}
                                >
                                  low confidence → request re-upload
                                </button>
                              )}
                            </div>
                          )}
                          {d.reason && <div className="text-[10px] text-red-500">{d.reason}</div>}
                        </td>
                        <td className="px-2 py-1"><DocChip status={d.status} /></td>
                        <td className="px-2 py-1">
                          <SourceCell app={app} doc={d} />
                        </td>
                        <td className="px-2 py-1 text-slate-500">{d.validUntil ? fmtDate(d.validUntil) : '—'}</td>
                        <td className="px-2 py-1 text-slate-500">v{d.version}</td>
                        <td className="px-2 py-1">
                          {canVerify && d.status !== 'verified' && d.status !== 'waived' && (
                            <div className="flex gap-1">
                              <Btn size="sm" tone="ghost" onClick={() => verifyDoc(app.appId, d.id, 'verify')}>Verify</Btn>
                              <Btn size="sm" tone="ghost" onClick={() => verifyDoc(app.appId, d.id, 'reject', 'Re-upload requested')}>Reject</Btn>
                              <Btn size="sm" tone="ghost" onClick={() => setWaiving(d)}>Waive</Btn>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}

      {waiving && (
        <Modal title="Waive document" onClose={() => setWaiving(null)}>
          <div className="mb-3 rounded-lg border border-[var(--line)] bg-slate-50 p-2 text-[12px] text-slate-600">
            Waiving <b>{waiving.label}</b> is an application-level deviation. It is recorded as{' '}
            <b>DEV-09</b> against this file and requires approval at{' '}
            {app.askInr < 50_00_000 ? 'Central Risk' : 'Credit Committee'}.
          </div>
          <Field label="Reason for waiver">
            <TextArea
              rows={3}
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="Why can this requirement be waived on this file?"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn size="sm" onClick={() => setWaiving(null)}>Cancel</Btn>
            <Btn
              size="sm"
              tone="primary"
              disabled={!waiveReason.trim()}
              onClick={() => { waiveDocument(app.appId, waiving.id, waiveReason); setWaiving(null); setWaiveReason('') }}
            >
              Waive & raise DEV-09
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** §v3 — where this document actually comes from, and whether the bank can get
 *  it without the customer. */
function SourceCell({ app, doc }: { app: Application; doc: DocumentItem }) {
  const blocked = isBlockedOnConsent(app, doc)
  const def = SOURCE_BY_SYSTEM[doc.sourceSystem]
  return (
    <div className="leading-tight" title={def?.note}>
      <div className="text-[11px] font-medium text-slate-600">{sourceLabel(doc.sourceSystem)}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <Chip tone={MODE_TONE[doc.sourcing]}>{MODE_LABEL[doc.sourcing]}</Chip>
        {blocked && <Chip tone="red">consent needed</Chip>}
      </div>
    </div>
  )
}

function DocChip({ status }: { status: DocumentItem['status'] }) {
  const map: Record<string, { tone: Parameters<typeof Chip>[0]['tone']; label: string }> = {
    requested: { tone: 'amber', label: 'requested' },
    uploaded: { tone: 'blue', label: 'uploaded' },
    fetched: { tone: 'teal', label: 'fetched' },
    extracted: { tone: 'blue', label: 'extracted' },
    qc_pass: { tone: 'green', label: 'qc pass' },
    qc_fail: { tone: 'red', label: 'qc fail' },
    verified: { tone: 'green', label: 'verified' },
    rejected: { tone: 'red', label: 'rejected' },
    waived: { tone: 'teal', label: 'waived' },
  }
  const m = map[status]
  return <Chip tone={m.tone}>{m.label}</Chip>
}

// ---- Extracted data --------------------------------------------------------
export function ExtractedTab({ app }: { app: Application }) {
  const toggle = useStore((s) => s.toggleExtractedField)
  const groups: Record<PartySection, Record<string, typeof app.extracted>> = {
    applicant: {}, co_applicant: {}, collateral: {}, loan: {},
  }
  for (const f of app.extracted) {
    ;(groups[f.section][f.group] ??= []).push(f)
  }
  return (
    <div className="space-y-3">
      {SECTION_ORDER.map((section) => {
        const gs = groups[section]
        if (Object.keys(gs).length === 0) return null
        return (
          <div key={section}>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{SECTION_LABEL[section]}</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(gs).map(([group, fields]) => (
                <div key={group} className="rounded-xl border border-[var(--line)] bg-white shadow-card p-2">
                  <div className="mb-1 text-[11px] font-semibold text-slate-500">{group}</div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f.id} className="border-t border-slate-50">
                          <td className="py-1 pr-2 text-slate-500">
                            {f.label} {f.derived && <span className="ml-0.5 rounded bg-slate-100 px-1 text-[9px] italic text-slate-500">ƒ</span>}
                          </td>
                          <td className="py-1 pr-2 text-slate-700">{f.enteredValue}</td>
                          <td className="py-1 pr-2 text-slate-700">{f.extractedValue}</td>
                          <td className="py-1 text-right"><MatchChip match={f.match} /></td>
                          {f.label === 'endorsement_verified' && (
                            <td className="py-1 pl-1">
                              <button onClick={() => toggle(app.appId, f.id)} className="rounded border border-slate-300 px-1 text-[10px] hover:bg-slate-50">flip</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Validations -----------------------------------------------------------
export function ValidationsTab({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const waive = useStore((s) => s.waiveValidation)
  const canWaive = roleCan(role, 'waive_validation')
  const tiers: { tier: ValidationTier; label: string }[] = [
    { tier: 'INT', label: 'Tier 1 · Intra-document' },
    { tier: 'CRS', label: 'Tier 2 · Cross-document' },
    { tier: 'EXT', label: 'Tier 3 · External verification' },
  ]
  const retryIntegration = useStore((s) => s.retryIntegration)

  return (
    <div className="space-y-3">
      {tiers.map(({ tier, label }) => {
        const rows = app.validations.filter((v) => VALIDATION_BY_ID[v.catalogueId]?.tier === tier)
        return (
          <div key={tier}>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</h4>
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
              <table className="w-full text-[12px]">
                <tbody>
                  {rows.map((v) => {
                    const def = VALIDATION_BY_ID[v.catalogueId]
                    const isFail = v.status === 'fail'
                    return (
                      <tr key={v.catalogueId} className={`border-t border-slate-50 ${isFail ? 'bg-red-50/50' : ''}`}>
                        <td className="w-28 px-2 py-1.5 align-top">
                          <div className="font-mono text-[11px] font-semibold text-slate-500">{v.catalogueId}</div>
                          {def?.brdRef && (
                            <div className="mt-0.5 font-mono text-[10px] text-brand-600" title="Originating BRD rule">
                              {def.brdRef}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <div className="font-medium text-slate-700">{def?.title}</div>
                          <div className={`mt-0.5 text-[11px] ${isFail ? 'text-red-600' : 'text-slate-500'}`}>
                            {v.status === 'pending' ? '— pending —' : v.message}
                          </div>
                        </td>
                        <td className="w-28 px-2 py-1.5 align-top">
                          <ValChip status={v.status} sev={def?.severity ?? 'INFO'} />
                        </td>
                        <td className="w-24 px-2 py-1.5 align-top text-right">
                          {canWaive && def?.severity === 'WARN' && v.status === 'fail' && (
                            <Btn size="sm" tone="ghost" onClick={() => waive(app.appId, v.catalogueId)}>Waive</Btn>
                          )}
                          {tier === 'EXT' && v.status === 'fail' && (
                            <Btn size="sm" tone="ghost" onClick={() => {
                              const call = app.integrations.find((c) => c.linkedValidationId === v.catalogueId)
                              if (call) retryIntegration(app.appId, call.id)
                            }}>Retry</Btn>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ValChip({ status, sev }: { status: string; sev: string }) {
  const tone = status === 'pass' ? 'green' : status === 'fail' ? 'red' : status === 'waived' ? 'teal' : 'slate'
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Chip tone={tone as any}>{status}</Chip>
      <span className="text-[9px] text-slate-400">{sev}</span>
    </div>
  )
}

// ---- Decision (CAM-lite) ---------------------------------------------------
export function DecisionTab({ app }: { app: Application }) {
  const band = effectiveBand(app)
  const foirP = app.extracted.find((f) => f.label === 'foir_post_moratorium_pct')?.extractedValue ?? '48'
  const foirM = app.extracted.find((f) => f.label === 'foir_moratorium_pct')?.extractedValue ?? '62'
  const ltv = app.extracted.find((f) => f.label === 'ltv_pct')?.extractedValue

  const failing = app.validations.filter((v) => v.status === 'fail')
  const passing = app.validations.filter((v) => v.status === 'pass').length
  const cam = camAnalytics(app)

  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel title="Student & program">
        <KV k="Student" v={app.studentName} />
        <KV k="Program" v={`${app.programLevel} · ${app.program}`} />
        <KV k="University" v={app.university} />
        <KV k="Intake" v={app.intake} />
      </Panel>
      <Panel title="Accreditation & overlay">
        <KV k="Tier" v={app.tier} />
        {app.overlayBasis && <KV k="Overlay basis" v={app.overlayBasis} />}
        {app.overlayCeilingInr && <KV k="Overlay ceiling" v={inr(app.overlayCeilingInr)} />}
        <KV k="Ask vs ceiling" v={app.overlayCeilingInr ? (app.askInr <= app.overlayCeilingInr ? 'within' : 'exceeds → Tier-3') : '—'} />
      </Panel>
      <Panel title="Loan structure">
        <KV k="Ask" v={inr(app.askInr)} />
        <KV k="Margin" v={`${POLICY.marginPct}% of COA`} />
        <KV k="FX" v={`₹${POLICY.fxReference.toFixed(2)}/USD`} />
        <KV k="Moratorium" v={POLICY.moratorium} />
        <KV k="Processing fee" v={`${POLICY.processingFee.pct}% (min ${inr(POLICY.processingFee.minInr)})`} />
      </Panel>
      <Panel title="Co-applicant snapshot">
        <KV k="Income branch" v={app.incomeBranch === 'salaried' ? 'Salaried' : 'Self-employed'} />
        <KV k="CIBIL" v={String(app.parties.find((p) => p.role === 'co_applicant')?.bureauScore ?? '—')} />
        <KV k="NRI overlay" v={app.nriOverlay ? 'Yes' : 'No'} />
      </Panel>

      <Panel title="Two-track FOIR vs policy">
        <FoirGauge label="During moratorium (interest-only)" value={Number(foirM)} max={POLICY.foirPolicy.duringMoratoriumMax} />
        <FoirGauge label="Post moratorium" value={Number(foirP)} max={POLICY.foirPolicy.postMoratoriumPassMax} deviationMax={POLICY.foirPolicy.postMoratoriumDeviationMax} />
      </Panel>
      <Panel title="Tier & security">
        <KV k="Security construct" v={app.securedConstruct ? 'Tier-3 (collateral)' : 'Unsecured overlay'} />
        {ltv && <KV k="LTV" v={`${ltv}% (policy ≤ ${POLICY.ltvPolicy.Immovable}%)`} />}
        <KV k="DoA band" v={`${band} → ${bandApprover(band)}`} />
      </Panel>

      {/* §v3 — BRD-21 §8.1 derived analytics */}
      <Panel title="Employability & programme signals">
        <KV k="Programmatic accreditation" v={cam.accreditation} />
        <KV k="Accreditation strength" v={cam.accreditationStrength} />
        <KV k="Post-study work outlook" v={cam.postStudyWork} />
        <KV k="Pre-PG work experience" v={cam.workExYears} />
        <p className="mt-1.5 text-11 leading-snug text-slate-400">
          Post-study work options are informational only — they strengthen the repayment-comfort view
          but are not financial covenants (BRD-21 §8).
        </p>
      </Panel>
      <Panel title="Funding & exposure">
        <KV k="Sponsorship coverage" v={cam.sponsorshipCoverage} />
        <KV k="Aggregate education-loan exposure" v={cam.aggregateExposure} />
        <KV k="Net ask after aid & margin" v={inr(app.askInr)} />
        <KV k="Moratorium" v={POLICY.moratorium} />
        <p className="mt-1.5 text-11 leading-snug text-slate-400">{POLICY.moratoriumNote}</p>
      </Panel>

      <Panel title="Open deviations" span2>
        {app.deviations.filter((d) => d.status === 'open').length === 0 ? (
          <div className="text-[12px] text-slate-400">None.</div>
        ) : (
          app.deviations.filter((d) => d.status === 'open').map((d) => (
            <div key={d.id} className="mb-1 flex items-center gap-2 text-[12px]">
              <AlertTriangle size={13} className="text-amber-500" />
              <b>{d.defId}</b> {d.title} · <span className="text-slate-500">approval: {d.approvalLevel}</span>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Validation summary" span2>
        <div className="mb-1 text-[12px] text-slate-600">{passing} passing · <span className="text-red-600">{failing.length} failing</span></div>
        {failing.map((v) => (
          <div key={v.catalogueId} className="text-[11px] text-red-600">• {v.catalogueId}: {v.message}</div>
        ))}
      </Panel>

      <div className="col-span-2 rounded-xl border border-[var(--line)] bg-white shadow-card p-3">
        <h4 className="mb-1 text-13 font-semibold text-slate-700">Recommendation & maker-checker</h4>
        <div className="text-[12px] text-slate-600">
          {app.decision ? (
            <>Decision recorded: <b>{app.decision}</b>{app.rejectionCode ? ` (${app.rejectionCode})` : ''}.</>
          ) : (
            <>Use the action bar “Final decision” control at S10 to record APPROVE / APPROVE-WITH-CONDITIONS / DECLINE / REFER.</>
          )}
          {app.pendingChecker && (
            <div className="mt-1 rounded bg-indigo-50 px-2 py-1 text-indigo-700">
              ⏳ Maker {app.pendingChecker.maker} — {app.pendingChecker.summary}. Awaiting checker countersign.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** §v3 — BRD-21 §8.1 derived analytics for the CAM. */
function camAnalytics(app: Application) {
  const ex = (label: string) => app.extracted.find((f) => f.label === label)?.extractedValue

  const accreditor = ex('programmatic_accreditor') ?? (/MBA|Business|Management|Finance/i.test(app.program) ? 'AACSB' : /CS|Computer|Engineering|ECE|Mechanical|Civil|Electrical|Robotics/i.test(app.program) ? 'ABET' : /LLM|JD|Law/i.test(app.program) ? 'ABA' : /MPH|Medic|Health/i.test(app.program) ? 'LCME' : 'Not-applicable')
  const strength =
    accreditor === 'AACSB' ? 'High — Triple-Crown body (strongest PG employability signal)'
    : accreditor === 'ABET' ? 'High — ABET-listed engineering/computing programme'
    : accreditor === 'ABA' ? 'High — ABA-accredited US law programme'
    : accreditor === 'LCME' ? 'High — LCME-accredited medical programme'
    : 'Not applicable to this programme type'

  // USA-only build, so the post-study route is the F-1 family.
  const stem = /CS|Computer|Data|Engineering|ECE|Mechanical|Civil|Electrical|Robotics|Analytics|BME|Chemical|Materials|Cybersecurity|Information Systems/i.test(app.program)
  const postStudy = stem
    ? 'F-1 OPT 12 mo + STEM-OPT extension 24 mo (36 mo total)'
    : 'F-1 OPT 12 mo (non-STEM designation)'

  const workEx = ex('total_experience_months')
  const workExYears = workEx
    ? `${(Number(workEx) / 12).toFixed(1)} yrs`
    : /MBA/i.test(app.program) ? 'Typically 2–5 yrs required for MBA admits — confirm at E8' : 'Not claimed'

  const sponsorRaw = ex('sponsor_amount')
  const sponsorInr = sponsorRaw ? Number(String(sponsorRaw).replace(/[^\d]/g, '')) : 0
  const coaTotal = app.askInr + sponsorInr
  const sponsorshipCoverage = sponsorInr > 0
    ? `${inr(sponsorInr)} — ${Math.round((sponsorInr / Math.max(1, coaTotal)) * 100)}% of programme cost`
    : 'None declared'

  const existingEl = ex('existing_education_loan_flag') === 'true' || app.validations.some(
    (v) => (v.catalogueId === 'VAL-CRS-25' || v.catalogueId === 'VAL-EXT-21') && v.status === 'fail',
  )
  const aggregateExposure = existingEl
    ? `Existing UG-EL on record + this ask ${inr(app.askInr)} — run aggregate exposure analysis`
    : `${inr(app.askInr)} — no prior education loan on the bureau`

  return {
    accreditation: `${accreditor}${accreditor === 'Not-applicable' ? '' : ' · ' + (ex('programmatic_status') ?? 'Accredited')}`,
    accreditationStrength: strength,
    postStudyWork: postStudy,
    workExYears,
    sponsorshipCoverage,
    aggregateExposure,
  }
}

function FoirGauge({ label, value, max, deviationMax }: { label: string; value: number; max: number; deviationMax?: number }) {
  const cap = deviationMax ?? max
  const pct = Math.min(100, (value / (cap * 1.3)) * 100)
  const breach = value > (deviationMax ?? max)
  const dev = deviationMax != null && value > max && value <= deviationMax
  const color = breach ? 'bg-red-500' : dev ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] text-slate-500"><span>{label}</span><span className={breach ? 'text-red-600' : dev ? 'text-amber-600' : 'text-emerald-600'}>{value}% (≤{max}{deviationMax ? `/${deviationMax}` : ''}%)</span></div>
      <div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function Panel({ title, children, span2 }: { title: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`rounded-xl border border-[var(--line)] bg-white shadow-card p-3 ${span2 ? 'col-span-2' : ''}`}>
      <h4 className="mb-1.5 text-13 font-semibold text-slate-700">{title}</h4>
      {children}
    </div>
  )
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-slate-50 py-0.5 text-[12px] first:border-t-0">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-700">{v}</span>
    </div>
  )
}

// ---- Covenants -------------------------------------------------------------
export function CovenantsTab({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const clearCovenant = useStore((s) => s.clearCovenant)
  const canClear = roleCan(role, 'clear_covenant')
  if (app.covenants.length === 0) return <EmptyState>No covenants attached.</EmptyState>
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
      <table className="w-full text-[12px]">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
          <tr><th className="px-2 py-1 text-left">ID</th><th className="px-2 py-1 text-left">Covenant</th><th className="px-2 py-1 text-left">Clear by</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1"></th></tr>
        </thead>
        <tbody>
          {app.covenants.map((c) => (
            <tr key={c.id} className="border-t border-slate-50">
              <td className="px-2 py-1.5 font-mono font-semibold text-slate-600">{c.defId}</td>
              <td className="px-2 py-1.5 text-slate-700">{c.title}</td>
              <td className="px-2 py-1.5 text-slate-500">{c.clearBy}</td>
              <td className="px-2 py-1.5"><Chip tone={c.status === 'open' ? 'amber' : c.status === 'cleared' ? 'green' : 'red'}>{c.status}</Chip></td>
              <td className="px-2 py-1.5 text-right">
                {canClear && c.status === 'open' && <Btn size="sm" tone="ghost" onClick={() => clearCovenant(app.appId, c.id)}>Clear</Btn>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Tranches --------------------------------------------------------------
export function TranchesTab({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const releaseTranche = useStore((s) => s.releaseTranche)
  const countersignTranche = useStore((s) => s.countersignTranche)
  if (app.tranches.length === 0) return <EmptyState>No tranches scheduled (reaches S13 disbursement).</EmptyState>
  return (
    <div className="space-y-2">
      {app.tranches.map((t) => {
        const gatesOk = t.gates.every((g) => g.passed)
        return (
          <div key={t.id} className="rounded-xl border border-[var(--line)] bg-white shadow-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700">Tranche {t.n}</span>
                <span className="ml-2 text-[11px] text-slate-500">{t.type} · {t.semester}</span>
              </div>
              <Chip tone={t.status === 'remitted' ? 'green' : t.status === 'released' ? 'blue' : t.status === 'gated' ? 'red' : 'amber'}>{t.status}</Chip>
            </div>
            <div className="mt-1 text-[12px] text-slate-600">{usd(t.amountUsd)} · {inr(t.amountInr)} @ ₹{t.fxUsed.toFixed(2)}/USD · A2/FEMA: {t.a2FemaOnFile ? 'on file' : 'missing'}</div>
            <div className="mt-2">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Gates</div>
              <div className="flex flex-wrap gap-1">
                {t.gates.map((g) => (
                  <Chip key={g.ref} tone={g.passed ? 'green' : 'red'}>{g.passed ? '✓' : '✗'} {g.label}</Chip>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {t.status !== 'remitted' && !t.pendingChecker && roleCan(role, 'release_tranche') && (
                <Btn size="sm" tone={gatesOk ? 'primary' : 'default'} disabled={!gatesOk} onClick={() => releaseTranche(app.appId, t.id)}>
                  Release tranche (maker)
                </Btn>
              )}
              {t.pendingChecker && (
                <Btn size="sm" tone="primary" onClick={() => countersignTranche(app.appId, t.id)}>Countersign release (Credit)</Btn>
              )}
              {t.pendingChecker && <span className="text-[11px] text-indigo-600">⏳ maker {t.maker} — awaiting Credit checker</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Comms -----------------------------------------------------------------
export function CommsTab({ app }: { app: Application }) {
  return <CommThread app={app} />
}

// ---- Integrations ----------------------------------------------------------
export function IntegrationsTab({ app }: { app: Application }) {
  const retry = useStore((s) => s.retryIntegration)
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card">
      <table className="w-full text-[12px]">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
          <tr><th className="px-2 py-1 text-left">System</th><th className="px-2 py-1 text-left">Purpose</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Latency</th><th className="px-2 py-1 text-left">Last attempt</th><th className="px-2 py-1"></th></tr>
        </thead>
        <tbody>
          {app.integrations.map((c) => (
            <tr key={c.id} className="border-t border-slate-50">
              <td className="px-2 py-1.5 font-medium text-slate-700">{c.system}</td>
              <td className="px-2 py-1.5 text-slate-500">{c.purpose}</td>
              <td className="px-2 py-1.5"><Chip tone={c.status === 'success' ? 'green' : c.status === 'failed' ? 'red' : 'amber'}>{c.status}</Chip></td>
              <td className="px-2 py-1.5 text-slate-500">{c.status === 'pending' ? '—' : `${c.latencyMs} ms`}</td>
              <td className="px-2 py-1.5 text-slate-500">{fmtDateTime(c.lastAttempt)}</td>
              <td className="px-2 py-1.5 text-right">
                {(c.status === 'failed' || c.status === 'pending') && <Btn size="sm" tone="ghost" onClick={() => retry(app.appId, c.id)}><RefreshCw size={12} /> Retry</Btn>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Audit -----------------------------------------------------------------
export function AuditTab({ app }: { app: Application }) {
  return (
    <div className="space-y-1">
      {app.audit.map((e) => (
        <div key={e.id} className="flex items-start gap-2 rounded border border-slate-100 bg-white px-2 py-1.5 text-[12px]">
          <ShieldCheck size={13} className="mt-0.5 text-slate-300" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">{e.verb}</span>
              <span className="text-[10px] text-slate-400">{fmtDateTime(e.ts)}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {e.actor} · {e.role}
              {e.fromStage && ` · ${e.fromStage}→${e.toStage}`}
              {e.reasonCode && ` · ${e.reasonCode}`}
            </div>
            {e.remarks && <div className="text-[11px] text-slate-600">{e.remarks}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Notes -----------------------------------------------------------------
export function NotesTab({ app }: { app: Application }) {
  const [body, setBody] = useState('')
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note… use @Officer to mention" className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-13" />
        <Btn size="sm" tone="primary" disabled={!body.trim()} onClick={() => { addNote(app.appId, body); setBody('') }}>Post</Btn>
      </div>
      {app.notes.length === 0 ? <EmptyState>No notes yet.</EmptyState> : (
        <div className="space-y-1.5">
          {app.notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-[var(--line)] bg-white shadow-card p-2 text-[12px]">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-600">{n.author} · {n.role}</span>
                <span>{fmtDateTime(n.ts)}</span>
              </div>
              <div className="mt-1 text-slate-700">
                {renderMentions(n.body)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- University intelligence (§E) ------------------------------------------
//
// Bank-facing, and only bank-facing. There is no customer counterpart to this
// panel: a brief weighs funding cuts, leadership churn and adverse coverage
// about the institution the customer is about to attend, which is credit work.
// `/__dev/agents` asserts that the brief reaches no customer route.
//
// The 24-hour cycle is real. Opening this tab against a brief older than 24h on
// the PROTOTYPE clock re-runs the crawl and re-stamps it — so advancing the demo
// clock (+48h from Automation) and coming back here fires a visible re-crawl:
// the revision counter increments, the previous stamp is printed next to the new
// one, and a fresh `UNIVERSITY BRIEF REFRESHED` line lands in the Audit tab
// stamped at the advanced time.
export function UniversityTab({ app }: { app: Application }) {
  const record = useStore((s) => s.recordUniversityBrief)
  // Subscribing to the operator clock offset is what makes staleness re-derive.
  // The prototype clock never ages on its own, so without this the panel would
  // never notice it had gone stale.
  const offset = useStore((s) => s.clockOffsetHours)

  const brief = app.universityBrief
  const stale = useMemo(() => briefStaleness(brief), [brief, offset])

  useEffect(() => {
    if (!stale.stale) return
    // Computed synchronously and completely, up front — the same rule the
    // document swarm follows. Nothing here is waiting on a timer.
    const fresh = briefFromRun(runUniversitySwarm(app))
    if (fresh) {
      record(app.appId, fresh, { kind: 'system', sessionId: 'SYS' }, 'file opened')
    }
    // The store verb is idempotent on `fetchedAt`, and a successful write makes
    // `stale.stale` false, so this converges in one pass and cannot loop.
  }, [app, stale.stale, record, offset])

  if (!brief) {
    return <EmptyState>Running the university crawl…</EmptyState>
  }

  return (
    <div className="space-y-3">
      {/* Provenance band — the crawl's own vital signs. */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            University brief
          </span>
          <span className="text-13 font-semibold text-slate-800">{brief.university}</span>
          <span className="text-11 text-slate-500">read against {brief.programme}</span>
          {/* When the dossier is filed under another name — 'Ross' for a
              Michigan MBA — say so here rather than leaving the officer to
              wonder why the heading and the file disagree. */}
          {brief.matchedBy === 'token' && brief.dossier && (
            <span
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
              title="Matched on name, not on an exact corpus key"
            >
              dossier: {brief.dossier}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <Chip
              tone={brief.coverage === 'adequate' ? 'green' : 'amber'}
              title={
                brief.coverage === 'adequate'
                  ? 'Researched, with findings on file'
                  : brief.coverage === 'thin'
                    ? 'Researched and genuinely quiet'
                    : 'Not in the corpus — nobody has looked'
              }
            >
              corpus: {brief.coverage}
            </Chip>
            <Chip tone="slate">revision {brief.revision}</Chip>
            {stale.stale ? (
              <Chip tone="amber" title={`Older than ${BRIEF_TTL_HOURS}h — a re-crawl is due`}>
                stale
              </Chip>
            ) : (
              <Chip tone="green" title={`Goes stale in ${Math.round(stale.dueInHours)}h`}>
                current
              </Chip>
            )}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>
            fetched <b className="font-medium text-slate-700">{fmtDateTime(brief.fetchedAt)}</b>
            {' · '}
            {stale.ageHours < 1
              ? 'just now'
              : `${Math.round(stale.ageHours)}h ago`}{' '}
            on the prototype clock
          </span>
          {/* The proof that a re-crawl happened, rather than a claim that it did. */}
          {brief.previousFetchedAt && (
            <span className="rounded bg-slate-50 px-1.5 py-0.5">
              re-crawled — previous stamp {fmtDateTime(brief.previousFetchedAt)}
            </span>
          )}
          {offset > 0 && <span className="font-medium text-brand-600">clock +{offset}h</span>}
          <span className="ml-auto">
            refreshes every {BRIEF_TTL_HOURS}h · {brief.sources.length} source(s)
          </span>
        </div>
      </div>

      {/* "Absent" is the dangerous state: an empty panel looks like a clean
          result, and it is not one. Say so on the surface, not in a comment. */}
      {brief.coverage === 'absent' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">No dossier for this university — absent, not clean</div>
            <div className="mt-0.5 text-amber-800">
              The research corpus covers the 14 universities the pre-qualification screen can
              select. <b>{brief.university}</b> is not among them, so nobody has looked. Do not
              read this panel as a clear result.
            </div>
          </div>
        </div>
      )}

      {/* Synthesis */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
        <div className="text-13 font-semibold text-slate-800">{brief.headline}</div>
        <div className="mt-1.5 space-y-1.5">
          {brief.synthesis.map((line, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Sources — publisher, date and a clickable link on every one. A finding
          a reviewer cannot click through to is an assertion, not a source. */}
      {brief.sources.length === 0 ? (
        <EmptyState>
          {brief.coverage === 'thin'
            ? brief.coverageNote ?? 'The corpus covers this university and had nothing recent worth reporting.'
            : brief.coverage === 'absent'
              ? 'No dossier for this university.'
              : `Nothing on file for ${brief.university} touches ${brief.programme}.`}
        </EmptyState>
      ) : (
        <div className="space-y-1.5">
          {brief.sources.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-[var(--line)] bg-white p-2.5 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={s.category === 'adverse' ? 'red' : s.category === 'policy' ? 'amber' : 'slate'}>
                  {s.categoryLabel}
                </Chip>
                {s.level === 'attention' && <Chip tone="amber">attention</Chip>}
                <span className="text-[12px] font-medium text-slate-800">{s.headline}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{s.detail}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="font-medium text-slate-600">{s.publisher}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{fmtDate(s.publishedIso)}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-center gap-1 truncate font-medium text-brand-600 underline decoration-brand-200 hover:text-brand-700"
                  title={s.url}
                >
                  <ExternalLink size={11} className="flex-shrink-0" /> {s.url}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        The fetch is <b>modelled, not live</b>. This build makes zero network calls by design and
        the standalone HTML has to work offline, so a crawl here means selecting from a researched
        corpus and stamping the prototype clock. The endpoint a real crawl needs is written down in{' '}
        <code>docs/API-CONTRACT.md §8</code>. Re-running in the same clock state is deliberately a
        no-op — the brief is a pure function of the file, so the same inputs give the same stamp.
      </p>
    </div>
  )
}

function renderMentions(body: string) {
  const parts = body.split(/(@[\w.\s]+?(?=[,.]|$|@))/g)
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} className="rounded bg-brand-50 px-1 font-medium text-brand-700">{p.trim()}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}
