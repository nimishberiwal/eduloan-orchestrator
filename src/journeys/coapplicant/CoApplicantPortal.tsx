// ============================================================================
// CO-01…CO-08 — the co-applicant portal.
//
// The parent is the CREDIT SPINE and grants four of the seven consents. They
// therefore need their OWN authenticated session, not a form section inside the
// student's application (§1). Everything they see is filtered on
// `forParty: 'co_applicant'` inside the projection, not in these components —
// which is what makes acceptance item 7 provable rather than asserted.
// ============================================================================
import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { Application } from '@/types'
import { useStore } from '@/store/appStore'
import { useSessionStore, isInviteExpired } from '@/store/sessionStore'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  GField,
  GInput,
  GNumber,
  GSelect,
  ScreenTitle,
  SectionHeading,
  inrFull,
} from '@/journeys/common/glib'
import { Identify } from '@/journeys/auth/Identify'
import { Otp } from '@/journeys/auth/Otp'
import { Tasks, SharingHub, VerifyIdentity } from '@/journeys/customer/Tasks'
import { BucketDetail } from '@/journeys/common/DocFlows'
import { CaptureHost, ConsentHost } from '@/journeys/customer/CustomerJourney'
import { useJourney } from '@/journeys/useJourney'
import { blockingCount } from '@/lib/customerTasks'
import { POLICY } from '@/data/policy'
import { customerFacingStatus } from '@/data/customerMirror'

