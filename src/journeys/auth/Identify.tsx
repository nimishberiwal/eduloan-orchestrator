// ============================================================================
// CJ-01 · Identify — mobile + email + consent to contact.
//
// Shared by all four party types: the student starts here, and the parent and
// security owner reach the same component from inside their invite so they get
// their OWN session rather than a slot in the student's (§7.4).
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PartyRole } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCheckbox,
  GField,
  GInput,
  ScreenTitle,
} from '@/journeys/common/glib'
import { useSessionStore } from '@/store/sessionStore'

const ROLE_COPY: Record<
  PartyRole | 'rm',
  { title: string; intro: string; cta: string }
> = {
  applicant: {
    title: 'Let’s start with how to reach you',
    intro:
      'We’ll send a 6-digit code to check it’s you. Nothing is submitted to the bank yet.',
    cta: 'Send me a code',
  },
  co_applicant: {
    title: 'Confirm it’s you',
    intro:
      'We’ll send a 6-digit code to your mobile. Your details stay yours — your child never sees them.',
    cta: 'Send me a code',
  },
  collateral_provider: {
    title: 'Confirm it’s you',
    intro: 'We’ll send a 6-digit code to your mobile before you share property details.',
    cta: 'Send me a code',
  },
  rm: {
    title: 'Sign in to the assisted journey',
    intro: 'Officer sign-in uses the same one-time code as customers.',
    cta: 'Send me a code',
  },
}

export function Identify({
  partyRole = 'applicant',
  returnTo,
  backTo = '/',
  backLabel = 'Back',
  fixedName,
  officerId,
}: {
  partyRole?: PartyRole | 'rm'
  returnTo?: string
  backTo?: string
  backLabel?: string
  fixedName?: string
  officerId?: string
}) {
  const nav = useNavigate()
  const issueOtp = useSessionStore((s) => s.issueOtp)

  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState(fixedName ?? '')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const copy = ROLE_COPY[partyRole]

  function submit() {
    const e: Record<string, string> = {}
    const digits = mobile.replace(/\D/g, '')
    if (digits.length !== 10) e.mobile = 'Enter your 10-digit Indian mobile number.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) e.email = 'Enter an email address we can reach you at.'
    if (!fixedName && name.trim().length < 2) e.name = 'Enter your name as it appears on your PAN.'
    if (!agreed) e.agreed = 'We need your permission to message you about this application.'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const challenge = issueOtp({
      mobile: `+91${digits}`,
      email: email.trim(),
      partyRole,
      displayName: name.trim() || undefined,
      officerId,
      returnTo,
    })
    nav('/otp', { state: { challengeId: challenge.id } })
  }

  return (
    <AppShell>
      <BackLink to={backTo}>{backLabel}</BackLink>
      <ScreenTitle title={copy.title} intro={copy.intro} />

      <GField label="Your name" error={errors.name} htmlFor="f-name">
        <GInput
          id="f-name"
          autoComplete="name"
          value={name}
          disabled={Boolean(fixedName)}
          onChange={(e) => setName(e.target.value)}
          placeholder="As printed on your PAN"
        />
      </GField>

      <GField
        label="Mobile number"
        hint="Indian mobile only. This becomes your sign-in."
        error={errors.mobile}
        htmlFor="f-mobile"
      >
        <div className="flex items-stretch gap-2">
          <span className="num flex min-h-[48px] items-center rounded-xl border border-[var(--grey-300)] bg-[var(--blue-grey)] px-3 text-[15px] text-[var(--grey-600)]">
            +91
          </span>
          <GInput
            id="f-mobile"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={11}
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
            placeholder="98765 43210"
            className="num"
          />
        </div>
      </GField>

      <GField label="Email address" error={errors.email} htmlFor="f-email">
        <GInput
          id="f-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </GField>

      <div className={errors.agreed ? 'rounded-xl bg-[#fdf3f2] px-3' : ''}>
        <GCheckbox id="f-agree" checked={agreed} onChange={setAgreed}>
          Glib.money and Horizon Bank may contact me by SMS, email and WhatsApp
          about this application.
        </GCheckbox>
        {errors.agreed ? (
          <p role="alert" className="pb-2 text-[12px] text-[var(--stop)]">
            {errors.agreed}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Callout tone="support">
          Your number is used to verify you and to send updates on this
          application. It is not used for marketing anything else.
        </Callout>
      </div>

      <ActionBar>
        <GButton block onClick={submit}>
          {copy.cta}
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
