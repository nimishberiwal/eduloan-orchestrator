// ============================================================================
// Agent run state (§v5) — the ONLY timer-driven state in this codebase.
//
// Everything else here is synchronous by design: one click, one `set()`. This
// store is the exception, and it is deliberately fenced in so it stays one:
//
//   · It holds NO domain data. Lanes, progress, step index. Nothing else.
//   · Results are computed by the CALLER, synchronously and purely, and handed
//     over complete. This store only decides WHEN to reveal each one. It cannot
//     invent a finding, and it cannot make one arrive differently twice.
//   · Nothing here ever reaches an Application. Application changes go through
//     appStore verbs in `onComplete`, exactly as `emitJourneyEvent` does.
//
// So a torn-down run, a double-start, or a component unmounting mid-flight can
// lose an animation. It cannot lose or corrupt a fact.
// ============================================================================
import { create } from 'zustand'
import type {
  AgentResults,
  AgentRunPlan,
  AgentRunState,
  LaneState,
} from '@/lib/agents/types'
import { runDuration } from '@/lib/agents/runtime'
import { registerJourneyReset } from '@/journeys/resetRegistry'

// Driven by requestAnimationFrame, not setInterval.
//
// Two reasons, both learned by measuring rather than by preference:
//
//  1. A hidden or backgrounded tab throttles setInterval to roughly one second.
//     At that granularity a 1741ms lane and a 2061ms lane are first observed as
//     finished on the SAME tick, and the parallelism the whole feature exists to
//     show collapses into "everything finished at once". rAF pauses cleanly when
//     hidden instead of ticking coarsely.
//  2. Progress is computed from elapsed wall-clock (`Date.now() - startedAt`),
//     never accumulated per tick, so a tab that was hidden and comes back
//     resumes at the correct position rather than replaying.
let _raf: number | null = null
let _settle: ReturnType<typeof setTimeout> | null = null
let _startedAt = 0

function clearTimer(): void {
  if (_raf !== null) {
    cancelAnimationFrame(_raf)
    _raf = null
  }
  if (_settle !== null) {
    clearTimeout(_settle)
    _settle = null
  }
}

/** Respect the user's motion preference: no stagger, no animation, straight to
 *  the finished state. The RESULT is identical either way — only the reveal
 *  differs — which is the whole point of computing findings up front. */
function reducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface AgentState {
  run: AgentRunState | null
  /** Results for the current run, revealed lane by lane. */
  results: AgentResults
}

interface AgentActions {
  /** Start a run. `results` must already be complete — this store never
   *  computes a finding. `onComplete` is where Application changes belong. */
  startRun: (
    plan: AgentRunPlan,
    results: AgentResults,
    onComplete?: (results: AgentResults) => void,
  ) => void
  /** Abandon the current run. Safe to call when nothing is running. */
  cancelRun: () => void
  /** Skip the theatre and land on the finished state immediately. */
  finishNow: () => void
  resetAgents: () => void
}

const EMPTY: AgentState = { run: null, results: {} }

export const useAgentStore = create<AgentState & AgentActions>((set, get) => ({
  ...EMPTY,

  startRun: (plan, results, onComplete) => {
    clearTimer()

    const lanes: LaneState[] = plan.tasks.map((t) => ({
      agent: t.agent,
      status: 'queued',
      progress: 0,
      stepIndex: 0,
    }))

    // Reduced motion, or a plan with nothing in it: land finished.
    if (reducedMotion() || plan.tasks.length === 0) {
      set({
        results,
        run: {
          runId: plan.id,
          kind: plan.kind,
          appId: plan.appId,
          status: 'complete',
          lanes: lanes.map((l) => ({
            ...l,
            status: 'done',
            progress: 1,
            stepIndex: Math.max(0, (plan.tasks.find((t) => t.agent === l.agent)?.steps.length ?? 1) - 1),
            result: results[l.agent],
          })),
        },
      })
      onComplete?.(results)
      return
    }

    set({
      results,
      run: { runId: plan.id, kind: plan.kind, appId: plan.appId, status: 'running', lanes },
    })

    _startedAt = Date.now()
    let notified = false

    const frame = () => {
      const elapsed = Date.now() - _startedAt
      const cur = get().run
      // The run was cancelled or replaced underneath us.
      if (!cur || cur.runId !== plan.id) {
        clearTimer()
        return
      }

      const next: LaneState[] = plan.tasks.map((task) => {
        const ratio = Math.min(1, elapsed / task.durationMs)
        const done = ratio >= 1
        return {
          agent: task.agent,
          status: done ? 'done' : 'running',
          progress: ratio,
          // Hold on the last step rather than running off the end.
          stepIndex: Math.min(task.steps.length - 1, Math.floor(ratio * task.steps.length)),
          result: done ? results[task.agent] : undefined,
        }
      })

      const allDone = next.every((l) => l.status === 'done')
      set({
        run: { ...cur, lanes: next, status: allDone ? 'complete' : 'running' },
      })

      if (allDone) {
        settle()
        return
      }
      _raf = requestAnimationFrame(frame)
    }

    /** Land the outcome. Idempotent — whichever of rAF or the wall-clock
     *  timeout gets here first wins, and the other becomes a no-op. */
    const settle = () => {
      clearTimer()
      if (notified) return
      notified = true
      const cur = get().run
      if (cur && cur.runId === plan.id) {
        set({
          run: {
            ...cur,
            status: 'complete',
            lanes: plan.tasks.map((t) => ({
              agent: t.agent,
              status: 'done' as const,
              progress: 1,
              stepIndex: t.steps.length - 1,
              result: results[t.agent],
            })),
          },
        })
      }
      onComplete?.(results)
    }

    // rAF drives the VISUALS and pauses when the tab is hidden — which is right
    // for an animation and wrong for an outcome. A customer who uploads a
    // document and switches tabs must not come back to find the upload never
    // registered. So a wall-clock timeout guarantees the result lands whether
    // or not anyone is watching; rAF only ever makes it look good getting there.
    _settle = setTimeout(settle, runDuration(plan) + 60)
    _raf = requestAnimationFrame(frame)
  },

  cancelRun: () => {
    clearTimer()
    set({ ...EMPTY })
  },

  finishNow: () => {
    clearTimer()
    const cur = get().run
    if (!cur) return
    const results = get().results
    set({
      run: {
        ...cur,
        status: 'complete',
        lanes: cur.lanes.map((l) => ({
          ...l,
          status: 'done',
          progress: 1,
          result: results[l.agent],
        })),
      },
    })
  },

  resetAgents: () => {
    clearTimer()
    set({ ...EMPTY })
  },
}))

// §18 — a live interval would survive `Reset demo data` and keep ticking against
// a run whose application no longer exists.
registerJourneyReset(() => useAgentStore.getState().resetAgents())
