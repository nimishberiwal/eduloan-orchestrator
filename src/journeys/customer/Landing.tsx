// ============================================================================
// CJ-00 · Landing — the front door.
//
// Copy voice (§3.5): plain, active, specific. Buttons name the OUTCOME, and an
// action keeps its name through the flow — "Check what I could borrow" is the
// same phrase the eligibility screens repeat.
// ============================================================================
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/journeys/shell/AppShell'
import { GButton, GCard, inrShort } from '@/journeys/common/glib'
import { POLICY } from '@/data/policy'
import { useSessionStore } from '@/store/sessionStore'

export function Landing() {
  const nav = useNavigate()
  const sessions = useSessionStore((s) => s.sessions)
  const active = useSessionStore((s) => s.activeSessionId)
  const hasSession = Boolean(active.applicant)
  const me = sessions.find((s) => s.id === active.applicant)

  return (
    <AppShell>
      <section className="pb-2">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--glib-blue)]">
          Education loan · Postgraduate · USA
        </p>
        <h1 className="display text-[28px] font-bold leading-[32px] text-[var(--glib-grey)]">
          Fund your master&rsquo;s in the US, without the paperwork spiral.
        </h1>
        <p className="mt-3 text-[15px] leading-[22px] text-[var(--grey-600)]">
          Tell us where you&rsquo;re going and what it costs. We&rsquo;ll show you
          what you could borrow in about two minutes, then collect most of your
          documents ourselves.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <GButton block onClick={() => nav('/start')}>
            Check what I could borrow
          </GButton>
          <GButton block tone="secondary" onClick={() => nav(hasSession ? '/apply' : '/start')}>
            {hasSession ? `Continue as ${me?.displayName ?? me?.mobile}` : 'Resume an application'}
          </GButton>
        </div>
      </section>

      <section className="mt-8">
        <GCard tone="support">
          <p className="display mb-3 text-[15px] font-semibold">How it works</p>
          <ol className="space-y-3 text-[14px] leading-[21px]">
            {[
              ['Tell us your plan', 'University, programme, intake and what it costs.'],
              ['See an indicative offer', `Up to ${inrShort(POLICY.maxTicketInr)}, secured or not, in plain numbers.`],
              ['We collect what we can', 'With your permission we pull most documents digitally. You upload the rest.'],
              ['Your parent joins', 'They get their own secure link. Their income is what carries the loan.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span
                  aria-hidden
                  className="num mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[var(--glib-blue)]"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="display block font-semibold">{t}</span>
                  <span className="block text-[var(--grey-600)]">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </GCard>
      </section>

      <section className="mt-6 border-t border-[var(--blue-grey)] pt-4">
        <p className="text-[12px] leading-4 text-[var(--grey-600)]">
          Glib.money is the application platform. The loan itself is made by
          Horizon Bank, and every credit decision is theirs. Amounts shown before
          approval are indicative.
        </p>
        <Link
          to="/console"
          className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[var(--glib-blue)]"
        >
          Bank staff — open the console
        </Link>
      </section>
    </AppShell>
  )
}
