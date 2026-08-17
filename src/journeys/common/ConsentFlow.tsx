// ============================================================================
// Consent flows (§11) — three full mocks and four single-tap sheets.
//
// These are built out properly because they are what a clearance committee will
// interrogate. In particular the Account Aggregator screen shows the data range
// and validity as PLAIN TEXT the customer can read, not a legal blob — that is
// the screen a compliance reviewer will stare at.
//
// Shared by the customer journey, the co-applicant portal, the collateral
// portal and the handoff landing, so a consent granted through a handoff link
// is byte-identical to one granted in the customer's own session.
// ============================================================================
import { useState } from 'react'
import type { Application, ConsentType, PartyRole } from '@/types'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GCheckbox,
  GChoice,
  GField,
  GInput,
  ScreenTitle,
  SectionHeading,
} from '@/journeys/common/glib'
import { CONSENT_COPY } from '@/journeys/copy'
import { CONSENT_BY_TYPE } from '@/data/consents'
import { POLICY } from '@/data/policy'
import { fmtDate } from '@/lib/format'
import { nowIso } from '@/lib/clock'

export interface ConsentFlowProps {
  app: Application
  type: ConsentType
  partyRole: PartyRole
  /** Called on approval — the caller emits CONSENT_GRANTED. */
  onGrant: () => void
  /** Called on decline — the caller emits CONSENT_DECLINED. */
  onDecline: (reason: string) => void
  onCancel: () => void
}

export function ConsentFlow(props: ConsentFlowProps) {
  const copy = CONSENT_COPY[props.type]
  if (props.type === 'uidai_ekyc') return <AadhaarFlow {...props} />
  if (props.type === 'digilocker') return <DigiLockerFlow {...props} />
  if (props.type === 'account_aggregator') return <AccountAggregatorFlow {...props} />
  return <SingleTapSheet {...props} copy={copy} />
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function Purpose({
  type,
  app,
  partyRole,
}: {
  type: ConsentType
  app: Application
  partyRole: PartyRole
}) {
  const copy = CONSENT_COPY[type]
  const def = CONSENT_BY_TYPE[type]
  const docs = app.documents.filter((d) => d.consentType === type && d.status === 'requested')
  return (
    <>
      <ScreenTitle title={copy.title} intro={copy.why} />
      <GCard tone="info" className="mb-4">
        <p className="text-[14px] leading-[21px]">
          {docs.length > 0
            ? `Approving this brings in ${docs.length} document${docs.length === 1 ? '' : 's'} we'd otherwise ask you to find and scan.`
            : copy.unlocks}
        </p>
      </GCard>

      <SectionHeading>What you’re sharing</SectionHeading>
      <ul className="mb-4 space-y-2">
        {copy.shares.map((s) => (
          <li key={s} className="flex gap-2.5 text-[14px] leading-[21px]">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--glib-blue)]" />
            <span>{s}</span>
          </li>
        ))}
      </ul>

      <GCard tone="support">
        <p className="text-[13px] leading-5 text-[var(--grey-600)]">
          Given by <span className="font-semibold text-[var(--glib-grey)]">{roleWord(partyRole)}</span>.
          Valid for {def.validityDays} {def.validityDays === 1 ? 'day' : 'days'}, and you can
          withdraw it at any time from your sharing screen.
        </p>
      </GCard>
    </>
  )
}

function roleWord(r: PartyRole): string {
  return r === 'applicant' ? 'you, the student' : r === 'co_applicant' ? 'you, the co-applicant' : 'you, the security owner'
}

function DeclineBar({ onDecline, onCancel }: { onDecline: (r: string) => void; onCancel: () => void }) {
  return (
    <>
      <GButton
        block
        tone="quiet"
        onClick={() => onDecline('Customer preferred to upload the documents themselves')}
      >
        No thanks — I’ll upload these myself
      </GButton>
      <GButton block tone="quiet" onClick={onCancel}>
        Go back
      </GButton>
    </>
  )
}

/** §11.4 — declining never blocks the file. */
function DeclineNote() {
  return (
    <p className="mt-3 text-[12px] leading-4 text-[var(--grey-600)]">
      If you&rsquo;d rather not, that&rsquo;s fine. The documents just come back
      as uploads instead, and your application carries on either way.
    </p>
  )
}

