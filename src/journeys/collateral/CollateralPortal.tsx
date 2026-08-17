// ============================================================================
// CP-01…CP-04 — the collateral portal (Tier-3 only, deliberately minimal §8).
//
// Asset declaration + the C1–C4 documents + a scheduling stub for the legal and
// technical valuation visits. Nothing more: this party's involvement is narrow
// and a fuller portal would be inventing scope the BRDs don't ask for.
// ============================================================================
import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { Application } from '@/types'
import { useStore } from '@/store/appStore'
import { isInviteExpired, useSessionStore } from '@/store/sessionStore'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChoice,
  GField,
  GInput,
  GNumber,
  ScreenTitle,
  SectionHeading,
  inrFull,
} from '@/journeys/common/glib'
import { Identify } from '@/journeys/auth/Identify'
import { Otp } from '@/journeys/auth/Otp'
import { Tasks } from '@/journeys/customer/Tasks'
import { BucketDetail } from '@/journeys/common/DocFlows'
import { CaptureHost, ConsentHost } from '@/journeys/customer/CustomerJourney'
import { useJourney } from '@/journeys/useJourney'
import { POLICY } from '@/data/policy'

export function CollateralPortal() {
  const { token } = useParams()
  const invites = useSessionStore((s) => s.invites)
  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const apps = useStore((s) => s.applications)

  const invite = invites.find((i) => i.token === token && i.kind === 'collateral_provider')
  const app = apps.find((a) => a.appId === invite?.appId)
  const session = sessions.find((s) => s.id === activeIds.collateral_provider)
  const root = `/security/${token}`

  if (!invite || !app) {
    return (
      <AppShell>
        <ScreenTitle
          title="This link isn’t valid"
          intro="Ask whoever sent it for a fresh one."
        />
      </AppShell>
    )
  }

  if (isInviteExpired(invite)) {
    return (
      <AppShell>
        <ScreenTitle
          title="This link has expired"
          intro={`Invitations are good for ${POLICY.coApplicantInviteDays} days. A new one takes seconds to send.`}
        />
      </AppShell>
    )
  }

  const verified = Boolean(session)

  return (
    <Routes>
      <Route index element={<SecurityLanding app={app} name={invite.name} root={root} verified={verified} />} />
      <Route
        path="verify"
        element={
          <Identify
            partyRole="collateral_provider"
            fixedName={invite.name}
            returnTo={`${root}/asset`}
            backTo={root}
            backLabel="What this is about"
          />
        }
      />
      <Route path="otp" element={<Otp />} />

      {!verified ? (
        <Route path="*" element={<Navigate to={root} replace />} />
      ) : (
        <>
          <Route path="asset" element={<AssetDeclaration app={app} invite={invite} root={root} />} />
          <Route
            path="tasks"
            element={
              <Tasks
                app={app}
                forParty="collateral_provider"
                root={root}
                title="Your property papers"
              />
            }
          />
          <Route path="bucket/:bucketId" element={<SecBucket app={app} root={root} />} />
          <Route
            path="capture/:docId"
            element={
              <CaptureHost app={app} root={root} partyRole="collateral_provider" surface="collateral" />
            }
          />
          <Route
            path="consent/:type"
            element={
              <ConsentHost app={app} root={root} partyRole="collateral_provider" surface="collateral" />
            }
          />
          <Route path="visit" element={<VisitScheduling app={app} root={root} />} />
          <Route path="*" element={<Navigate to={`${root}/tasks`} replace />} />
        </>
      )}
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// CP-01 · Invite landing
// ---------------------------------------------------------------------------
function SecurityLanding({
  app,
  name,
  root,
  verified,
}: {
  app: Application
  name: string
  root: string
  verified: boolean
}) {
  const nav = useNavigate()
  const first = app.studentName.split(' ')[0]
  return (
    <AppShell homeTo={root}>
      <ScreenTitle
        eyebrow="Education loan · Horizon Bank"
        title={`${first} has asked you to put up security`}
        intro={`They're borrowing ${inrFull(app.askInr)} to study in the USA. At that amount the bank asks for property or a financial security behind the loan.`}
      />

      <Callout tone="support" title="What this means">
        The property stays yours and you keep living in it or letting it. The
        bank registers a charge on it, which means it can be sold to recover the
        loan if it is never repaid. That is a real risk and it is worth talking
        it through with {first} before you agree.
      </Callout>

      <div className="mt-4">
        <SectionHeading>What you&rsquo;ll be asked for</SectionHeading>
        <ul className="space-y-2 text-[14px] leading-[21px] text-[var(--grey-600)]">
          <li>Who you are, and a statement of what you own</li>
          <li>The title papers for the property</li>
          <li>A convenient time for the bank&rsquo;s lawyer and valuer to visit</li>
        </ul>
      </div>

      <ActionBar>
        <GButton block onClick={() => nav(verified ? `${root}/tasks` : `${root}/verify`)}>
          {verified ? `Continue as ${name}` : 'Confirm it’s me'}
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CP-03 · Asset declaration
// ---------------------------------------------------------------------------
const ASSET_TYPES = [
  { id: 'immovable', label: 'Property', detail: 'A house, flat or piece of land' },
  { id: 'fd', label: 'Fixed deposit', detail: 'Marked with a lien in the bank’s favour' },
  { id: 'lic', label: 'LIC policy', detail: 'Assigned to the bank' },
  { id: 'mf', label: 'Mutual funds', detail: 'Units marked with a lien' },
  { id: 'gsec', label: 'Government securities', detail: 'Bonds held with a lien' },
] as const

function AssetDeclaration({
  app,
  invite,
  root,
}: {
  app: Application
  invite: { name: string; relationship: string }
  root: string
}) {
  const nav = useNavigate()
  const { emit, milestone } = useJourney({
    appId: app.appId,
    partyRole: 'collateral_provider',
    surface: 'collateral',
  })
  const markInviteJoined = useSessionStore((s) => s.markInviteJoined)
  const { token } = useParams()

  const [kind, setKind] = useState<string>('immovable')
  const [address, setAddress] = useState('')
  const [value, setValue] = useState<number>(0)
  const [encumbered, setEncumbered] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function save() {
    const e: Record<string, string> = {}
    if (kind === 'immovable' && address.trim().length < 5)
      e.address = 'Where is it? Street and city is enough for now.'
    if (value <= 0) e.value = 'Roughly what would it sell for today?'
    if (encumbered === null) e.enc = 'Tell us whether anything is already charged against it.'
    setErrors(e)
    if (Object.keys(e).length) return

    const partyId = `${app.appId}-COL`
    emit(
      'COLLATERAL_JOINED',
      { name: invite.name, relationship: invite.relationship, partyId },
      `${app.appId}:col-join`,
    )
    milestone(
      'SECURITY DECLARED',
      `${ASSET_TYPES.find((a) => a.id === kind)?.label} — indicative value ${inrFull(value)}${
        encumbered ? ' · existing charge declared' : ' · declared unencumbered'
      }`,
    )
    if (token) markInviteJoined(token, partyId)
    nav(`${root}/tasks`)
  }

  return (
    <AppShell homeTo={root}>
      <BackLink to={root}>What this is about</BackLink>
      <ScreenTitle title="What you’re offering" />

      <SectionHeading>What kind of security?</SectionHeading>
      <div className="mb-5 space-y-2">
        {ASSET_TYPES.map((a) => (
          <GChoice
            key={a.id}
            selected={kind === a.id}
            onClick={() => setKind(a.id)}
            title={a.label}
            detail={a.detail}
          />
        ))}
      </div>

      {kind === 'immovable' ? (
        <GField label="Where is it?" error={errors.address} htmlFor="s-addr">
          <GInput id="s-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </GField>
      ) : null}

      <GField
        label="Roughly what is it worth?"
        hint="Your own estimate. The bank sends its own valuer."
        error={errors.value}
        htmlFor="s-val"
      >
        <GNumber id="s-val" prefix="₹" value={value} onValue={setValue} />
      </GField>

      <SectionHeading>Is anything already charged against it?</SectionHeading>
      <div className="mb-2 space-y-2">
        <GChoice
          selected={encumbered === false}
          onClick={() => setEncumbered(false)}
          title="No, it’s free of any loan"
        />
        <GChoice
          selected={encumbered === true}
          onClick={() => setEncumbered(true)}
          title="Yes, there’s an existing loan on it"
          detail="That’s common. The bank works out what’s left over."
        />
      </div>
      {errors.enc ? (
        <p role="alert" className="mb-3 text-[12px] text-[var(--stop)]">
          {errors.enc}
        </p>
      ) : null}

      <ActionBar>
        <GButton block onClick={save}>
          Save and see what&rsquo;s needed
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

function SecBucket({ app, root }: { app: Application; root: string }) {
  const { bucketId } = useParams()
  const nav = useNavigate()
  return (
    <AppShell homeTo={root}>
      <BucketDetail
        app={app}
        bucketId={bucketId!}
        onCapture={(docId) => nav(`${root}/capture/${docId}`)}
        onBack={() => nav(`${root}/tasks`)}
      />
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CP-04a · Visit scheduling stub — a date preference, no calendar logic (§8)
// ---------------------------------------------------------------------------
function VisitScheduling({ app, root }: { app: Application; root: string }) {
  const nav = useNavigate()
  const { milestone } = useJourney({
    appId: app.appId,
    partyRole: 'collateral_provider',
    surface: 'collateral',
  })
  const [when, setWhen] = useState('')
  const [slot, setSlot] = useState<'morning' | 'afternoon'>('morning')

  return (
    <AppShell homeTo={root}>
      <BackLink to={`${root}/tasks`}>Your property papers</BackLink>
      <ScreenTitle
        title="When can they visit?"
        intro="A lawyer checks the title and a valuer inspects the property. Both usually come the same week, and it costs you nothing."
      />

      <GField label="A day that suits you" htmlFor="v-day">
        <GInput id="v-day" type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
      </GField>

      <SectionHeading>Morning or afternoon?</SectionHeading>
      <div className="mb-4 space-y-2">
        <GChoice selected={slot === 'morning'} onClick={() => setSlot('morning')} title="Morning" />
        <GChoice
          selected={slot === 'afternoon'}
          onClick={() => setSlot('afternoon')}
          title="Afternoon"
        />
      </div>

      <GCard tone="support">
        <p className="text-[14px] leading-[21px]">
          Someone will call to confirm. This is a preference, not a booking.
        </p>
      </GCard>

      <ActionBar>
        <GButton
          block
          disabled={!when}
          onClick={() => {
            milestone('VALUATION VISIT PREFERENCE', `${when}, ${slot} — passed to the panel lawyer and valuer`)
            nav(`${root}/tasks`)
          }}
        >
          Send my preference
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
