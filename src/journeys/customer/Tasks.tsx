// ============================================================================
// CJ-13 Verify identity · CJ-14 Sharing hub · CJ-15 What we need ·
// CJ-21 Action needed
//
// CJ-15 is the spine of the journey. Everything on it comes from
// lib/customerTasks.ts — the screen renders a projection, it does not decide
// what the customer owes.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import type { Application, PartyRole } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  ScreenTitle,
  SectionHeading,
} from '@/journeys/common/glib'
import { CollectedHeadline, TaskList } from '@/journeys/common/TaskCard'
import { CONSENT_COPY } from '@/journeys/copy'
import { CONSENT_DEFS } from '@/data/consents'
import { customerFacingStatus } from '@/data/customerMirror'
import { buildTasks } from '@/lib/customerTasks'
import { fmtDate } from '@/lib/format'
import { liveRail } from './rail'
import { useJourney } from '@/journeys/useJourney'

/** Where a task's detail screen lives, given the party's route root. */
export function taskHref(root: string, task: { route?: string; id: string }): string {
  return task.route ? `${root}/${task.route}` : `${root}/tasks`
}

// ---------------------------------------------------------------------------
// CJ-15 · What we need
// ---------------------------------------------------------------------------
export function Tasks({
  app,
  forParty = 'applicant',
  root,
  title = 'What we need from you',
}: {
  app: Application
  forParty?: PartyRole
  root: string
  title?: string
}) {
  const nav = useNavigate()
  const tasks = buildTasks(app, forParty)
  const blocking = tasks.filter((t) => t.blocking).length

  return (
    // The rail charts the STUDENT's journey — "Your details", "Decision",
    // "Money out". On a co-applicant's or security owner's screen it is both
    // meaningless and a disclosure of how far along someone else is, so the
    // portals get no rail. Their own path is short and the list describes it.
    <AppShell
      steps={forParty === 'applicant' ? liveRail(app) : undefined}
      homeTo={forParty === 'applicant' ? '/apply' : root}
    >
      <ScreenTitle
        title={title}
        intro={
          blocking > 0
            ? 'Start anywhere. The quickest ones are at the top.'
            : undefined
        }
      />

      <CollectedHeadline app={app} forParty={forParty === 'applicant' ? undefined : forParty} />

      <TaskList
        app={app}
        forParty={forParty}
        onOpen={(t) => nav(taskHref(root, t))}
        emptyTitle="Nothing needed from you right now"
        emptyBody={
          <>
            <p>We&rsquo;ll message you if that changes.</p>
            <p className="mt-2 text-[var(--glib-grey)]">{customerFacingStatus(app)}</p>
          </>
        }
      />

      {forParty === 'applicant' ? (
        <ActionBar>
          <GButton block tone="secondary" onClick={() => nav(`${root}/status`)}>
            See where my application is
          </GButton>
        </ActionBar>
      ) : null}
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-21 · Action needed — the send-back landing
// ---------------------------------------------------------------------------
export function ActionNeeded({ app, root }: { app: Application; root: string }) {
  const nav = useNavigate()
  const urgent = buildTasks(app, 'applicant').filter(
    (t) => t.origin === 'send_back' || t.origin === 'validation',
  )

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`${root}/status`}>Where my application is</BackLink>
      <ScreenTitle
        title="A couple of things need you"
        intro="Nothing has gone wrong. The bank has read your documents and needs one or two of them again."
      />
      {urgent.length === 0 ? (
        <Callout tone="ok" title="Nothing outstanding">
          These have all been dealt with.
        </Callout>
      ) : (
        <ul className="space-y-3">
          {urgent.map((t) => (
            <li key={t.id}>
              <GCard tone="warn">
                <p className="display text-[16px] font-semibold leading-[22px]">{t.title}</p>
                <p className="mt-1 text-[14px] leading-[21px]">{t.why}</p>
                <div className="mt-3">
                  <GButton size="sm" onClick={() => nav(taskHref(root, t))}>
                    Sort this out
                  </GButton>
                </div>
              </GCard>
            </li>
          ))}
        </ul>
      )}
      <ActionBar>
        <GButton block tone="secondary" onClick={() => nav(`${root}/tasks`)}>
          See everything on my list
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-14 · Sharing hub — every consent, its state, what it unlocks, revoke
// ---------------------------------------------------------------------------
export function SharingHub({
  app,
  forParty = 'applicant',
  root,
}: {
  app: Application
  forParty?: PartyRole
  root: string
}) {
  const nav = useNavigate()
  // The surface has to say where the act actually happened — a parent revoking
  // a consent from their own portal is not the customer surface.
  const { emit } = useJourney({
    appId: app.appId,
    partyRole: forParty,
    surface:
      forParty === 'co_applicant'
        ? 'co_applicant'
        : forParty === 'collateral_provider'
          ? 'collateral'
          : 'customer',
  })

  // Only the consents THIS party can grant. A student is never shown their
  // parent's bureau consent (§7.6).
  const mine = CONSENT_DEFS.filter((d) => d.grantedBy === forParty)

  return (
    <AppShell
      steps={forParty === 'applicant' ? liveRail(app) : undefined}
      homeTo={forParty === 'applicant' ? '/apply' : root}
    >
      <BackLink to={`${root}/tasks`}>What we need from you</BackLink>
      <ScreenTitle
        title="What you’re sharing"
        intro="Everything you’ve given us permission to fetch, and how to stop it."
      />

      <ul className="space-y-3">
        {mine.map((def) => {
          const artifact = app.consents.find((c) => c.type === def.type)
          const copy = CONSENT_COPY[def.type]
          const status = artifact?.status ?? 'not_requested'
          const covered = app.documents.filter((d) => d.consentType === def.type)
          const fetched = covered.filter((d) => d.status === 'fetched').length

          return (
            <li key={def.type}>
              <GCard>
                <div className="flex items-start justify-between gap-3">
                  <p className="display text-[16px] font-semibold leading-[22px]">{copy.title}</p>
                  <GChip
                    tone={
                      status === 'granted'
                        ? 'ok'
                        : status === 'declined' || status === 'revoked'
                          ? 'neutral'
                          : 'warn'
                    }
                  >
                    {status === 'granted'
                      ? 'On'
                      : status === 'declined'
                        ? 'You said no'
                        : status === 'revoked'
                          ? 'Withdrawn'
                          : status === 'expired'
                            ? 'Expired'
                            : 'Not given yet'}
                  </GChip>
                </div>
                <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
                  {copy.unlocks}
                </p>
                {status === 'granted' ? (
                  <p className="mt-2 text-[13px] leading-5 text-[var(--grey-600)]">
                    {fetched > 0
                      ? `${fetched} document${fetched === 1 ? '' : 's'} came in this way. `
                      : ''}
                    {artifact?.expiresAt ? `Valid until ${fmtDate(artifact.expiresAt)}.` : ''}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {status === 'granted' ? (
                    <GButton
                      size="sm"
                      tone="secondary"
                      onClick={() => {
                        emit(
                          'CONSENT_REVOKED',
                          { consentType: def.type },
                          `${def.type}:revoke:${artifact?.decidedAt ?? ''}`,
                        )
                      }}
                    >
                      Stop sharing this
                    </GButton>
                  ) : (
                    <GButton
                      size="sm"
                      onClick={() => nav(`${root}/consent/${def.type}`)}
                    >
                      {status === 'declined' || status === 'revoked'
                        ? 'Turn it back on'
                        : 'Give permission'}
                    </GButton>
                  )}
                </div>
              </GCard>
            </li>
          )
        })}
      </ul>

      <div className="mt-5">
        <Callout tone="support" title="If you stop sharing">
          Anything already fetched stays on your file — the bank has read it and
          it is part of your application. Nothing new comes through after that,
          and we&rsquo;ll ask you to upload instead.
        </Callout>
      </div>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-13 · Verify identity — a shortcut into the Aadhaar consent
// ---------------------------------------------------------------------------
export function VerifyIdentity({
  app,
  forParty = 'applicant',
  root,
}: {
  app: Application
  forParty?: PartyRole
  root: string
}) {
  const nav = useNavigate()
  const done = app.consents.find((c) => c.type === 'uidai_ekyc')?.status === 'granted'
  const ckyc = app.consents.find((c) => c.type === 'ckyc')?.status === 'granted'

  return (
    <AppShell
      steps={forParty === 'applicant' ? liveRail(app) : undefined}
      homeTo={forParty === 'applicant' ? '/apply' : root}
    >
      <BackLink to={`${root}/tasks`}>What we need from you</BackLink>
      <ScreenTitle
        title="Verify who you are"
        intro="The bank has to confirm your identity before anything else can move. There are two ways, and Aadhaar is the quicker one."
      />

      {done ? (
        <Callout tone="ok" title="Already verified">
          Your identity is confirmed. Nothing more is needed here.
        </Callout>
      ) : (
        <>
          <SectionHeading>Choose how</SectionHeading>
          <div className="space-y-3">
            <GCard>
              <p className="display text-[16px] font-semibold">Verify with Aadhaar</p>
              <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
                A code to your Aadhaar-linked mobile. About a minute, and nothing
                to scan.
              </p>
              <div className="mt-3">
                <GButton size="sm" onClick={() => nav(`${root}/consent/uidai_ekyc`)}>
                  Verify with Aadhaar
                </GButton>
              </div>
            </GCard>

            <GCard>
              <p className="display text-[16px] font-semibold">Use your existing KYC record</p>
              <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
                If you&rsquo;ve completed KYC with any bank before, we can reuse
                that instead.
              </p>
              <div className="mt-3">
                <GButton
                  size="sm"
                  tone="secondary"
                  disabled={ckyc}
                  onClick={() => nav(`${root}/consent/ckyc`)}
                >
                  {ckyc ? 'Already using it' : 'Use my KYC record'}
                </GButton>
              </div>
            </GCard>
          </div>
        </>
      )}

      <ActionBar>
        <GButton block tone="secondary" onClick={() => nav(`${root}/tasks`)}>
          Back to my list
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