// ---------------------------------------------------------------------------
// A · Aadhaar eKYC (UIDAI) — full mock (§11.1)
// ---------------------------------------------------------------------------
function AadhaarFlow({ app, type, partyRole, onGrant, onDecline, onCancel }: ConsentFlowProps) {
  const [step, setStep] = useState<'purpose' | 'number' | 'otp' | 'done'>('purpose')
  const [aadhaar, setAadhaar] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)

  const party = app.parties.find((p) => p.role === partyRole)
  const name = party?.name ?? app.studentName

  if (step === 'purpose') {
    return (
      <>
        <Purpose type={type} app={app} partyRole={partyRole} />
        <DeclineNote />
        <ActionBar>
          <GButton block onClick={() => setStep('number')}>
            Verify with Aadhaar
          </GButton>
          <DeclineBar onDecline={onDecline} onCancel={onCancel} />
        </ActionBar>
      </>
    )
  }

  if (step === 'number') {
    return (
      <>
        <ScreenTitle
          title="Your Aadhaar or VID"
          intro="UIDAI will send a code to the mobile number linked with it — not necessarily the number you signed in with."
        />
        <GField
          label="Aadhaar or Virtual ID"
          hint="12 digits for Aadhaar, 16 for a VID."
          error={error ?? undefined}
          htmlFor="aa-num"
        >
          <GInput
            id="aa-num"
            inputMode="numeric"
            maxLength={16}
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
            className="num tracking-[0.15em]"
            placeholder="•••• •••• ••••"
          />
        </GField>
        <Callout tone="support">
          The bank stores a masked number only. The full number is never shown to
          anyone at Horizon Bank or at Glib.money.
        </Callout>
        <ActionBar>
          <GButton
            block
            onClick={() => {
              if (aadhaar.length !== 12 && aadhaar.length !== 16) {
                setError('An Aadhaar number is 12 digits; a Virtual ID is 16.')
                return
              }
              setError(null)
              setStep('otp')
            }}
          >
            Send me the code
          </GButton>
          <GButton block tone="quiet" onClick={() => setStep('purpose')}>
            Go back
          </GButton>
        </ActionBar>
      </>
    )
  }

  if (step === 'otp') {
    return (
      <>
        <ScreenTitle
          title="Enter the UIDAI code"
          intro="Sent to the mobile number registered with your Aadhaar."
        />
        <GField label="6-digit code" error={error ?? undefined} htmlFor="aa-otp">
          <GInput
            id="aa-otp"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="num text-center text-[22px] tracking-[0.4em]"
          />
        </GField>
        <p className="text-[12px] leading-4 text-[var(--grey-600)]">
          Prototype — any 6 digits will do. No message is actually sent.
        </p>
        <ActionBar>
          <GButton
            block
            disabled={otp.length !== 6}
            onClick={() => {
              setError(null)
              setStep('done')
            }}
          >
            Verify
          </GButton>
          <GButton block tone="quiet" onClick={() => setStep('number')}>
            Use a different number
          </GButton>
        </ActionBar>
      </>
    )
  }

  const masked = `•••• •••• ${aadhaar.slice(-4)}`
  return (
    <>
      <ScreenTitle title="Verified with Aadhaar" intro="This is what UIDAI sent back." />
      <GCard tone="ok" className="mb-4">
        <dl className="space-y-2 text-[14px] leading-[21px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--grey-600)]">Name</dt>
            <dd className="font-semibold">{name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--grey-600)]">Aadhaar</dt>
            <dd className="num font-semibold">{masked}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--grey-600)]">Address</dt>
            <dd className="max-w-[60%] text-right font-semibold">As held by UIDAI</dd>
          </div>
        </dl>
      </GCard>
      <ActionBar>
        <GButton block onClick={onGrant}>
          Looks right — continue
        </GButton>
      </ActionBar>
    </>
  )
}

