// ============================================================================
// CJ-02 · Verify — 6-digit code, resend ladder, lock state.
//
// Error copy says what happened and what to do (§3.5). "That code doesn't match.
// 3 tries left before we lock this number for 15 minutes." — never "Invalid
// OTP", never an apology from the system.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import { ActionBar, Callout, GButton, ScreenTitle } from '@/journeys/common/glib'
import { POLICY } from '@/data/policy'
import { useSessionStore } from '@/store/sessionStore'
import { personaSwitchEnabled } from '@/journeys/shell/PersonaSwitch'

export function Otp({ onVerified }: { onVerified?: (sessionId: string) => string | void }) {
  const nav = useNavigate()
  const loc = useLocation()
  const challengeId = (loc.state as { challengeId?: string } | null)?.challengeId

  const challenge = useSessionStore((s) => s.otp.find((c) => c.id === challengeId))
  const verifyOtp = useSessionStore((s) => s.verifyOtp)
  const resendOtp = useSessionStore((s) => s.resendOtp)

  const [digits, setDigits] = useState<string[]>(Array(POLICY.otpLength).fill(''))
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'stop' | 'ok' | 'info'>('info')
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  if (!challengeId || !challenge) {
    return (
      <AppShell>
        <ScreenTitle
          title="That code request has expired"
          intro="Codes are only valid for a few minutes. Start again and we'll send a new one."
        />
        <GButton block onClick={() => nav('/start')}>
          Start again
        </GButton>
      </AppShell>
    )
  }

  const c = challenge
  const locked = c.status === 'locked'
  const code = digits.join('')

  function setAt(i: number, v: string) {
    const only = v.replace(/\D/g, '')
    if (only.length > 1) {
      // Paste of the whole code.
      const next = only.slice(0, POLICY.otpLength).split('')
      setDigits(Array.from({ length: POLICY.otpLength }, (_, k) => next[k] ?? ''))
      inputs.current[Math.min(next.length, POLICY.otpLength - 1)]?.focus()
      return
    }
    const next = [...digits]
    next[i] = only
    setDigits(next)
    if (only && i < POLICY.otpLength - 1) inputs.current[i + 1]?.focus()
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < POLICY.otpLength - 1) inputs.current[i + 1]?.focus()
  }

  function submit() {
    const res = verifyOtp(c.id, code)
    if (!res.ok || !res.session) {
      setTone('stop')
      setMessage(res.message)
      setDigits(Array(POLICY.otpLength).fill(''))
      inputs.current[0]?.focus()
      return
    }
    const to = onVerified?.(res.session.id)
    nav(to || c.returnTo || '/apply', { replace: true })
  }

  function resend() {
    const res = resendOtp(c.id)
    setTone(res.ok ? 'ok' : 'stop')
    setMessage(res.message)
    if (res.ok) {
      setDigits(Array(POLICY.otpLength).fill(''))
      inputs.current[0]?.focus()
    }
  }

  const masked = c.sessionDraft.mobile.replace(/(\+91)(\d{2})\d{5}(\d{3})/, '$1 $2•••••$3')

  return (
    <AppShell>
      <BackLink to="/start">Change my number</BackLink>
      <ScreenTitle
        title="Enter the 6-digit code"
        intro={`We sent it to ${masked}. It's good for ${POLICY.otpValidityMinutes} minutes.`}
      />

      <fieldset disabled={locked} className="mb-4">
        <legend className="sr-only">One-time code</legend>
        <div className="flex gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${i + 1} of ${POLICY.otpLength}`}
              className="num h-[56px] w-full rounded-xl border border-[var(--grey-300)] bg-white text-center text-[22px] font-bold text-[var(--glib-grey)] disabled:bg-[var(--blue-grey)] disabled:text-[var(--grey-300)]"
            />
          ))}
        </div>
      </fieldset>

      {message ? (
        <div className="mb-4" role="status" aria-live="polite">
          <Callout tone={tone === 'stop' ? 'stop' : tone === 'ok' ? 'ok' : 'info'}>{message}</Callout>
        </div>
      ) : null}

      {locked ? (
        <Callout tone="stop" title="This number is locked for now">
          After {POLICY.otpMaxAttempts} wrong codes we lock the number for{' '}
          {POLICY.otpLockMinutes} minutes. You can come back then, or start again
          with a different number.
        </Callout>
      ) : (
        <button
          onClick={resend}
          className="min-h-[44px] text-[14px] font-semibold text-[var(--glib-blue)]"
        >
          Send me a new code
          {c.resendCount > 0 ? ` (${c.resendCount} of ${POLICY.otpMaxResends} used)` : ''}
        </button>
      )}

      {personaSwitchEnabled() ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--grey-300)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--grey-600)]">
            Prototype — no SMS is sent
          </p>
          <p className="num mt-1 text-[20px] font-bold tracking-[0.2em] text-[var(--glib-grey)]">
            {c.code}
          </p>
          <button
            onClick={() => setDigits(c.code.split(''))}
            className="mt-1 min-h-[44px] text-[13px] font-semibold text-[var(--glib-blue)]"
          >
            Fill this code
          </button>
        </div>
      ) : null}

      <ActionBar>
        <GButton block disabled={locked || code.length !== POLICY.otpLength} onClick={submit}>
          Verify and continue
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
