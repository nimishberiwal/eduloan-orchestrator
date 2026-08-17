// ============================================================================
// AgentSwarm (§v5) — the parallel-agents view.
//
// One lane per agent, each with its own progress and its own streaming status
// line, finishing at different moments. The stagger is what makes this read as
// several things happening at once rather than one task with three labels.
//
// Customer-facing by default: it shows only findings whose audience is
// 'customer', and closes on a neutral summary. Pass `audience="bank"` on the
// console to see everything.
// ============================================================================
import { useEffect } from 'react'
import type { AgentResults, AgentRunPlan, LaneState } from '@/lib/agents/types'
import { AGENT_BY_ID } from '@/lib/agents/registry'
import { customerSummary, findingsFor } from '@/lib/agents/runtime'
import { useAgentStore } from '@/store/agentStore'
import { GButton, GCard, GChip, ScreenTitle } from '@/journeys/common/glib'

export function AgentSwarm({
  plan,
  results,
  title,
  intro,
  audience = 'customer',
  onComplete,
  onContinue,
  continueLabel = 'Continue',
}: {
  plan: AgentRunPlan
  results: AgentResults
  title: string
  intro?: string
  audience?: 'customer' | 'bank'
  /** Fired once, when every lane has finished. Application changes go here. */
  onComplete?: (results: AgentResults) => void
  onContinue?: () => void
  continueLabel?: string
}) {
  const run = useAgentStore((s) => s.run)
  const startRun = useAgentStore((s) => s.startRun)
  const cancelRun = useAgentStore((s) => s.cancelRun)

  // Start once per plan. `plan.id` is derived from the swarm kind, the
  // application and the seed, so a re-render never restarts the theatre but a
  // genuinely new run always does.
  useEffect(() => {
    startRun(plan, results, onComplete)
    return () => cancelRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id])

  const live = run?.runId === plan.id ? run : null
  const complete = live?.status === 'complete'
  const visible = audience === 'customer' ? findingsFor(results, 'customer') : Object.values(results)
    .filter((r) => Boolean(r))
    .flatMap((r) => r!.findings)

  return (
    <>
      <ScreenTitle title={title} intro={intro} />

      <ul className="mb-5 space-y-3" aria-live="polite" aria-busy={!complete}>
        {(live?.lanes ?? plan.tasks.map((t) => ({ agent: t.agent, status: 'queued', progress: 0, stepIndex: 0 } as LaneState))).map(
          (lane) => {
            const def = AGENT_BY_ID[lane.agent]
            const task = plan.tasks.find((t) => t.agent === lane.agent)
            const step = task?.steps[lane.stepIndex] ?? ''
            const done = lane.status === 'done'
            return (
              <li key={lane.agent}>
                <GCard tone={done ? 'ok' : 'plain'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="display text-[15px] font-semibold leading-[21px] text-[var(--glib-grey)]">
                        {def?.name ?? lane.agent}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--grey-600)]">
                        {done ? (lane.result?.headline ?? 'Done') : step}
                      </p>
                    </div>
                    {done ? (
                      <GChip tone="ok">Done</GChip>
                    ) : (
                      <span
                        aria-hidden
                        className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--blue-grey)] border-t-[var(--glib-blue)]"
                      />
                    )}
                  </div>

                  {/* Per-lane progress. Separate bars are the point — one shared
                      bar would erase the parallelism. */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--blue-grey)]">
                    <div
                      className="h-full rounded-full bg-[var(--glib-blue)] transition-[width] duration-100 ease-linear"
                      style={{ width: `${Math.round(lane.progress * 100)}%` }}
                    />
                  </div>
                </GCard>
              </li>
            )
          },
        )}
      </ul>

      {complete ? (
        <>
          <GCard tone="support" className="mb-4">
            <p className="text-[15px] leading-[22px]">
              {audience === 'customer' ? customerSummary(results) : 'Run complete.'}
            </p>
          </GCard>

          {visible.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {visible.map((f) => (
                <li key={f.id}>
                  <GCard tone={f.level === 'block' ? 'stop' : f.level === 'attention' ? 'warn' : 'info'}>
                    <p className="text-[14px] font-semibold leading-[21px]">{f.title}</p>
                    <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
                      {f.detail}
                    </p>
                    {audience === 'bank' ? (
                      <p className="mt-1 text-[12px] text-[var(--grey-600)]">
                        {AGENT_BY_ID[f.agent]?.name} · {f.level}
                      </p>
                    ) : null}
                  </GCard>
                </li>
              ))}
            </ul>
          ) : null}

          {onContinue ? (
            <GButton block onClick={onContinue}>
              {continueLabel}
            </GButton>
          ) : null}
        </>
      ) : null}
    </>
  )
}