// ---------------------------------------------------------------------------
// B · DigiLocker — full mock (§11.1)
// ---------------------------------------------------------------------------
function DigiLockerFlow({ app, type, partyRole, onGrant, onDecline, onCancel }: ConsentFlowProps) {
  const [step, setStep] = useState<'purpose' | 'leaving' | 'digilocker' | 'done'>('purpose')

  // The specific documents requested — named, not "your documents".
  const requested = app.documents.filter(
    (d) => d.consentType === 'digilocker' && d.status === 'requested',
  )
  const [picked, setPicked] = useState<string[]>(requested.map((d) => d.id))

  if (step === 'purpose') {
    return (
      <>
        <Purpose type={type} app={app} partyRole={partyRole} />
        <DeclineNote />
        <ActionBar>
          <GButton block onClick={() => setStep('leaving')}>
            Connect DigiLocker
          </GButton>
          <DeclineBar onDecline={onDecline} onCancel={onCancel} />
        </ActionBar>
      </>
    )
  }

  if (step === 'leaving') {
    return (
      <>
        <ScreenTitle
          title="You’re going to DigiLocker"
          intro="You’ll sign in there, choose what to share, and come straight back. Glib.money never sees your DigiLocker password."
        />
        <GCard tone="support" className="mb-4">
          <p className="text-[14px] leading-[21px]">
            DigiLocker is run by the Government of India. Documents that come
            back through it are digitally signed by whoever issued them, so
            nobody has to attest them afterwards.
          </p>
        </GCard>
        <ActionBar>
          <GButton block onClick={() => setStep('digilocker')}>
            Go to DigiLocker
          </GButton>
          <GButton block tone="quiet" onClick={() => setStep('purpose')}>
            Go back
          </GButton>
        </ActionBar>
      </>
    )
  }

  if (step === 'digilocker') {
    return (
      <>
        {/* A visibly different chrome, because the customer has "left". */}
        <div className="mb-4 rounded-xl bg-[var(--glib-grey)] px-4 py-3 text-white">
          <p className="text-[12px] uppercase tracking-wide opacity-70">Prototype of</p>
          <p className="display text-[17px] font-bold">DigiLocker</p>
        </div>
        <ScreenTitle
          title="Horizon Bank is asking for these documents"
          intro="Untick anything you’d rather not share. You can come back and share it later."
        />
        {requested.length === 0 ? (
          <Callout tone="support">
            Nothing is outstanding that DigiLocker can supply right now.
          </Callout>
        ) : (
          <ul className="mb-4">
            {requested.map((d) => (
              <li key={d.id} className="border-b border-[var(--blue-grey)] last:border-b-0">
                <GCheckbox
                  id={`dl-${d.id}`}
                  checked={picked.includes(d.id)}
                  onChange={(v) =>
                    setPicked(v ? [...picked, d.id] : picked.filter((x) => x !== d.id))
                  }
                >
                  <span className="block font-semibold">{d.label}</span>
                  <span className="block text-[12px] text-[var(--grey-600)]">
                    Issued by {issuerFor(d.label)}
                  </span>
                </GCheckbox>
              </li>
            ))}
          </ul>
        )}
        <ActionBar>
          <GButton block onClick={() => setStep('done')}>
            Share {picked.length > 0 ? `${picked.length} document${picked.length === 1 ? '' : 's'}` : 'nothing'}
          </GButton>
          <GButton
            block
            tone="quiet"
            onClick={() => onDecline('Customer declined at the DigiLocker consent screen')}
          >
            Cancel and go back
          </GButton>
        </ActionBar>
      </>
    )
  }

  return (
    <>
      <ScreenTitle
        title="DigiLocker connected"
        intro={`${picked.length} document${picked.length === 1 ? '' : 's'} came back, signed by the issuer.`}
      />
      <ul className="mb-4 space-y-2">
        {requested
          .filter((d) => picked.includes(d.id))
          .map((d) => (
            <li key={d.id}>
              <GCard tone="ok">
                <p className="text-[14px] font-semibold leading-[21px]">{d.label}</p>
                <p className="text-[12px] text-[var(--grey-600)]">Received</p>
              </GCard>
            </li>
          ))}
      </ul>
      <p className="mb-2 text-[12px] leading-4 text-[var(--grey-600)]">
        Received isn&rsquo;t the same as checked — the bank still reads through
        each one. We&rsquo;ll tell you if anything needs a second look.
      </p>
      <ActionBar>
        <GButton block onClick={onGrant}>
          Continue
        </GButton>
      </ActionBar>
    </>
  )
}

