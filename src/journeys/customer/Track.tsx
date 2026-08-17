// ============================================================================
// CJ-19 Ready to submit · CJ-20 Track · CJ-27 Closed
//
// CJ-20 renders data/customerMirror.ts and NOTHING ELSE. No stage IDs, no
// department names, no derived guesses. If a stage's mirror text is wrong, fix
// customerMirror.ts — that fixes both surfaces at once.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import type { Application } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  ScreenTitle,
  SectionHeading,
  inrFull,
} from '@/journeys/common/glib'
import { liveRail, draftRail } from './rail'
import { BLOCKER_COPY, type CustomerBlocker } from '@/journeys/copy'
import { customerFacingStatus } from '@/data/customerMirror'
import { blockingCount, collectedHeadline, stageRank } from '@/lib/customerTasks'
import { sendBackCopy } from '@/lib/plainLanguage'
import { fmtDate } from '@/lib/format'
import { useJourney } from '@/journeys/useJourney'
import { CollectedHeadline } from '@/journeys/common/TaskCard'

// ---------------------------------------------------------------------------
// CJ-19 · Ready to submit
// ---------------------------------------------------------------------------
export function Submit({ app }: { app: Application }) {
  const nav = useNavigate()
  const { emit } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const blocking = blockingCount(app, 'applicant')
  const submitOnly = blocking === 1 // just the "finish and submit" task itself

  function submit() {
    // §16.3 — this runs the SAME FORWARD_GATES as an Ops officer clicking
    // move-forward. If gating blocks it, the customer sees the blocking task,
    // not an error, so we simply land them back on the list.
    const before = app.stage
    emit('APPLICATION_SUBMITTED', { from: before }, `${app.appId}:${before}`)
    nav(`/apply/${app.appId}/status`)
  }

  return (
    <AppShell steps={draftRail('submit')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/security`}>Security</BackLink>
      <ScreenTitle
        title="Ready to send this to the bank"
        intro="You can keep adding documents afterwards — sending it now starts the clock on their side."
      />

      <GCard className="mb-4">
        <Row label="University" value={app.university} />
        <Row label="Course" value={app.program} />
        <Row label="Starting" value={String(app.intake).replace('-', ' ')} />
        <Row label="Borrowing" value={inrFull(app.askInr)} />
        <Row
          label="Co-applicant"
          value={app.parties.find((p) => p.role === 'co_applicant')?.name ?? 'Invited, not joined yet'}
        />
      </GCard>

      <CollectedHeadline app={app} />

      {!submitOnly ? (
        <div className="mb-4">
          <Callout tone="support" title="There’s still a list waiting">
            {blocking - 1 === 1
              ? 'One thing on your list hasn’t been done yet.'
              : `${blocking - 1} things on your list haven’t been done yet.`}{' '}
            You can send this now and finish them afterwards — the bank starts
            reading either way.
          </Callout>
        </div>
      ) : null}

      <SectionHeading>Before you send</SectionHeading>
      <ul className="mb-4 space-y-2 text-[14px] leading-[21px] text-[var(--grey-600)]">
        <li>
          Everything you&rsquo;ve told us is true to the best of your knowledge.
        </li>
        <li>
          Horizon Bank may check what you&rsquo;ve given against the issuing
          authorities and the credit bureaus.
        </li>
        <li>
          This is an application, not an approval. The bank decides, and it can
          decline.
        </li>
      </ul>

      <ActionBar>
        <GButton block onClick={submit}>
          Send my application to the bank
        </GButton>
        <GButton block tone="quiet" onClick={() => nav(`/apply/${app.appId}/tasks`)}>
          Back to my list
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--blue-grey)] py-2.5 last:border-b-0">
      <span className="text-[14px] text-[var(--grey-600)]">{label}</span>
      <span className="max-w-[62%] text-right text-[15px] font-semibold leading-5">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CJ-20 · Track
// ---------------------------------------------------------------------------

/** §14 — the only blocker states a customer ever sees. Nothing finer. */
function customerBlocker(app: Application): CustomerBlocker {
  if (app.blocker.kind === 'third_party') return 'third_party'
  if (app.blocker.kind === 'customer') {
    const you = blockingCount(app, 'applicant')
    return you > 0 ? 'you' : 'parent'
  }
  return 'reviewing'
}

export function Track({ app }: { app: Application }) {
  const nav = useNavigate()
  const blocking = blockingCount(app, 'applicant')
  const parentTasks = blockingCount(app, 'co_applicant')
  const mirror = customerFacingStatus(app)
  const sendBack = sendBackCopy(app.audit.find((e) => e.verb === 'SEND BACK')?.reasonCode)
  const blocker = customerBlocker(app)
  const h = collectedHeadline(app)

  const parent = app.parties.find((p) => p.role === 'co_applicant')
  // The student sees only a COUNT of their parent's progress — never a document,
  // an income figure, a bureau result or a consent artifact (§7.6).
  const parentTotal = 5
  const parentDone = parent
    ? Math.max(0, parentTotal - Math.min(parentTotal, parentTasks))
    : 0

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <ScreenTitle title="Where your application is" />

      <GCard tone={blocking > 0 ? 'warn' : 'info'} className="mb-4">
        <p className="display text-[17px] font-semibold leading-6">{mirror}</p>
        {sendBack && blocking > 0 ? (
          <p className="mt-2 text-[14px] leading-[21px]">{sendBack}</p>
        ) : null}
        <div className="mt-3">
          <GChip tone={blocking > 0 ? 'warn' : 'neutral'}>{BLOCKER_COPY[blocker]}</GChip>
        </div>
      </GCard>

      {blocking > 0 ? (
        <div className="mb-5">
          <GButton block onClick={() => nav(`/apply/${app.appId}/action`)}>
            {blocking} thing{blocking === 1 ? '' : 's'} need{blocking === 1 ? 's' : ''} you — let&rsquo;s do them
          </GButton>
        </div>
      ) : null}

      <SectionHeading>Your journey</SectionHeading>
      <ol className="mb-5">
        {milestones(app).map((m) => (
          <li key={m.id} className="flex gap-3 py-2">
            <span
              aria-hidden
              className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                m.state === 'done'
                  ? 'bg-[var(--ok)]'
                  : m.state === 'current'
                    ? 'bg-white ring-2 ring-[var(--glib-blue)]'
                    : 'bg-[var(--grey-300)]'
              }`}
            />
            <span className="min-w-0">
              <span
                className={`display block text-[15px] font-semibold leading-[21px] ${
                  m.state === 'todo' ? 'text-[var(--grey-300)]' : ''
                }`}
              >
                {m.label}
              </span>
              {m.detail ? (
                <span className="block text-[13px] leading-5 text-[var(--grey-600)]">
                  {m.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {parent ? (
        <GCard tone="support" className="mb-4">
          <p className="display text-[15px] font-semibold">
            {parent.name.split(' ')[0]}&rsquo;s part
          </p>
          <p className="mt-1 num text-[14px] leading-[21px] text-[var(--grey-600)]">
            {parentDone} of {parentTotal} done
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--grey-600)]">
            Their documents and income details stay between them and the bank.
          </p>
        </GCard>
      ) : null}

      <GCard tone="support">
        <p className="text-[13px] leading-5 text-[var(--grey-600)]">
          Files like yours usually reach a decision within two to three weeks of
          everything being in. That&rsquo;s a typical time, not a promise.
        </p>
        {h.needsYou === 0 && app.blocker.kind !== 'customer' ? (
          <p className="mt-2 text-[13px] leading-5 text-[var(--grey-600)]">
            Nothing is waiting on you at the moment.
          </p>
        ) : null}
      </GCard>

      <ActionBar>
        <GButton block tone="secondary" onClick={() => nav(`/apply/${app.appId}/tasks`)}>
          See my list
        </GButton>
        <GButton block tone="quiet" onClick={() => nav(`/apply/${app.appId}/consents`)}>
          What I&rsquo;m sharing
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

/** §14.4 — S03–S09's parallelism collapses into three customer-legible
 *  milestones. The internal lane structure is never rendered. */
function milestones(app: Application): {
  id: string
  label: string
  detail?: string
  state: 'done' | 'current' | 'todo'
}[] {
  const rank = stageRank(app.stage)
  const parent = app.parties.find((p) => p.role === 'co_applicant')
  const raw: { id: string; label: string; doneAt: number; detail?: string }[] = [
    { id: 'sent', label: 'Application sent', doneAt: 2, detail: fmtDate(app.createdAt) },
    { id: 'you', label: 'Your details', doneAt: 5 },
    {
      id: 'parent',
      label: 'Your parent’s details',
      doneAt: 6,
      detail: parent ? undefined : 'Waiting for them to join',
    },
  ]
  if (app.securedConstruct) {
    raw.push({ id: 'security', label: 'Security', doneAt: 9, detail: 'The bank’s lawyer and valuer' })
  }
  raw.push({ id: 'decision', label: 'Decision', doneAt: 10 })
  raw.push({
    id: 'offer',
    label: 'Your offer and signing',
    doneAt: 12,
    detail: app.sanctionExpiryDate ? `Valid until ${fmtDate(app.sanctionExpiryDate)}` : undefined,
  })
  raw.push({ id: 'money', label: 'Money to your university', doneAt: 14 })

  let currentSet = false
  return raw.map((m) => {
    if (rank > m.doneAt) return { ...m, state: 'done' as const }
    if (!currentSet) {
      currentSet = true
      return { ...m, state: 'current' as const }
    }
    return { ...m, state: 'todo' as const }
  })
}

// ---------------------------------------------------------------------------
// CJ-27 · Closed
// ---------------------------------------------------------------------------
export function Closed({ app }: { app: Application }) {
  const nav = useNavigate()
  const kind = app.outcome?.kind
  const title =
    kind === 'withdrawn'
      ? 'You withdrew this application'
      : kind === 'expired'
        ? 'This application has closed'
        : 'We couldn’t approve this one'

  const body =
    kind === 'withdrawn'
      ? 'Nothing is outstanding. If your plans change, you can start again at any time.'
      : kind === 'expired'
        ? 'It had been sitting without activity for a while, so it closed automatically. Starting again is quick — most of what you gave us can be reused.'
        : 'Horizon Bank has reviewed everything and isn’t able to lend on this application. That decision is theirs, and it isn’t a judgement about you.'

  return (
    <AppShell homeTo="/apply">
      <ScreenTitle title={title} intro={body} />

      <GCard tone="support" className="mb-4">
        <p className="display mb-2 text-[15px] font-semibold">What you can do now</p>
        <ul className="space-y-2 text-[14px] leading-[21px] text-[var(--grey-600)]">
          {kind === 'rejected' ? (
            <>
              <li>
                Ask us for the reason in writing — you&rsquo;re entitled to it,
                and it usually points at something fixable.
              </li>
              <li>
                A co-applicant with higher income, or a smaller amount, often
                changes the answer.
              </li>
            </>
          ) : (
            <li>Start a fresh application whenever you&rsquo;re ready.</li>
          )}
          <li>Your documents stay with us for as long as the rules require.</li>
        </ul>
      </GCard>

      <ActionBar>
        <GButton block onClick={() => nav('/apply')}>
          My applications
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
