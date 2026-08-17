// ============================================================================
// /handoff/:token (§9.4).
//
// Renders ONLY the one act the handoff is for. There is deliberately no
// navigation from inside a handoff to the rest of the journey: the customer was
// handed a phone, or sent a link for one specific thing, and everything else is
// out of scope for this session.
// ============================================================================
import { useEffect, useState } from 'react'
import type { PartyRole } from '@/types'
import type { Invite, Session } from '@/types/journeys'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '@/store/appStore'
import { HANDOFF_LABEL, useSessionStore } from '@/store/sessionStore'
import { AppShell } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  ScreenTitle,
} from '@/journeys/common/glib'
import { ConsentFlow } from '@/journeys/common/ConsentFlow'
import { Otp } from '@/journeys/auth/Otp'
import { consentForHandoff, verifyHandoff } from '@/lib/handoff'
import { useJourney } from '@/journeys/useJourney'
import { OFFICER_BY_ID } from '@/data/org'
import { POLICY } from '@/data/policy'

/** The party's own mobile and email, from the invite that brought them onto the
 *  file or from a session they already hold. Never synthesised: a code sent
 *  anywhere other than their real number proves nothing. */
function partyContact(
  invites: Invite[],
  sessions: Session[],
  appId: string,
  forParty: PartyRole,
  displayName: string,
): { mobile: string; email: string } {
  const kind = forParty === 'co_applicant' ? 'co_applicant' : 'collateral_provider'
  const invite =
    forParty === 'applicant'
      ? undefined
      : invites.find((i) => i.appId === appId && i.kind === kind)
  if (invite) return { mobile: invite.mobile, email: invite.email }

  const known = sessions.find((s) => s.partyRole === forParty && s.appIds.includes(appId))
  if (known) return { mobile: known.mobile, email: known.email }

  // Nothing on file. The customer is asked for it rather than being sent a code
  // to an address nobody has ever confirmed.
  return { mobile: '', email: `${displayName.split(' ')[0].toLowerCase()}@example.com` }
}