function issuerFor(label: string): string {
  if (/marksheet|degree|transcript|migration|Class/i.test(label)) return 'your university or board'
  if (/Aadhaar/i.test(label)) return 'UIDAI'
  if (/Voter|DL|OVD/i.test(label)) return 'the issuing authority'
  if (/Address/i.test(label)) return 'the issuing authority'
  if (/Relationship|birth/i.test(label)) return 'the registrar of births'
  return 'the issuing body'
}

// ---------------------------------------------------------------------------
// C · Account Aggregator — full mock (§11.1)
//
// The compliance screen. Purpose, data range, frequency and validity are all
// stated in words the customer can read.
// ---------------------------------------------------------------------------

interface MockAccount {
  id: string
  bank: string
  type: string
  masked: string
}

const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 'aa-1', bank: 'State Bank of India', type: 'Savings', masked: '••••4471' },
  { id: 'aa-2', bank: 'HDFC Bank', type: 'Salary', masked: '••••8820' },
  { id: 'aa-3', bank: 'Kotak Mahindra Bank', type: 'Current', masked: '••••1039' },
]

function AccountAggregatorFlow({
  app,
  type,
  partyRole,
  onGrant,
  onDecline,
  onCancel,
}: ConsentFlowProps) {
  const [step, setStep] = useState<'purpose' | 'handle' | 'discovery' | 'terms' | 'done'>('purpose')
  const [handle, setHandle] = useState('')
  const [picked, setPicked] = useState<string[]>(['aa-1', 'aa-2'])
  const def = CONSENT_BY_TYPE.account_aggregator
  const cleared = app.documents.filter(
    (d) => d.consentType === 'account_aggregator' && d.status === 'requested',
  ).length

  if (step === 'purpose') {
    return (
      <>
        <Purpose type={type} app={app} partyRole={partyRole} />
        <DeclineNote />
        <ActionBar>
          <GButton block onClick={() => setStep('handle')}>
            Share my statements
          </GButton>
          <DeclineBar onDecline={onDecline} onCancel={onCancel} />
        </ActionBar>
      </>
    )
  }

  if (step === 'handle') {
    return (
      <>
        <ScreenTitle
          title="Your Account Aggregator handle"
          intro="This is the RBI-licensed service that passes your statements along. If you’ve never used one, your mobile number creates it."
        />
        <GField label="AA handle" hint="Usually your mobile number followed by @onemoney or @finvu." htmlFor="aa-h">
          <GInput
            id="aa-h"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="9876543210@onemoney"
          />
        </GField>
        <Callout tone="support">
          The aggregator can move data, never money. It cannot see your balance
          unless you approve this, and it can never make a payment.
        </Callout>
        <ActionBar>
          <GButton block disabled={handle.trim().length < 5} onClick={() => setStep('discovery')}>
            Find my accounts
          </GButton>
          <GButton block tone="quiet" onClick={() => setStep('purpose')}>
            Go back
          </GButton>
        </ActionBar>
      </>
    )
  }

  if (step === 'discovery') {
    return (
      <>
        <ScreenTitle
          title="We found these accounts"
          intro="Choose the ones that show your income. You don’t have to share all of them."
        />
        <ul className="mb-4 space-y-2">
          {MOCK_ACCOUNTS.map((a) => (
            <li key={a.id}>
              <GChoice
                selected={picked.includes(a.id)}
                onClick={() =>
                  setPicked(
                    picked.includes(a.id) ? picked.filter((x) => x !== a.id) : [...picked, a.id],
                  )
                }
                title={`${a.bank} · ${a.type}`}
                detail={`Account ending ${a.masked}`}
              />
            </li>
          ))}
        </ul>
        <ActionBar>
          <GButton block disabled={picked.length === 0} onClick={() => setStep('terms')}>
            Continue with {picked.length} account{picked.length === 1 ? '' : 's'}
          </GButton>
          <GButton
            block
            tone="quiet"
            onClick={() => onDecline('Customer declined at account discovery')}
          >
            Cancel
          </GButton>
        </ActionBar>
      </>
    )
  }

  if (step === 'terms') {
    const from = new Date(nowIso())
    from.setUTCMonth(from.getUTCMonth() - 12)
    const until = new Date(nowIso())
    until.setUTCDate(until.getUTCDate() + def.validityDays)
    return (
      <>
        <ScreenTitle
          title="Exactly what you’re approving"
          intro="Read this before you approve. Every line is a limit on what can be pulled."
        />
        <GCard className="mb-4">
          <ConsentTerm label="Who is asking" value="Horizon Bank, through Glib.money" />
          <ConsentTerm
            label="Why"
            value="To assess this education loan application, and nothing else"
          />
          <ConsentTerm
            label="What"
            value={`Transaction history and balances for ${picked.length} account${picked.length === 1 ? '' : 's'}`}
          />
          <ConsentTerm
            label="For which period"
            value={`${fmtDate(from.toISOString())} to today — the last 12 months`}
          />
          <ConsentTerm label="How often" value="Once now, then monthly while your application is open" />
          <ConsentTerm
            label="Until when"
            value={`${fmtDate(until.toISOString())} — ${def.validityDays} days from today`}
          />
          <ConsentTerm label="Can they move money?" value="No. This is read-only." />
        </GCard>
        <Callout tone="support">
          You can withdraw this at any time from your sharing screen. Statements
          already pulled stay on the file, but nothing new comes through after
          that.
        </Callout>
        <ActionBar>
          <GButton block onClick={() => setStep('done')}>
            Approve
          </GButton>
          <GButton
            block
            tone="quiet"
            onClick={() => onDecline('Customer declined at the consent terms screen')}
          >
            Don’t approve
          </GButton>
        </ActionBar>
      </>
    )
  }

  return (
    <>
      <ScreenTitle
        title="Statements on their way"
        intro={
          cleared > 0
            ? `That one approval covers ${cleared} document${cleared === 1 ? '' : 's'} we'd otherwise have asked you to find.`
            : 'Your statements will arrive shortly.'
        }
      />
      <GCard tone="ok" className="mb-4">
        <p className="text-[14px] leading-[21px]">
          {picked.length} account{picked.length === 1 ? '' : 's'} connected. You can see and
          withdraw this permission at any time from your sharing screen.
        </p>
      </GCard>
      <ActionBar>
        <GButton block onClick={onGrant}>
          Continue
        </GButton>
      </ActionBar>
    </>
  )
}

function ConsentTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--blue-grey)] py-2.5 last:border-b-0">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--grey-600)]">
        {label}
      </p>
      <p className="mt-0.5 text-[14px] leading-[21px] text-[var(--glib-grey)]">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single-tap sheets — CKYC, TRACES, GSTN, bureau (§11.2)
// ---------------------------------------------------------------------------
function SingleTapSheet({
  app,
  type,
  partyRole,
  onGrant,
  onDecline,
  onCancel,
  copy,
}: ConsentFlowProps & { copy: (typeof CONSENT_COPY)[ConsentType] }) {
  const def = CONSENT_BY_TYPE[type]
  const cleared = app.documents.filter((d) => d.consentType === type && d.status === 'requested').length
  const until = new Date(nowIso())
  until.setUTCDate(until.getUTCDate() + def.validityDays)

  return (
    <>
      <ScreenTitle title={copy.title} intro={copy.why} />
      <GCard className="mb-4">
        <ConsentTerm label="Who is asking" value="Horizon Bank, through Glib.money" />
        <ConsentTerm label="What they’ll fetch" value={copy.shares[0]} />
        <ConsentTerm label="What it’s used for" value="Assessing this education loan application" />
        <ConsentTerm
          label="Valid until"
          value={`${fmtDate(until.toISOString())} — ${def.validityDays} days`}
        />
      </GCard>
      {copy.shares.slice(1).map((s) => (
        <p key={s} className="mb-2 text-[13px] leading-5 text-[var(--grey-600)]">
          {s}
        </p>
      ))}
      {cleared > 0 ? (
        <Callout tone="info">
          One tap clears {cleared} document{cleared === 1 ? '' : 's'} from your list.
        </Callout>
      ) : null}
      <p className="mt-3 text-[12px] leading-4 text-[var(--grey-600)]">
        Given by {roleWord(partyRole)}.
      </p>
      <DeclineNote />
      <ActionBar>
        <GButton block onClick={onGrant}>
          Yes, go ahead
        </GButton>
        <DeclineBar onDecline={onDecline} onCancel={onCancel} />
      </ActionBar>
    </>
  )
}
