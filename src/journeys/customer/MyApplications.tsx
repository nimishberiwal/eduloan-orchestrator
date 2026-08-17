// ============================================================================
// CJ-03 · My applications — resume, or start a new one.
//
// Also the point where an application is CREATED. A journey file starts at
// APP-2801 (§0.2) with everything `requested` and nothing verified.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/journeys/shell/AppShell'
import {
  GButton,
  GChip,
  GEmpty,
  GRowButton,
  ScreenTitle,
  inrShort,
} from '@/journeys/common/glib'
import { useStore } from '@/store/appStore'
import { useSessionStore } from '@/store/sessionStore'
import { POLICY } from '@/data/policy'
import { customerFacingStatus } from '@/data/customerMirror'
import { collectedHeadline } from '@/lib/customerTasks'
import { daysBetween, fmtDate } from '@/lib/format'
import { nowIso } from '@/lib/clock'
import { PROGRAM_START_DEFAULT, startApplication } from './startApplication'

export function MyApplications() {
  const nav = useNavigate()
  const apps = useStore((s) => s.applications)
  const createJourneyApplication = useStore((s) => s.createJourneyApplication)
  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const attachApp = useSessionStore((s) => s.attachApp)

  const session = sessions.find((s) => s.id === activeIds.applicant)

  if (!session) {
    return (
      <AppShell>
        <ScreenTitle
          title="Sign in to see your application"
          intro="We'll send a code to your mobile. It takes a few seconds."
        />
        <GButton block onClick={() => nav('/start')}>
          Sign in
        </GButton>
      </AppShell>
    )
  }

  const mine = apps.filter((a) => session.appIds.includes(a.appId))

  function start() {
    const appId = startApplication({
      create: createJourneyApplication,
      studentName: session?.displayName ?? 'New applicant',
      actor: {
        kind: 'applicant',
        partyRole: 'applicant',
        sessionId: session?.id ?? 'SES-ANON',
        name: session?.displayName,
      },
    })
    if (session) attachApp(session.id, appId)
    nav(`/apply/${appId}/plan`)
  }

  return (
    <AppShell>
      <ScreenTitle
        title={`Hello${session.displayName ? `, ${session.displayName.split(' ')[0]}` : ''}`}
        intro={
          mine.length > 0
            ? 'Pick up where you left off, or start a second application.'
            : 'You haven’t started an application yet.'
        }
      />

      {mine.length === 0 ? (
        <GEmpty title="Nothing here yet">
          Starting takes about two minutes and you can stop at any point —
          we&rsquo;ll keep the draft for {POLICY.draftExpiryDays} days.
        </GEmpty>
      ) : (
        <ul className="space-y-3">
          {mine.map((a) => {
            const h = collectedHeadline(a)
            const idle = daysBetween(nowIso(), a.lastCustomerActivityAt ?? a.createdAt)
            const draftDaysLeft = POLICY.draftExpiryDays - idle
            const isDraft = a.stage === 'S01' || a.stage === 'S02'
            return (
              <li key={a.appId}>
                <GRowButton
                  onClick={() =>
                    nav(isDraft ? `/apply/${a.appId}/plan` : `/apply/${a.appId}/status`)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="display text-[16px] font-semibold leading-6">
                        {a.university}
                      </p>
                      <p className="text-[13px] leading-[18px] text-[var(--grey-600)]">
                        {a.program} · {String(a.intake).replace('-', ' ')}
                      </p>
                    </div>
                    <span className="num shrink-0 text-[15px] font-bold">
                      {inrShort(a.askInr)}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-[21px]">{customerFacingStatus(a)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isDraft ? (
                      <GChip tone={draftDaysLeft <= 7 ? 'warn' : 'neutral'}>
                        Draft · {Math.max(0, draftDaysLeft)} days left
                      </GChip>
                    ) : (
                      <GChip tone="neutral">Started {fmtDate(a.createdAt)}</GChip>
                    )}
                    {h.needsYou > 0 ? (
                      <GChip tone="warn">{h.needsYou} need you</GChip>
                    ) : (
                      <GChip tone="ok">Nothing pending with you</GChip>
                    )}
                  </div>
                </GRowButton>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-6">
        <GButton block tone={mine.length === 0 ? 'primary' : 'secondary'} onClick={start}>
          Start a new application
        </GButton>
      </div>

      <p className="mt-4 text-[12px] leading-4 text-[var(--grey-600)]">
        Courses starting {fmtDate(PROGRAM_START_DEFAULT)} onwards. Postgraduate
        study in the USA only, for now.
      </p>
    </AppShell>
  )
}
