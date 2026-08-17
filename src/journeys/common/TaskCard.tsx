// ============================================================================
// Task card + the "what we need" list (§10).
//
// Shared by the customer journey (CJ-15), the co-applicant portal (CO-06) and
// the collateral portal (CP-04) — one engine, one card, three surfaces. That is
// what stops the parent's list drifting away from the student's.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import type { Application, PartyRole } from '@/types'
import type { CustomerTask } from '@/types/journeys'
import { GCard, GChip, GEmpty, GRowButton, humanSeconds } from '@/journeys/common/glib'
import { buildTasks, collectedHeadline } from '@/lib/customerTasks'

const KIND_WORD: Record<CustomerTask['kind'], string> = {
  consent: 'Give permission',
  upload: 'Send documents',
  form: 'Fill in',
  review: 'Check something',
  invite: 'Invite someone',
  payment: 'Pay',
  esign: 'Sign',
  mandate: 'Set up',
  acknowledge: 'Review',
}

export function TaskCard({
  task,
  onOpen,
  exiting,
}: {
  task: CustomerTask
  onOpen: () => void
  exiting?: boolean
}) {
  const attention = task.origin === 'send_back' || task.origin === 'validation'
  return (
    <li
      // A card on its way out is inert: it must not take focus or a tap during
      // the 460ms it is still on screen.
      aria-hidden={exiting || undefined}
      className={exiting ? 'task-exit overflow-hidden pointer-events-none' : 'task-enter'}
    >
      <GRowButton
        onClick={onOpen}
        tabIndex={exiting ? -1 : undefined}
        className={attention ? 'border-[color:var(--warn)] bg-[#fdf6ea]' : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display text-[16px] font-semibold leading-[22px] text-[var(--glib-grey)]">
              {task.title}
            </p>
            <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">{task.why}</p>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            aria-hidden
            className="mt-1 shrink-0 text-[var(--glib-blue)]"
          >
            <path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {attention ? <GChip tone="warn">Needs your attention</GChip> : null}
          <GChip tone={task.origin === 'checklist' && task.kind === 'consent' ? 'accent' : 'neutral'}>
            {KIND_WORD[task.kind]}
          </GChip>
          {task.detail ? <GChip tone="neutral">{task.detail}</GChip> : null}
          <span className="text-[12px] text-[var(--grey-600)]">{humanSeconds(task.estSeconds)}</span>
        </div>
      </GRowButton>
    </li>
  )
}

/** The headline the whole design exists to deliver (§10.2).
 *
 *  `forParty` is omitted on the student's CJ-15 (app-wide, the acceptance-item-8
 *  number) and supplied by the co-applicant and collateral portals. */
export function CollectedHeadline({
  app,
  forParty,
}: {
  app: Application
  forParty?: PartyRole
}) {
  const h = collectedHeadline(app, forParty)
  if (h.total === 0) return null
  return (
    <GCard tone="support" className="mb-5">
      <p className="display text-[18px] font-bold leading-6 text-[var(--glib-grey)]">
        We&rsquo;ve already collected{' '}
        <span className="num">
          {h.collected} of {h.total}
        </span>{' '}
        documents for you.
      </p>
      <p className="mt-1 text-[15px] leading-[22px] text-[var(--grey-600)]">
        {h.needsYou === 0
          ? 'Nothing on this list needs you right now.'
          : `${h.needsYou} need${h.needsYou === 1 ? 's' : ''} you.`}
      </p>
      {h.needsConsent > 0 ? (
        <p className="mt-2 text-[13px] leading-5 text-[var(--grey-600)]">
          {h.needsConsent} of those would arrive on their own if you give us
          permission to fetch them.
        </p>
      ) : null}
    </GCard>
  )
}

/** The list itself, with the §11.3 disappearance animation. */
export function TaskList({
  app,
  forParty,
  onOpen,
  emptyTitle = 'Nothing needed from you right now',
  emptyBody,
}: {
  app: Application
  forParty: PartyRole
  onOpen: (task: CustomerTask) => void
  emptyTitle?: string
  emptyBody?: React.ReactNode
}) {
  const tasks = buildTasks(app, forParty)
  // The whole TASK, not just its id — an outgoing card still has to render, and
  // by the time it leaves the projection it is no longer in `tasks` to look up.
  const [exiting, setExiting] = useState<CustomerTask[]>([])
  const prev = useRef<CustomerTask[]>(tasks)

  // `tasks` is a fresh array on every render, so the effect keys on the id SET
  // instead — otherwise it re-runs forever and nothing ever settles.
  const idKey = tasks.map((t) => t.id).join('|')

  // When a consent clears N documents, N tasks vanish AT ONCE. Animating that
  // is the moment that sells the product, so the outgoing cards are held in the
  // list for one beat rather than being ripped out of the DOM.
  useEffect(() => {
    const live = new Set(tasks.map((t) => t.id))
    const gone = prev.current.filter((t) => !live.has(t.id))
    prev.current = tasks
    if (gone.length === 0) return
    if (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    setExiting(gone)
    const timer = setTimeout(() => setExiting([]), 460)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey])

  if (tasks.length === 0 && exiting.length === 0) {
    return <GEmpty title={emptyTitle}>{emptyBody}</GEmpty>
  }

  // Outgoing cards render first. Consents sort near the top of the list, so a
  // granted one animates away roughly where the customer was already looking.
  return (
    <ul className="space-y-3">
      {exiting.map((t) => (
        <TaskCard key={`exit-${t.id}`} task={t} onOpen={() => {}} exiting />
      ))}
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onOpen={() => onOpen(t)} />
      ))}
    </ul>
  )
}
