// ============================================================================
// CJ-22 Sanction · CJ-23 Fee · CJ-24 Agreement · CJ-25 Mandate ·
// CJ-26 Disbursement (§15)
//
// The load-bearing rule at the end of the journey: the customer REQUESTS a
// tranche, the bank RELEASES it under maker-checker. Nothing here can move
// money, and the release button does not exist on this surface.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  DataRow,
  GButton,
  GCard,
  GCheckbox,
  GChip,
  GField,
  GInput,
  ScreenTitle,
  SectionHeading,
  inrFull,
  usdFull,
} from '@/journeys/common/glib'
import { liveRail } from './rail'
import { POLICY } from '@/data/policy'
import { fmtDate, sanctionCountdown } from '@/lib/format'
import { TIER_LABEL, tierFor } from '@/lib/eligibility'
import { covenantCopy } from '@/lib/plainLanguage'
import { gatesFor } from '@/lib/declared'
import { docToText } from '@/lib/agents/sanction'
import { downloadText, stampedName } from '@/lib/csv'
import { useJourney } from '@/journeys/useJourney'

// ---------------------------------------------------------------------------
// CJ-22 · Your sanction letter
// ---------------------------------------------------------------------------
export function Sanction({ app }: { app: Application }) {
  const nav = useNavigate()
  const { emit, milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'customer',
  })
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const seen = useRef(false)

  const { days, rag } = sanctionCountdown(app.sanctionExpiryDate)
  const tier = tierFor(app.askInr)

  useEffect(() => {
    if (seen.current) return
    seen.current = true
    milestone('SANCTION VIEWED', 'Customer opened the sanction letter')
  }, [milestone])

  function accept() {
    milestone(
      'SANCTION ACCEPTED',
      `Customer accepted ${inrFull(app.askInr)} sanctioned on ${fmtDate(app.sanctionDate)}`,
      (a) => {
        a.status = 'in_progress'
        a.blocker = { kind: 'bank', detail: 'bank: acceptance received, documentation to start' }
      },
    )
    nav(`/apply/${app.appId}/fee`)
  }

  function decline() {
    emit('SANCTION_DECLINED', { reason }, `${app.appId}:decline`)
    milestone('SANCTION DECLINED', reason || 'Customer declined the offer')
    nav(`/apply/${app.appId}/status`)
  }

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/status`}>Where my application is</BackLink>
      <ScreenTitle
        title="Your loan has been approved"
        intro="Read these terms carefully. Accepting them is what starts the paperwork."
      />

      {rag ? (
        <div className="mb-4">
          <GChip tone={rag === 'red' ? 'stop' : rag === 'amber' ? 'warn' : 'ok'}>
            {days > 0
              ? `Valid for another ${days} day${days === 1 ? '' : 's'} — until ${fmtDate(app.sanctionExpiryDate)}`
              : 'This offer has expired'}
          </GChip>
        </div>
      ) : null}

      <GCard className="mb-4">
        <DataRow label="Amount sanctioned" value={inrFull(app.askInr)} />
        <DataRow label="Band" value={TIER_LABEL[tier]} hint={POLICY.tierBands.tier3Note} />
        <DataRow
          label="Your share"
          value={`${POLICY.marginPct}%`}
          hint="The part of the cost you fund yourself"
        />
        {/* POLICY, not a hardcoded band. This read "Floating, 9.75%–11.25%"
            while the sanction letter and the Key Facts Statement — both
            generated from POLICY.sanctionRoi — quoted a single contracted
            rate. Two numbers for the same loan on two screens the customer
            sees minutes apart. */}
        <DataRow
          label="Interest rate"
          value={`${POLICY.sanctionRoi.annualPct.toFixed(2)}% a year`}
          hint={POLICY.sanctionRoi.basis}
        />
        <DataRow label="Repayment starts" value="After the course" hint={POLICY.moratorium} />
        <DataRow label="First instalment" value="18–30 months from today" hint={POLICY.moratoriumNote} />
        <DataRow
          label="Security"
          value={app.securedConstruct ? 'Property or financial security' : 'None required'}
        />
        <DataRow label="Offer valid until" value={fmtDate(app.sanctionExpiryDate)} />
      </GCard>

      {/* §Phase D — the papers written for the customer. `audience` is filtered
          HERE and not by convention: the CAM and the internal risk note are in
          the same container, and a customer must never open one. */}
      {(app.generatedDocs ?? []).some((d) => d.audience === 'customer') ? (
        <>
          <SectionHeading>Your paperwork</SectionHeading>
          <ul className="mb-4 space-y-2">
            {(app.generatedDocs ?? [])
              .filter((d) => d.audience === 'customer')
              .map((d) => (
                <li key={d.id}>
                  <GCard>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="display text-[15px] font-semibold leading-[21px]">{d.title}</p>
                        <p className="mt-0.5 text-[13px] text-[var(--grey-600)]">
                          {d.sections[0]?.rows
                            .slice(0, 2)
                            .map((r) => `${r.label}: ${r.value}`)
                            .join(' · ')}
                        </p>
                      </div>
                      <GButton
                        size="sm"
                        tone="secondary"
                        onClick={() =>
                          downloadText(stampedName(d.title, d.producedAt, 'txt'), docToText(d))
                        }
                      >
                        Download
                      </GButton>
                    </div>
                  </GCard>
                </li>
              ))}
          </ul>
        </>
      ) : null}

      {app.covenants.filter((c) => c.status === 'open').length > 0 ? (
        <>
          <SectionHeading>Conditions attached</SectionHeading>
          <ul className="mb-4 space-y-2">
            {app.covenants
              .filter((c) => c.status === 'open')
              .map((c) => {
                const copy = covenantCopy(c.defId, c.title)
                return (
                  <li key={c.id}>
                    <GCard tone="support">
                      <p className="text-[14px] font-semibold leading-[21px]">{copy.title}</p>
                      {copy.detail ? (
                        <p className="mt-1 text-[14px] leading-[21px]">{copy.detail}</p>
                      ) : null}
                      <p className="mt-1 text-[13px] text-[var(--grey-600)]">
                        {plainClearBy(c.clearBy)}
                      </p>
                    </GCard>
                  </li>
                )
              })}
          </ul>
        </>
      ) : null}

      {declining ? (
        <div className="mb-4">
          <GField label="Would you tell us why? It helps us do better." htmlFor="dec-r">
            <GInput
              id="dec-r"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Found a better rate, deferred my intake, …"
            />
          </GField>
        </div>
      ) : null}

      <ActionBar>
        {declining ? (
          <>
            <GButton block tone="danger" onClick={decline}>
              Yes, decline this offer
            </GButton>
            <GButton block tone="quiet" onClick={() => setDeclining(false)}>
              Keep it open
            </GButton>
          </>
        ) : (
          <>
            <GButton block onClick={accept}>
              Accept this offer
            </GButton>
            <GButton block tone="secondary" onClick={() => nav(`/apply/${app.appId}/status`)}>
              Ask a question first
            </GButton>
            <GButton block tone="quiet" onClick={() => setDeclining(true)}>
              Decline
            </GButton>
          </>
        )}
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-23 · Processing fee
// ---------------------------------------------------------------------------
export function Fee({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const [paid, setPaid] = useState(false)

  const fee = Math.max(
    POLICY.processingFee.minInr,
    Math.round((app.askInr * POLICY.processingFee.pct) / 100),
  )

  function pay() {
    setPaid(true)
    milestone('PROCESSING FEE PAID', `${inrFull(fee)} — ${POLICY.processingFee.pct}% of sanctioned, min ₹${POLICY.processingFee.minInr.toLocaleString('en-IN')}`)
  }

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/sanction`}>Your offer</BackLink>
      <ScreenTitle
        title="Processing fee"
        intro={`${POLICY.processingFee.pct}% of the sanctioned amount, with a minimum of ₹${POLICY.processingFee.minInr.toLocaleString('en-IN')}.`}
      />

      <GCard tone="info" className="mb-4">
        <p className="num display text-[28px] font-bold leading-8">{inrFull(fee)}</p>
        <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
          One-off, payable now. Nothing is charged automatically — you tap the
          button.
        </p>
      </GCard>

      {paid ? (
        <Callout tone="ok" title="Fee received">
          A receipt is on its way to your email.
        </Callout>
      ) : (
        <Callout tone="support">
          This is a prototype. No payment gateway is connected and no money
          moves.
        </Callout>
      )}

      <ActionBar>
        {paid ? (
          <GButton block onClick={() => nav(`/apply/${app.appId}/agreement`)}>
            Next — sign the agreement
          </GButton>
        ) : (
          <GButton block onClick={pay}>
            Pay {inrFull(fee)}
          </GButton>
        )}
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-24 · Sign the agreement
// ---------------------------------------------------------------------------
export function Agreement({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const [readToEnd, setReadToEnd] = useState(false)
  const [step, setStep] = useState<'read' | 'otp' | 'done'>('read')
  const [otp, setOtp] = useState('')

  function sign() {
    setStep('done')
    milestone('AGREEMENT SIGNED', 'Loan agreement e-signed and e-stamped')
  }

  if (step === 'done') {
    return (
      <AppShell steps={liveRail(app)} homeTo="/apply">
        <ScreenTitle title="Signed" intro="Your agreement is signed and stamped." />
        <GCard tone="ok" className="mb-4">
          <p className="text-[14px] leading-[21px]">
            A stamped copy has gone to your email and your parent&rsquo;s.
            You&rsquo;ll always be able to download it from here.
          </p>
        </GCard>
        <ActionBar>
          <GButton block onClick={() => nav(`/apply/${app.appId}/mandate`)}>
            Next — set up repayment
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  if (step === 'otp') {
    return (
      <AppShell steps={liveRail(app)} homeTo="/apply">
        <ScreenTitle
          title="Sign with a one-time code"
          intro="An electronic signature is legally yours, so it needs a code sent to your own mobile."
        />
        <GField label="6-digit code" htmlFor="sg-otp">
          <GInput
            id="sg-otp"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="num text-center text-[22px] tracking-[0.4em]"
          />
        </GField>
        <p className="text-[12px] leading-4 text-[var(--grey-600)]">
          Prototype — any 6 digits will do.
        </p>
        <ActionBar>
          <GButton block disabled={otp.length !== 6} onClick={sign}>
            Sign the agreement
          </GButton>
          <GButton block tone="quiet" onClick={() => setStep('read')}>
            Back to the agreement
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/fee`}>Processing fee</BackLink>
      <ScreenTitle
        title="Your loan agreement"
        intro="Read it through to the end. The button unlocks when you get there."
      />
      <div
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true)
        }}
        className="mb-4 h-[320px] overflow-y-auto rounded-xl border border-[var(--grey-300)] p-4 text-[14px] leading-[21px] text-[var(--glib-grey)]"
      >
        {AGREEMENT_CLAUSES.map((c, i) => (
          <section key={c.h} className="mb-4">
            <h3 className="display mb-1 text-[15px] font-semibold">
              {i + 1}. {c.h}
            </h3>
            <p className="text-[var(--grey-600)]">{c.p}</p>
          </section>
        ))}
        <p className="text-[var(--grey-600)]">
          This is prototype text, written to be readable rather than to be a real
          loan agreement.
        </p>
      </div>

      <GCheckbox id="ag-read" checked={readToEnd} onChange={setReadToEnd}>
        I have read the agreement
      </GCheckbox>

      <ActionBar>
        <GButton block disabled={!readToEnd} onClick={() => setStep('otp')}>
          Sign the agreement
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

const AGREEMENT_CLAUSES = [
  { h: 'What you are borrowing', p: 'The amount in your sanction letter, to be paid to your university and to you in instalments as your course progresses.' },
  { h: 'What it costs', p: 'A floating interest rate within the band in your sanction letter, reset periodically. Interest accrues from the day each instalment goes out.' },
  { h: 'When you start repaying', p: 'After your course finishes, plus the grace period in your sanction letter. You may pay interest during the course if you want to keep the balance down.' },
  { h: 'Your co-applicant', p: 'Your parent is jointly responsible for repaying this loan. If you cannot pay, they must.' },
  { h: 'Paying early', p: 'You can repay part or all of the loan early, at any time, without a penalty.' },
  { h: 'What you must tell us', p: 'If you change university, defer your intake, or your visa is refused, tell us within thirty days.' },
  { h: 'If you do not repay', p: 'Missed payments are reported to the credit bureaus and affect both you and your co-applicant. Any security given can be enforced.' },
  { h: 'Complaints', p: 'If something goes wrong, write to the bank first. If you are not satisfied within thirty days, you can go to the Banking Ombudsman at no cost.' },
]

// ---------------------------------------------------------------------------
// CJ-25 · Set up repayment (NACH)
// ---------------------------------------------------------------------------
export function Mandate({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const [step, setStep] = useState<'account' | 'pennydrop' | 'done'>('account')
  const [acc, setAcc] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const parent = app.parties.find((p) => p.role === 'co_applicant')

  function verify() {
    const e: Record<string, string> = {}
    if (acc.replace(/\D/g, '').length < 9) e.acc = 'An account number is usually 9 to 18 digits.'
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase()))
      e.ifsc = 'An IFSC looks like HDFC0001234 — four letters, a zero, then six characters.'
    setErrors(e)
    if (Object.keys(e).length) return
    setStep('pennydrop')
  }

  function confirm() {
    setStep('done')
    milestone(
      'REPAYMENT MANDATE REGISTERED',
      `NACH mandate on ${parent?.name ?? 'the co-applicant'}'s account ending ${acc.slice(-4)} — penny-drop name match confirmed`,
    )
  }

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/agreement`}>Your agreement</BackLink>
      <ScreenTitle
        title="Set up repayment"
        intro={`Instalments are collected from ${parent?.name ?? 'your parent'}'s rupee account. It has to be an Indian account in their name.`}
      />

      {step === 'account' ? (
        <>
          <GField label="Account number" error={errors.acc} htmlFor="m-acc">
            <GInput
              id="m-acc"
              inputMode="numeric"
              value={acc}
              onChange={(e) => setAcc(e.target.value.replace(/\D/g, ''))}
              className="num"
            />
          </GField>
          <GField label="IFSC" error={errors.ifsc} htmlFor="m-ifsc">
            <GInput
              id="m-ifsc"
              value={ifsc}
              maxLength={11}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              className="num uppercase"
              placeholder="HDFC0001234"
            />
          </GField>
          <Callout tone="support">
            We&rsquo;ll send ₹1 to this account to check the name matches. It
            stays there.
          </Callout>
          <ActionBar>
            <GButton block onClick={verify}>
              Check this account
            </GButton>
          </ActionBar>
        </>
      ) : step === 'pennydrop' ? (
        <>
          <GCard tone="info" className="mb-4">
            <p className="display text-[16px] font-semibold">₹1 sent</p>
            <p className="mt-1 text-[14px] leading-[21px]">
              The account came back in the name{' '}
              <span className="font-semibold">{parent?.name ?? 'your co-applicant'}</span>, which
              matches. That&rsquo;s the check done.
            </p>
          </GCard>
          <ActionBar>
            <GButton block onClick={confirm}>
              Set up the instruction
            </GButton>
            <GButton block tone="quiet" onClick={() => setStep('account')}>
              Use a different account
            </GButton>
          </ActionBar>
        </>
      ) : (
        <>
          <Callout tone="ok" title="Repayment is set up">
            Nothing will be collected until your instalments actually start,
            18 to 30 months from now.
          </Callout>
          <ActionBar>
            <GButton block onClick={() => nav(`/apply/${app.appId}/disbursement`)}>
              Next — getting the money out
            </GButton>
          </ActionBar>
        </>
      )}
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-26 · Disbursement
// ---------------------------------------------------------------------------
export function Disbursement({ app }: { app: Application }) {
  const nav = useNavigate()
  const { emit } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/status`}>Where my application is</BackLink>
      <ScreenTitle
        title="Getting the money out"
        intro="Money goes to your university in instalments, one semester at a time. You ask; the bank checks and releases."
      />

      {app.tranches.length === 0 ? (
        <Callout tone="support" title="Nothing scheduled yet">
          Your instalment plan appears here once the paperwork is complete.
        </Callout>
      ) : (
        <ul className="space-y-3">
          {app.tranches.map((t) => {
            // `gatesFor`, not `t.gates` — the declaration gate is derived at
            // read time and lands on tranche 1.
            const failing = gatesFor(app, t).filter((g) => !g.passed)
            const done = t.status === 'remitted' || t.status === 'released'
            return (
              <li key={t.id}>
                <GCard tone={done ? 'ok' : failing.length > 0 ? 'support' : 'plain'}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="display text-[16px] font-semibold leading-[22px]">
                        Instalment {t.n} · {t.semester}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--grey-600)]">
                        {t.type.startsWith('Tuition') ? 'To your university' : 'For living costs'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-[15px] font-bold">{usdFull(t.amountUsd)}</p>
                      <p className="num text-[12px] text-[var(--grey-600)]">
                        about {inrFull(t.amountInr)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {done ? (
                      <GChip tone="ok">Sent</GChip>
                    ) : failing.length > 0 ? (
                      <>
                        <p className="mb-2 text-[14px] leading-[21px]">
                          Before this one can go out:
                        </p>
                        <ul className="space-y-1">
                          {/* Two internal rules can say the same thing to a
                              customer, so dedupe on the SENTENCE. */}
                          {[...new Set(failing.map((g) => plainGate(g.label)))].map((line) => (
                            <li key={line} className="text-[14px] leading-[21px] text-[var(--grey-600)]">
                              · {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <GButton
                        size="sm"
                        onClick={() =>
                          emit('TRANCHE_REQUESTED', { trancheId: t.id, n: t.n }, `${app.appId}:t${t.n}`)
                        }
                      >
                        Ask for instalment {t.n}
                      </GButton>
                    )}
                  </div>
                </GCard>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-5">
        <Callout tone="support" title="Who does what">
          You ask for an instalment. The bank checks the conditions and two
          different officers sign it off before the money moves. That last part
          is theirs, not yours.
        </Callout>
      </div>

      <ActionBar>
        <GButton block tone="secondary" onClick={() => nav(`/apply/${app.appId}/tasks`)}>
          Back to my list
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

/** "Tranche-1", "final disbursement" — internal gate names. The customer thinks
 *  in instalments. */
function plainClearBy(clearBy: string): string {
  const c = clearBy.toLowerCase()
  if (c.includes('first')) return 'Needed before the first instalment'
  if (c.includes('final')) return 'Needed before the last instalment'
  const m = /tranche-?\s*(\d+)/i.exec(clearBy)
  if (m) return `Needed before instalment ${m[1]}`
  return 'Needed before the money goes out'
}

/** Internal gate labels carry rule refs and BUCKET CODES; the customer sees the
 *  plain ask (§0.6). Two separate rules can translate to the same sentence — a
 *  visa endorsement gate and an endorsement-verified gate are one thing to a
 *  customer — so the caller dedupes on the output, not the input. */
function plainGate(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('self-declared')) return 'The details you typed in, checked against your documents'
  if (l.includes('visa') || l.includes('endorsement')) return 'Your stamped visa'
  if (l.includes('foreign banking') || l.includes('forex')) {
    return 'Your account abroad, or a forex card'
  }
  if (l.includes('charge') || l.includes('mortgage')) return 'The security paperwork being registered'
  if (l.includes('fee receipt')) return 'Your university’s receipt for the last instalment'
  if (l.includes('a2') || l.includes('fema')) return 'The foreign-exchange form for this instalment'
  if (l.includes('lrs')) return 'Confirmation that this stays within the yearly limit abroad'

  // Anything unmapped is stripped of every internal reference — rule ids
  // (VAL-CRS-21), covenant and deviation ids, and bucket codes (E10, C4, P1#2).
  // If that leaves nothing meaningful, say something true rather than a code.
  const stripped = label
    .replace(/\b(?:VAL|COV|DEV)-[A-Z]*-?\d+\b/g, '')
    .replace(/\b[EPCL]\d{1,2}(?:#\d+)?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (stripped.length < 4) return 'A check the bank still has to complete'
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
