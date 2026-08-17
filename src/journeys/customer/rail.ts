// ============================================================================
// Progress rail steps (§14.4).
//
// S03–S09's internal parallelism collapses into THREE customer-legible
// milestones — Your details · Your parent's details · Security — plus the two
// bookends. The internal lane structure is never rendered to a customer.
// ============================================================================
import type { Application } from '@/types'
import type { RailStep } from '@/journeys/shell/ProgressRail'
import { stageRank } from '@/lib/customerTasks'

/** The rail while the customer is still filling their application in. */
export function draftRail(step: string): RailStep[] {
  const order = ['plan', 'cost', 'parent-snapshot', 'offer', 'profile', 'submit']
  const labels: Record<string, string> = {
    plan: 'Your plan',
    cost: 'What it costs',
    'parent-snapshot': 'Your parent',
    offer: 'Your offer',
    profile: 'About you',
    submit: 'Submit',
  }
  const idx = Math.max(0, order.indexOf(step))
  return order.map((id, i) => ({
    id,
    label: labels[id],
    state: i < idx ? 'done' : i === idx ? 'current' : 'todo',
  }))
}

/** The rail once the file is live with the bank. */
export function liveRail(app: Application): RailStep[] {
  const rank = stageRank(app.stage)
  const steps: { id: string; label: string; doneAt: number }[] = [
    { id: 'you', label: 'Your details', doneAt: 5 },
    { id: 'parent', label: 'Your parent’s details', doneAt: 6 },
  ]
  if (app.securedConstruct) {
    steps.push({ id: 'security', label: 'Security', doneAt: 9 })
  }
  steps.push({ id: 'decision', label: 'Decision', doneAt: 10 })
  steps.push({ id: 'offer', label: 'Your offer', doneAt: 12 })
  steps.push({ id: 'money', label: 'Money out', doneAt: 14 })

  let currentSet = false
  return steps.map((s) => {
    if (rank > s.doneAt) return { id: s.id, label: s.label, state: 'done' as const }
    if (!currentSet) {
      currentSet = true
      return { id: s.id, label: s.label, state: 'current' as const }
    }
    return { id: s.id, label: s.label, state: 'todo' as const }
  })
}