export function CoApplicantPortal() {
  const { token } = useParams()
  const invites = useSessionStore((s) => s.invites)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const apps = useStore((s) => s.applications)

  const invite = invites.find((i) => i.token === token && i.kind === 'co_applicant')
  const app = apps.find((a) => a.appId === invite?.appId)
  const session = sessions.find((s) => s.id === activeIds.co_applicant)
  const root = `/co/${token}`

  if (!invite || !app) {
    return (
      <AppShell>
        <ScreenTitle
          title="This link isn’t valid"
          intro="It may have been mistyped, or replaced by a newer one. Ask whoever sent it for a fresh link."
        />
      </AppShell>
    )
  }

  if (isInviteExpired(invite)) {
    return (
      <AppShell>
        <ScreenTitle
          title="This link has expired"
          intro={`Invitations are good for ${POLICY.coApplicantInviteDays} days. Ask ${app.studentName.split(' ')[0]} to send you a new one — it takes them a few seconds.`}
        />
      </AppShell>
    )
  }

  const verified = Boolean(session)

  return (
    <Routes>
      <Route index element={<InviteLanding app={app} inviteName={invite.name} root={root} verified={verified} />} />
      <Route
        path="verify"
        element={
          <Identify
            partyRole="co_applicant"
            fixedName={invite.name}
            returnTo={`${root}/profile`}
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
          <Route path="profile" element={<CoProfile app={app} invite={invite} root={root} />} />
          <Route path="kyc" element={<VerifyIdentity app={app} forParty="co_applicant" root={root} />} />
          <Route path="consents" element={<SharingHub app={app} forParty="co_applicant" root={root} />} />
          <Route
            path="consent/:type"
            element={<ConsentHost app={app} root={root} partyRole="co_applicant" surface="co_applicant" />}
          />
          <Route
            path="tasks"
            element={
              <Tasks
                app={app}
                forParty="co_applicant"
                root={root}
                title="What we need from you"
              />
            }
          />
          <Route path="bucket/:bucketId" element={<CoBucket app={app} root={root} />} />
          <Route
            path="capture/:docId"
            element={<CaptureHost app={app} root={root} partyRole="co_applicant" surface="co_applicant" />}
          />
          <Route path="obligations" element={<Obligations app={app} root={root} />} />
          <Route path="status" element={<CoStatus app={app} root={root} />} />
          <Route path="*" element={<Navigate to={`${root}/tasks`} replace />} />
        </>
      )}
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// CO-01 · Invite landing
// ---------------------------------------------------------------------------
function InviteLanding({
  app,
  inviteName,
  root,
  verified,
}: {
  app: Application
  inviteName: string
  root: string
  verified: boolean
}) {
  const nav = useNavigate()
  const first = app.studentName.split(' ')[0]

  return (
    <AppShell homeTo={root}>
      <ScreenTitle
        eyebrow="Education loan · Horizon Bank"
        title={`${first} has asked you to co-sign`}
        intro={`They're applying for ${inrFull(app.askInr)} to study ${app.program} at ${app.university}. As co-applicant, your income is what the bank assesses.`}
      />

      <SectionHeading>What you&rsquo;ll be asked for</SectionHeading>
      <ul className="mb-5 space-y-2.5">
        {[
          ['Who you are', 'A quick Aadhaar check, or your existing KYC record.'],
          ['What you earn', 'Payslips or returns — most of which we can fetch for you.'],
          ['Permission to look', 'Your bank statements, tax records and credit report.'],
        ].map(([t, d]) => (
          <li key={t} className="flex gap-3">
            <span
              aria-hidden
              className="mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--glib-blue)]"
            />
            <span>
              <span className="display block text-[15px] font-semibold leading-[21px]">{t}</span>
              <span className="block text-[14px] leading-[21px] text-[var(--grey-600)]">{d}</span>
            </span>
          </li>
        ))}
      </ul>

      <Callout tone="support" title="What you’re agreeing to">
        Co-signing means you are jointly responsible for repaying this loan. If{' '}
        {first} cannot pay, the bank will come to you. Take that seriously — it
        is the whole point of the role.
      </Callout>

      <div className="mt-4">
        <Callout tone="info" title="Your side stays yours">
          {first} will not see your income, your documents, your credit report or
          anything you approve here. Their tracker only says how far along you
          are.
        </Callout>
      </div>

      <ActionBar>
        <GButton block onClick={() => nav(verified ? `${root}/tasks` : `${root}/verify`)}>
          {verified ? `Continue as ${inviteName}` : 'Confirm it’s me'}
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CO-03 · Your details
// ---------------------------------------------------------------------------
function CoProfile({
  app,
  invite,
  root,
}: {
  app: Application
  invite: { name: string; relationship: string }
  root: string
}) {
  const nav = useNavigate()
  const { emit } = useJourney({
    appId: app.appId,
    partyRole: 'co_applicant',
    surface: 'co_applicant',
  })
  const markInviteJoined = useSessionStore((s) => s.markInviteJoined)
  const { token } = useParams()

  const [name, setName] = useState(invite.name)
  const [relationship, setRelationship] = useState(invite.relationship)
  const [pan, setPan] = useState('')
  const [employer, setEmployer] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function next() {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Your name as it appears on your PAN.'
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase()))
      e.pan = 'A PAN looks like ABCDE1234F — five letters, four digits, one letter.'
    setErrors(e)
    if (Object.keys(e).length) return

    const partyId = `${app.appId}-C`
    // §7.5 — this is what makes the P1–P6 buckets and the four co-applicant
    // consents actionable.
    emit(
      'COAPPLICANT_JOINED',
      { name: name.trim(), relationship, partyId },
      `${app.appId}:coapp-join`,
    )
    if (token) markInviteJoined(token, partyId)
    nav(`${root}/tasks`)
  }

  return (
    <AppShell homeTo={root}>
      <BackLink to={root}>What this is about</BackLink>
      <ScreenTitle
        title="About you"
        intro="Enter these exactly as they appear on your documents."
      />

      <GField label="Your full name" error={errors.name} htmlFor="c-name">
        <GInput id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
      </GField>

      <GField label="Your relationship to the student" htmlFor="c-rel">
        <GSelect id="c-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
          {['Father', 'Mother', 'Guardian', 'Spouse', 'Sibling'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </GSelect>
      </GField>

      <GField label="Your PAN" error={errors.pan} htmlFor="c-pan">
        <GInput
          id="c-pan"
          maxLength={10}
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          className="num uppercase"
          placeholder="ABCDE1234F"
        />
      </GField>

      <GField
        label={app.incomeBranch === 'salaried' ? 'Where you work' : 'Your business name'}
        htmlFor="c-emp"
      >
        <GInput id="c-emp" value={employer} onChange={(e) => setEmployer(e.target.value)} />
      </GField>

      <ActionBar>
        <GButton block onClick={next}>
          Next — what we need from you
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

function CoBucket({ app, root }: { app: Application; root: string }) {
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
// CO-07 · Declare existing loans & EMIs
// ---------------------------------------------------------------------------
function Obligations({ app, root }: { app: Application; root: string }) {
  const nav = useNavigate()
  const { milestone } = useJourney({
    appId: app.appId,
    partyRole: 'co_applicant',
    surface: 'co_applicant',
  })
  const [rows, setRows] = useState<{ kind: string; emi: number }[]>([
    { kind: 'Home loan', emi: 0 },
  ])

  function save() {
    const live = rows.filter((r) => r.emi > 0)
    milestone(
      'OBLIGATIONS DECLARED',
      live.length === 0
        ? 'Co-applicant declared no existing loan obligations'
        : live.map((r) => `${r.kind} ${inrFull(r.emi)}/month`).join(', '),
    )
    nav(`${root}/tasks`)
  }

  return (
    <AppShell homeTo={root}>
      <BackLink to={`${root}/tasks`}>What we need from you</BackLink>
      <ScreenTitle
        title="What you already repay"
        intro="Anything with a monthly instalment. We check this against your credit report anyway — declaring it up front avoids questions later."
      />

      {rows.map((r, i) => (
        <GCard key={i} className="mb-3">
          <GField label="What kind of loan" htmlFor={`ob-k-${i}`}>
            <GSelect
              id={`ob-k-${i}`}
              value={r.kind}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...r, kind: e.target.value }
                setRows(next)
              }}
            >
              {['Home loan', 'Car loan', 'Personal loan', 'Credit card', 'Education loan', 'Other'].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </GSelect>
          </GField>
          <GField label="Monthly instalment" htmlFor={`ob-e-${i}`}>
            <GNumber
              id={`ob-e-${i}`}
              prefix="₹"
              value={r.emi}
              onValue={(n) => {
                const next = [...rows]
                next[i] = { ...r, emi: n }
                setRows(next)
              }}
            />
          </GField>
        </GCard>
      ))}

      <GButton
        tone="secondary"
        block
        onClick={() => setRows([...rows, { kind: 'Personal loan', emi: 0 }])}
      >
        Add another
      </GButton>

      <ActionBar>
        <GButton block onClick={save}>
          Save
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CO-08 · What happens next — deliberately thinner than the student's tracker
// ---------------------------------------------------------------------------
function CoStatus({ app, root }: { app: Application; root: string }) {
  const nav = useNavigate()
  const mine = blockingCount(app, 'co_applicant')
  return (
    <AppShell homeTo={root}>
      <ScreenTitle title="Where things stand" />
      <GCard tone={mine > 0 ? 'warn' : 'info'} className="mb-4">
        <p className="display text-[17px] font-semibold leading-6">
          {mine > 0
            ? `${mine} thing${mine === 1 ? '' : 's'} still need${mine === 1 ? 's' : ''} you`
            : 'Nothing needs you right now'}
        </p>
        <p className="mt-2 text-[14px] leading-[21px]">{customerFacingStatus(app)}</p>
        <div className="mt-3">
          <GChip tone={mine > 0 ? 'warn' : 'ok'}>
            {mine > 0 ? 'Waiting on you' : 'With the bank'}
          </GChip>
        </div>
      </GCard>
      <Callout tone="support">
        You&rsquo;ll get a message if anything else is needed. The full progress
        of the application sits with {app.studentName.split(' ')[0]}.
      </Callout>
      <ActionBar>
        <GButton block tone="secondary" onClick={() => nav(`${root}/tasks`)}>
          Back to my list
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
