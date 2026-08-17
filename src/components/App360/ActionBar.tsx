// ============================================================================
// Action bar (§12.3.2) — role-filtered verbs, each opening a reason/remarks modal.
// ============================================================================
import { useState } from 'react'
import {
  ArrowRight, Undo2, UserCog, Pause, Play, FilePlus, CheckCircle2, XCircle,
  AlertTriangle, Gavel, RotateCw, Send, Phone, UserPlus,
} from 'lucide-react'
import { useStore } from '@/store/appStore'
import { roleCan, canMoveForward, gateOverridable, ROLES } from '@/lib/stateMachine'
import { evaluateGate } from '@/lib/gating'
import { effectiveBand, decisionRole, bandApprover } from '@/lib/doa'
import { REJ_CODES, SB_CODES, HLD_CODES, DEV_DEFS } from '@/data/reasonCodes'
import { COV_DEFS } from '@/data/covenants'
import type { Application, Department, Stage } from '@/types'
import { Btn, Modal, Field, Select, TextArea } from '@/components/common/ui'

export function ActionBar({ app }: { app: Application }) {
  const role = useStore((s) => s.role)
  const openComposer = useStore((s) => s.openComposer)
  const [modal, setModal] = useState<string | null>(null)
  const terminal = ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'DISBURSED_ACTIVE'].includes(app.stage)

  const gate = evaluateGate(app)
  const canFwd = roleCan(role, 'move_forward') && canMoveForward(role, app.stage) && !terminal
  const onHold = app.status === 'on_hold'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-white/70 px-5 py-2.5 backdrop-blur">
      {canFwd && (
        <Btn tone="primary" size="sm" onClick={() => setModal('forward')} title={gate && !gate.passed ? 'Gate items failing' : 'Move to next stage'}>
          <ArrowRight size={14} /> Move forward
        </Btn>
      )}
      {roleCan(role, 'send_back') && !terminal && (
        <Btn size="sm" onClick={() => setModal('sendback')}><Undo2 size={14} /> Send back</Btn>
      )}
      {roleCan(role, 'reassign') && (
        <Btn size="sm" onClick={() => setModal('reassign')}><UserCog size={14} /> Reassign</Btn>
      )}
      {roleCan(role, 'hold') && !terminal && (
        onHold
          ? <Btn size="sm" onClick={() => setModal('release')}><Play size={14} /> Release hold</Btn>
          : <Btn size="sm" onClick={() => setModal('hold')}><Pause size={14} /> Hold</Btn>
      )}
      {roleCan(role, 'request_docs') && !terminal && (
        <Btn size="sm" onClick={() => setModal('reqdocs')}><FilePlus size={14} /> Request docs</Btn>
      )}
      {/* §v2 CRM — reachable at every stage */}
      {(roleCan(role, 'nudge') || roleCan(role, 'request_docs')) && (
        <>
          <Btn size="sm" onClick={() => openComposer(app.appId, 'message')}>
            <Send size={14} /> Contact
          </Btn>
          <Btn size="sm" onClick={() => openComposer(app.appId, 'call')}>
            <Phone size={14} /> Log call
          </Btn>
        </>
      )}
      {roleCan(role, 'stage_approve') && !terminal && (
        <Btn size="sm" onClick={() => setModal('stageapprove')}><CheckCircle2 size={14} /> Stage approve</Btn>
      )}
      {roleCan(role, 'raise_deviation') && !terminal && (
        <Btn size="sm" onClick={() => setModal('deviation')}><AlertTriangle size={14} /> Raise deviation</Btn>
      )}
      {roleCan(role, 'edit_capture') && !terminal && (
        <Btn size="sm" onClick={() => setModal('coapplicant')}><UserPlus size={14} /> Add co-applicant</Btn>
      )}
      {app.stage === 'S10' && !app.pendingChecker && (roleCan(role, 'final_decision')) && (
        <Btn tone="primary" size="sm" onClick={() => setModal('decision')}><Gavel size={14} /> Final decision</Btn>
      )}
      {app.pendingChecker && roleCan(role, 'countersign') && (
        <Btn tone="primary" size="sm" onClick={() => setModal('countersign')}><CheckCircle2 size={14} /> Countersign</Btn>
      )}
      {app.stage === 'S11' && app.sanctionExpiryDate && roleCan(role, 'revalidate') && (
        <Btn size="sm" onClick={() => setModal('revalidate')}><RotateCw size={14} /> Revalidate</Btn>
      )}

      {/* Gate hint */}
      {gate && !gate.passed && canFwd && (
        <span className="ml-auto text-[11px] text-red-500">
          {gate.nonOverridable ? '⛔ Non-overridable gate' : '⚠ Gate items failing'} — {gate.failures.length}
        </span>
      )}

      {modal === 'forward' && <ForwardModal app={app} onClose={() => setModal(null)} />}
      {modal === 'sendback' && <SendBackModal app={app} onClose={() => setModal(null)} />}
      {modal === 'reassign' && <ReassignModal app={app} onClose={() => setModal(null)} />}
      {modal === 'hold' && <HoldModal app={app} onClose={() => setModal(null)} />}
      {modal === 'release' && <ReleaseModal app={app} onClose={() => setModal(null)} />}
      {modal === 'reqdocs' && <ReqDocsModal app={app} onClose={() => setModal(null)} />}
      {modal === 'stageapprove' && <StageApproveModal app={app} onClose={() => setModal(null)} />}
      {modal === 'deviation' && <DeviationModal app={app} onClose={() => setModal(null)} />}
      {modal === 'coapplicant' && <CoApplicantModal app={app} onClose={() => setModal(null)} />}
      {modal === 'decision' && <DecisionModal app={app} onClose={() => setModal(null)} />}
      {modal === 'countersign' && <CountersignModal app={app} onClose={() => setModal(null)} />}
      {modal === 'revalidate' && <RevalidateModal app={app} onClose={() => setModal(null)} />}
    </div>
  )
}

function ForwardModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const moveForward = useStore((s) => s.moveForward)
  const raiseDeviation = useStore((s) => s.raiseDeviation)
  const gate = evaluateGate(app)
  const overridable = gateOverridable(app.stage)
  return (
    <Modal title={`Move forward — ${app.stage}`} onClose={onClose} wide>
      {gate && !gate.passed ? (
        <div>
          <p className="mb-2 text-13 text-slate-600">This forward move is blocked by the gate table (§4):</p>
          <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-500">{gate.description}</div>
          <ul className="space-y-2">
            {gate.failures.map((f) => (
              <li key={f.id} className="rounded border border-red-200 bg-red-50 p-2">
                <div className="text-[12px] font-semibold text-red-700">{f.id} · {f.title}</div>
                <div className="mt-0.5 text-[12px] text-red-600">{f.message}</div>
              </li>
            ))}
          </ul>
          {gate.nonOverridable ? (
            <p className="mt-3 rounded bg-slate-100 p-2 text-[12px] text-slate-600">
              ⛔ S03 KYC / S08 AML gates cannot be skipped or overridden by any role (§6d).
            </p>
          ) : overridable ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Overriding a gate = raising a Deviation (§4). Use “Raise deviation” to convert an open item, then retry.
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Btn size="sm" onClick={onClose}>Close</Btn>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-13 text-slate-600">All gate items resolved. Move {app.appId} to the next stage?</p>
          <div className="mt-4 flex justify-end gap-2">
            <Btn size="sm" onClick={onClose}>Cancel</Btn>
            <Btn tone="primary" size="sm" onClick={() => { moveForward(app.appId); onClose() }}>Confirm move forward</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

function SendBackModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const sendBack = useStore((s) => s.sendBack)
  const [code, setCode] = useState(SB_CODES[0].id)
  const [remarks, setRemarks] = useState('')
  const target = (SB_CODES.find((c) => c.id === code)?.target ?? 'S04') as Stage
  return (
    <Modal title="Send back" onClose={onClose}>
      <Field label="Reason code (SB-xx) — mandatory">
        <Select value={code} onChange={(e) => setCode(e.target.value)}>
          {SB_CODES.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.label}{c.target ? ` → ${c.target}` : ''}</option>)}
        </Select>
      </Field>
      <Field label="Remarks — mandatory"><TextArea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" disabled={!remarks.trim()} onClick={() => { sendBack(app.appId, code, target, remarks); onClose() }}>Send back</Btn>
      </div>
    </Modal>
  )
}

function ReassignModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const reassign = useStore((s) => s.reassign)
  const [dept, setDept] = useState<Department>(app.owner.department)
  const officer = ROLES.find((r) => r.department === dept)?.officer ?? 'R. Iyer'
  return (
    <Modal title="Reassign" onClose={onClose}>
      <Field label="Department">
        <Select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
          {(['Sales', 'Ops', 'Credit', 'Risk', 'Compliance', 'Admin'] as Department[]).map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </Field>
      <p className="mb-3 text-[12px] text-slate-500">Officer: {officer}</p>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { reassign(app.appId, dept, officer); onClose() }}>Reassign</Btn>
      </div>
    </Modal>
  )
}

function HoldModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const hold = useStore((s) => s.hold)
  const [code, setCode] = useState(HLD_CODES[0].id)
  const [remarks, setRemarks] = useState('')
  return (
    <Modal title="Hold / park" onClose={onClose}>
      <Field label="Hold code (HLD-xx)">
        <Select value={code} onChange={(e) => setCode(e.target.value)}>
          {HLD_CODES.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.label}</option>)}
        </Select>
      </Field>
      <Field label="Remarks"><TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      <p className="mb-3 text-[12px] text-slate-500">30-day auto-expiry; nudges at T+7 / T+14 / T+21.</p>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { hold(app.appId, code, remarks); onClose() }}>Place hold</Btn>
      </div>
    </Modal>
  )
}
function ReleaseModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const releaseHold = useStore((s) => s.releaseHold)
  const [remarks, setRemarks] = useState('')
  return (
    <Modal title="Release hold" onClose={onClose}>
      <Field label="Remarks"><TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { releaseHold(app.appId, remarks); onClose() }}>Release</Btn>
      </div>
    </Modal>
  )
}

function ReqDocsModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const requestDocs = useStore((s) => s.requestDocs)
  const [bucket, setBucket] = useState(app.buckets[0]?.id ?? 'E1')
  const [label, setLabel] = useState('')
  return (
    <Modal title="Request additional documents" onClose={onClose}>
      <Field label="Bucket">
        <Select value={bucket} onChange={(e) => setBucket(e.target.value)}>
          {app.buckets.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.title}</option>)}
        </Select>
      </Field>
      <Field label="Document label">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-13" placeholder="e.g. Updated I-20 (unconditional)" />
      </Field>
      <p className="mb-3 text-[12px] text-slate-500">Flips blocker → customer and fires a doc-request comm.</p>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" disabled={!label.trim()} onClick={() => { requestDocs(app.appId, bucket, label); onClose() }}>Request</Btn>
      </div>
    </Modal>
  )
}

function StageApproveModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const moveForward = useStore((s) => s.moveForward)
  return (
    <Modal title="Stage approve" onClose={onClose}>
      <p className="text-13 text-slate-600">Stage approve completes the current stage QC and advances routing. This is distinct from the final sanction decision (S10).</p>
      <div className="mt-4 flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { moveForward(app.appId); onClose() }}>Approve stage</Btn>
      </div>
    </Modal>
  )
}

function DeviationModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const raiseDeviation = useStore((s) => s.raiseDeviation)
  const [defId, setDefId] = useState(DEV_DEFS[0].id)
  const [rationale, setRationale] = useState('')
  return (
    <Modal title="Raise deviation" onClose={onClose}>
      <Field label="Deviation (DEV-xx)">
        <Select value={defId} onChange={(e) => setDefId(e.target.value)}>
          {DEV_DEFS.map((d) => <option key={d.id} value={d.id}>{d.id} — {d.title}</option>)}
        </Select>
      </Field>
      <Field label="Rationale"><TextArea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} /></Field>
      <p className="mb-3 text-[12px] text-slate-500">Approval level = base DoA + 1.</p>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" disabled={!rationale.trim()} onClick={() => { raiseDeviation(app.appId, defId, rationale); onClose() }}>Raise</Btn>
      </div>
    </Modal>
  )
}

/** §v2 req 3 — adding a co-applicant EXTENDS the checklist (P1#2 …) and raises
 *  DEV-10; it never regenerates and so never discards verified documents. */
function CoApplicantModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const addCoApplicant = useStore((s) => s.addCoApplicant)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('Father')
  const [incomeBranch, setIncomeBranch] = useState<'salaried' | 'self_employed'>('salaried')
  const [rationale, setRationale] = useState('')
  const existing = app.parties.filter((p) => p.role === 'co_applicant').length

  return (
    <Modal title="Add co-applicant" onClose={onClose} wide>
      <div className="mb-3 rounded-lg border border-[var(--line)] bg-slate-50 p-2 text-[12px] text-slate-600">
        This file already has <b>{existing}</b> co-applicant{existing === 1 ? '' : 's'}. A new party adds its own
        P1–P6 document set (suffixed <span className="font-mono">#{existing + 1}</span>) at <b>requested</b> —
        existing verified documents are untouched. Recorded as deviation <b>DEV-10</b>.
      </div>
      <Field label="Full name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunita Reddy"
          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-13" />
      </Field>
      <Field label="Relationship to student">
        <Select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
          {['Father', 'Mother', 'Guardian', 'Sibling', 'Spouse'].map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Income branch">
        <Select value={incomeBranch} onChange={(e) => setIncomeBranch(e.target.value as 'salaried' | 'self_employed')}>
          <option value="salaried">Salaried (P2 set)</option>
          <option value="self_employed">Self-employed (P3 set)</option>
        </Select>
      </Field>
      <Field label="Rationale">
        <TextArea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)}
          placeholder="Why is an additional co-applicant needed? (e.g. FOIR support)" />
      </Field>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn size="sm" tone="primary" disabled={!name.trim()}
          onClick={() => { addCoApplicant(app.appId, { name, relationship, incomeBranch, rationale }); onClose() }}>
          Add co-applicant
        </Btn>
      </div>
    </Modal>
  )
}

function DecisionModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const finalDecision = useStore((s) => s.finalDecision)
  const [decision, setDecision] = useState<NonNullable<Application['decision']>>('APPROVE')
  const [code, setCode] = useState(REJ_CODES[0].id)
  const [sbCode, setSbCode] = useState(SB_CODES[0].id)
  const [covs, setCovs] = useState<string[]>([])
  const band = effectiveBand(app)
  const reqRole = decisionRole(band)
  return (
    <Modal title={`Final decision (S10) — ${band}`} onClose={onClose} wide>
      <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600">
        DoA band: <b>{band}</b> → approver: {bandApprover(band)} · records as {ROLES.find((r) => r.id === reqRole)?.label}.
        {band === 'Committee' && ' Committee path: Central Risk decides + Admin countersigns.'}
      </div>
      <Field label="Decision">
        <Select value={decision} onChange={(e) => setDecision(e.target.value as any)}>
          <option value="APPROVE">APPROVE</option>
          <option value="APPROVE_WITH_CONDITIONS">APPROVE-WITH-CONDITIONS</option>
          <option value="DECLINE">DECLINE</option>
          <option value="REFER_BACK">REFER_BACK</option>
        </Select>
      </Field>
      {decision === 'APPROVE_WITH_CONDITIONS' && (
        <Field label="Attach covenants (≥1 required)">
          <div className="max-h-32 space-y-1 overflow-auto rounded border border-slate-200 p-2">
            {COV_DEFS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={covs.includes(c.id)} onChange={() => setCovs((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} />
                {c.id} — {c.title}
              </label>
            ))}
          </div>
        </Field>
      )}
      {decision === 'DECLINE' && (
        <Field label="Rejection code (REJ-xx)">
          <Select value={code} onChange={(e) => setCode(e.target.value)}>
            {REJ_CODES.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.label}</option>)}
          </Select>
        </Field>
      )}
      {decision === 'REFER_BACK' && (
        <Field label="Send-back code + target (SB-xx)">
          <Select value={sbCode} onChange={(e) => setSbCode(e.target.value)}>
            {SB_CODES.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.label}{c.target ? ` → ${c.target}` : ''}</option>)}
          </Select>
        </Field>
      )}
      <p className="mb-3 text-[12px] text-slate-500">Records a maker decision; a different, same-or-higher checker must countersign.</p>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => {
          finalDecision(app.appId, decision, {
            code: decision === 'DECLINE' ? code : decision === 'REFER_BACK' ? sbCode : undefined,
            target: decision === 'REFER_BACK' ? (SB_CODES.find((c) => c.id === sbCode)?.target as Stage) : undefined,
            covenantIds: decision === 'APPROVE_WITH_CONDITIONS' ? covs : undefined,
          })
          onClose()
        }}>Record decision</Btn>
      </div>
    </Modal>
  )
}

function CountersignModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const countersign = useStore((s) => s.countersign)
  const pc = app.pendingChecker
  return (
    <Modal title="Countersign (checker)" onClose={onClose}>
      <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600">
        Maker: <b>{pc?.maker}</b> · {pc?.summary}. Checker must differ from maker and be same-or-higher authority.
      </div>
      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { countersign(app.appId); onClose() }}>Countersign</Btn>
      </div>
    </Modal>
  )
}

function RevalidateModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const revalidate = useStore((s) => s.revalidate)
  return (
    <Modal title="Revalidate sanction" onClose={onClose}>
      <p className="text-13 text-slate-600">Send {app.appId} back to S10 for revalidation (sanction lapsed / expiring).</p>
      <div className="mt-4 flex justify-end gap-2">
        <Btn size="sm" onClick={onClose}>Cancel</Btn>
        <Btn tone="primary" size="sm" onClick={() => { revalidate(app.appId); onClose() }}>Revalidate</Btn>
      </div>
    </Modal>
  )
}
