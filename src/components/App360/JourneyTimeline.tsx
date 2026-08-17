// ============================================================================
// Journey timeline (§12.3.3) — 13 stages with parallel lanes S03–S09
// (Applicant / Co-applicant / Collateral) converging into the S07→S10 spine.
// ============================================================================
import { STAGES } from '@/data/stages'
import type { Application, LaneNodeStatus, StageId } from '@/types'

const STAGE_ORDER = STAGES.map((s) => s.id)

function stageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as StageId)
}

export function JourneyTimeline({ app }: { app: Application }) {
  const curIdx = stageIndex(typeof app.stage === 'string' ? app.stage : 'S01')
  const isTerminal = curIdx < 0

  const nodeColor = (idx: number) => {
    if (isTerminal) return idx <= 9 ? 'done' : 'idle'
    if (idx < curIdx) return 'done'
    if (idx === curIdx) return app.status === 'sent_back' ? 'sentback' : app.status === 'on_hold' ? 'hold' : 'current'
    return 'idle'
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-card">
      <h3 className="mb-3 text-13 font-semibold text-slate-700">Journey timeline</h3>

      {/* Spine S01–S02 */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.slice(0, 2).map((s, i) => (
          <SpineNode key={s.id} id={s.id} name={s.name} state={nodeColor(i)} />
        ))}
        <Arrow />
        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">S03–S09 · parallel lanes ↓</span>
      </div>

      {/* Parallel lanes S03–S09 */}
      <div className="mb-3 space-y-2 border-l-2 border-slate-200 pl-3">
        <Lane label="Lane A · Applicant" nodes={app.lanes.applicant} />
        <Lane label="Lane B · Co-applicant" nodes={app.lanes.coApplicant} />
        {app.lanes.collateral ? (
          <Lane label="Lane C · Collateral" nodes={app.lanes.collateral} />
        ) : (
          <div className="text-[11px] text-slate-400">Lane C · Collateral — not applicable (unsecured construct)</div>
        )}
      </div>

      {/* Converge → spine S07–S13 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">converge →</span>
        {STAGES.slice(6).map((s) => {
          const i = stageIndex(s.id)
          return (
            <div key={s.id} className="flex items-center gap-1">
              <SpineNode id={s.id} name={s.name} state={nodeColor(i)} />
              {s.id !== 'S13' && <Arrow />}
            </div>
          )
        })}
      </div>

      {isTerminal && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          Terminal state: <b>{app.stage}</b>
          {app.status === 'sent_back' && ' · with send-back loop'}
        </div>
      )}
    </div>
  )
}

function SpineNode({ id, name, state }: { id: string; name: string; state: string }) {
  const cls: Record<string, string> = {
    done: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    current: 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-200',
    sentback: 'border-orange-300 bg-orange-50 text-orange-700 ring-2 ring-orange-200',
    hold: 'border-purple-300 bg-purple-50 text-purple-700 ring-2 ring-purple-200',
    idle: 'border-slate-200 bg-white text-slate-400',
  }
  return (
    <div className={`flex-shrink-0 rounded border px-2 py-1 ${cls[state]}`} title={name}>
      <div className="text-[10px] font-mono font-semibold">{id}</div>
      <div className="text-[10px] leading-tight max-w-[72px] truncate">{name}</div>
    </div>
  )
}

function Arrow() {
  return <span className="text-slate-300">→</span>
}

function Lane({ label, nodes }: { label: string; nodes: LaneNodeStatus[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-40 flex-shrink-0 text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        {nodes.map((n, i) => (
          <div key={n.node} className="flex items-center gap-1">
            <LaneNode n={n} />
            {i < nodes.length - 1 && <Arrow />}
          </div>
        ))}
      </div>
    </div>
  )
}

function LaneNode({ n }: { n: LaneNodeStatus }) {
  const cls: Record<string, string> = {
    completed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    in_progress: 'border-brand-400 bg-brand-50 text-brand-700',
    failed: 'border-red-300 bg-red-50 text-red-700',
    not_started: 'border-slate-200 bg-white text-slate-400',
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${cls[n.status]}`} title={n.detail}>
      {n.label}{n.status === 'failed' ? ' ✗' : ''}
    </span>
  )
}