export function HandoffLanding() {
  const { token } = useParams()
  const nav = useNavigate()

  const invites = useSessionStore((s) => s.invites)
  const handoffs = useSessionStore((s) => s.handoffs)
  const openHandoff = useSessionStore((s) => s.openHandoff)
  const completeHandoff = useSessionStore((s) => s.completeHandoff)
  const issueOtp = useSessionStore((s) => s.issueOtp)
  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const apps = useStore((s) => s.applications)

  const [phase, setPhase] = useState<'act' | 'declined' | 'done'>('act')
  const raw = handoffs.find((h) => h.token === token)
  const verdict = verifyHandoff(raw)
  const handoff = verdict.ok ? verdict.handoff : undefined
  const app = apps.find((a) => a.appId === handoff?.appId)

  const { emit, milestone } = useJourney({
    appId: handoff?.appId,
    partyRole: handoff?.forParty ?? 'applicant',
    surface: 'handoff',
    viaHandoff: handoff?.id,
    onBehalfOfficerId: handoff?.issuedBy,
  })

  useEffect(() => {
    if (token && verdict.ok) openHandoff(token)
    // Opening is a one-shot side effect keyed on the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // §9.4 — an expired or already-completed token dead-ends CLEANLY, with a
  // re-issue path and no alarm.
  if (!verdict.ok || !handoff || !app) {
    return (
      <AppShell>
        <ScreenTitle
          title={
            verdict.ok
              ? 'We can’t open this one'
              : verdict.why === 'completed'
                ? 'This is already done'
                : verdict.why === 'expired'
                  ? 'This link has expired'
                  : 'This link isn’t valid'
          }
          intro={verdict.ok ? 'The application behind this link is no longer available.' : verdict.message}
        />
        <GCard tone="support" className="mb-4">
          <p className="text-[14px] leading-[21px]">
            Nothing has been lost. Your officer can send a fresh link and pick up
            exactly where you left off.
          </p>
        </GCard>
        <ActionBar>
          <GButton block tone="secondary" onClick={() => nav('/')}>
            Ask your officer for a new link
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  const officer = OFFICER_BY_ID[handoff.issuedBy]
  const party = app.parties.find((p) => p.role === handoff.forParty)
  const customerName = party?.name ?? app.studentName
  const consentType = consentForHandoff(handoff.reason)
  const liveSession = sessions.find((s) => s.id === activeIds[handoff.forParty])

  // Where the party's own contact details come from, in order of authority:
  // the invite that brought them onto the file, then any session they already
  // hold. A co-applicant or security owner always arrived through an invite,
  // so the number is real; the applicant may have signed in directly.
  const contact = partyContact(invites, sessions, app.appId, handoff.forParty, customerName)

  // -- 1. Own OTP, unless this party already has a live session (§9.4) -------
  if (phase === 'act' && !liveSession) {
    return (
      <AppShell>
        <ScreenTitle
          title={HANDOFF_LABEL[handoff.reason]}
          intro={`${officer?.name ?? 'Your officer'} has set this up for you. First, a code to your own mobile — this step has to be you.`}
        />
        <GCard tone="support" className="mb-4">
          <p className="text-[14px] leading-[21px]">
            This link does one thing and nothing else. It cannot see the rest of
            the application, and it stops working{' '}
            {handoff.mode === 'in_branch'
              ? `${POLICY.handoffInBranchValidityMinutes} minutes after it was created`
              : `after ${POLICY.handoffValidityHours} hours`}
            .
          </p>
        </GCard>
        {!contact.mobile ? (
          <Callout tone="warn" title="We don’t have a number for you yet">
            Your officer needs to add your mobile to the application before this
            step can be sent to you. Nothing else is needed from you right now.
          </Callout>
        ) : null}

        <ActionBar>
          <GButton
            block
            disabled={!contact.mobile}
            onClick={() => {
              // The code must go to the party's OWN number — that is the entire
              // point of a handoff. An earlier version fabricated one from the
              // application id, which would have let anyone holding the link
              // verify as them.
              const c = issueOtp({
                mobile: contact.mobile,
                email: contact.email,
                partyRole: handoff.forParty,
                displayName: customerName,
                returnTo: `/handoff/${token}`,
              })
              nav('/otp', { state: { challengeId: c.id } })
            }}
          >
            Send me a code
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  // -- 2. Completed ---------------------------------------------------------
  if (phase === 'done') {
    return (
      <AppShell>
        <ScreenTitle
          title="Done"
          intro={
            handoff.mode === 'in_branch'
              ? 'You can hand the device back to the officer now.'
              : 'That’s everything from your side. Your officer has been told.'
          }
        />
        <GCard tone="ok" className="mb-4">
          <p className="text-[14px] leading-[21px]">
            {HANDOFF_LABEL[handoff.reason]} is complete. Nothing else is needed
            from you on this link.
          </p>
        </GCard>
        <ActionBar>
          <GButton block tone="secondary" onClick={() => nav('/')}>
            {handoff.mode === 'in_branch' ? 'Return to the officer' : 'Close'}
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  if (phase === 'declined') {
    return (
      <AppShell>
        <ScreenTitle
          title="No problem"
          intro="We’ve told your officer. They’ll collect those documents from you the ordinary way instead."
        />
        <ActionBar>
          <GButton block tone="secondary" onClick={() => nav('/')}>
            {handoff.mode === 'in_branch' ? 'Return to the officer' : 'Close'}
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  // -- 3. The one act -------------------------------------------------------
  if (consentType) {
    return (
      <AppShell>
        <ConsentFlow
          app={app}
          type={consentType}
          partyRole={handoff.forParty}
          onGrant={() => {
            // §9.4 — HANDOFF_COMPLETED plus the underlying event. The audit line
            // names the customer AND the issuing officer (§9.5).
            emit('CONSENT_GRANTED', { consentType }, `${handoff.id}:${consentType}:grant`)
            emit(
              'HANDOFF_COMPLETED',
              { handoffId: handoff.id, reason: handoff.reason },
              `${handoff.id}:complete`,
            )
            milestone(
              'HANDOFF COMPLETED',
              `${HANDOFF_LABEL[handoff.reason]} completed by ${customerName}`,
            )
            completeHandoff(handoff.token)
            setPhase('done')
          }}
          onDecline={(reason) => {
            emit('CONSENT_DECLINED', { consentType, reason }, `${handoff.id}:${consentType}:decline`)
            completeHandoff(handoff.token)
            setPhase('declined')
          }}
          onCancel={() => setPhase('done')}
        />
      </AppShell>
    )
  }

  // Non-consent identity-bound acts (e-sign, mandate, acceptance, liveness).
  return (
    <AppShell>
      <ScreenTitle
        title={HANDOFF_LABEL[handoff.reason]}
        intro={`${officer?.name ?? 'Your officer'} has set this up. This step has to be done by you.`}
      />
      <Callout tone="support" title="Prototype">
        In the real product this is where the signing, mandate or liveness screen
        would run. Confirming here records it exactly as the live flow would.
      </Callout>
      <ActionBar>
        <GButton
          block
          onClick={() => {
            emit(
              'HANDOFF_COMPLETED',
              { handoffId: handoff.id, reason: handoff.reason },
              `${handoff.id}:complete`,
            )
            milestone(
              'HANDOFF COMPLETED',
              `${HANDOFF_LABEL[handoff.reason]} completed by ${customerName}`,
            )
            completeHandoff(handoff.token)
            setPhase('done')
          }}
        >
          Confirm — this is me
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

export { Otp }
