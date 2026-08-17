// ============================================================================
// CJ-04 Study plan · CJ-05 Cost & ask · CJ-06 Parent snapshot · CJ-07 Offer
//
// The pre-qualification arc. Four short screens, then a number the customer can
// act on. Everything the offer shows comes from lib/eligibility.ts, which in
// turn reads data/policy.ts — nothing is computed in a component.
// ============================================================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application, Intake } from '@/types'
import type { EligibilityInput, IndicativeOffer } from '@/types/journeys'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  DataRow,
  GButton,
  GCard,
  GChip,
  GChoice,
  GField,
  GInput,
  GNumber,
  GSelect,
  ScreenTitle,
  SectionHeading,
  inrFull,
  inrShort,
  usdFull,
} from '@/journeys/common/glib'
import { draftRail } from './rail'
import { POLICY } from '@/data/policy'
import {
  TIER_LABEL,
  US_UNIVERSITIES,
  findUniversity,
  quote,
} from '@/lib/eligibility'
import { fmtDate } from '@/lib/format'
import { useJourney } from '@/journeys/useJourney'
import { useDeclaration } from '@/journeys/useDeclaration'
import { SmartFill } from '@/journeys/common/SmartFill'
import { PREQUAL_DEFAULTS, useSessionStore } from '@/store/sessionStore'

/** 'US$62,400' / '₹2,11,400' → 62400 / 211400. The reader prints money the way
 *  the document does; the fields on these screens hold plain numbers. */
const moneyToNumber = (v: string): number => Number(v.replace(/[^\d.]/g, '')) || 0

/** `US_UNIVERSITIES` is in the order it was built — the original 14, then the FT
 *  Global MBA Ranking 2026 additions in FT rank order. That was scannable at 14
 *  entries and is not at 45: someone looking for Yale has to read the whole
 *  list. Sorted for DISPLAY only; the underlying array keeps its order, which
 *  other code reads. */
const UNIVERSITY_OPTIONS = [...US_UNIVERSITIES].sort((a, b) => a.name.localeCompare(b.name))

const INTAKES: { id: Intake; label: string; start: string }[] = [
  { id: 'Spring-2026', label: 'Spring 2026', start: '2026-01-12T00:00:00.000Z' },
  { id: 'Fall-2026', label: 'Fall 2026', start: '2026-08-24T00:00:00.000Z' },
  { id: 'Fall-2027', label: 'Fall 2027', start: '2027-08-23T00:00:00.000Z' },
]

// ---------------------------------------------------------------------------
// CJ-04 · Study plan
// ---------------------------------------------------------------------------
export function Plan({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const setPreQual = useSessionStore((s) => s.setPreQual)

  const known = findUniversity(app.university)
  const [university, setUniversity] = useState(known ? app.university : '')
  const [custom, setCustom] = useState(known || app.university === 'Not chosen yet' ? '' : app.university)
  const [programme, setProgramme] = useState(
    app.program === 'Not chosen yet' ? '' : app.program,
  )
  const [level, setLevel] = useState<Application['programLevel']>(app.programLevel)
  const [intake, setIntake] = useState<Intake>(app.intake)
  const [months, setMonths] = useState<number>(24)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const chosenName = university || custom

  function next() {
    const e: Record<string, string> = {}
    if (!chosenName.trim()) e.university = 'Tell us which university admitted you, or where you’re applying.'
    if (!programme.trim()) e.programme = 'Which course? For example, “MS Computer Science”.'
    setErrors(e)
    if (Object.keys(e).length) return

    const ref = findUniversity(chosenName)
    const start = INTAKES.find((i) => i.id === intake)?.start ?? app.programStartDate
    milestone(
      'STUDY PLAN CAPTURED',
      `${programme.trim()} at ${chosenName.trim()} — ${intake.replace('-', ' ')}`,
      (a) => {
        a.university = chosenName.trim()
        a.universityShort = ref?.short ?? chosenName.trim().slice(0, 12)
        a.program = programme.trim()
        a.programLevel = level
        a.intake = intake
        a.programStartDate = start
      },
    )
    setPreQual(app.appId, { courseMonths: months })
    nav(`/apply/${app.appId}/cost`)
  }

  return (
    <AppShell steps={draftRail('plan')} homeTo="/apply">
      <BackLink to="/apply">My applications</BackLink>
      <ScreenTitle
        eyebrow="United States"
        title="Where are you going?"
        intro="We only fund postgraduate study in the USA at the moment, so we’ve fixed the country."
      />

      <GField
        label="University"
        hint="Start typing — if we know it, we can tell you more about your options."
        error={errors.university}
        htmlFor="f-uni"
      >
        <GSelect
          id="f-uni"
          value={university}
          onChange={(e) => {
            setUniversity(e.target.value)
            if (e.target.value) setCustom('')
          }}
        >
          <option value="">Choose, or enter another below</option>
          {UNIVERSITY_OPTIONS.map((u) => (
            <option key={u.name} value={u.name}>
              {u.name}
            </option>
          ))}
        </GSelect>
      </GField>

      {!university ? (
        <GField label="Or type your university" htmlFor="f-uni-other">
          <GInput
            id="f-uni-other"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="University name"
          />
        </GField>
      ) : null}

      <GField label="Course" error={errors.programme} htmlFor="f-prog">
        <GInput
          id="f-prog"
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          placeholder="MS Computer Science"
        />
      </GField>

      <GField label="Level" htmlFor="f-level">
        <GSelect
          id="f-level"
          value={level}
          onChange={(e) => setLevel(e.target.value as Application['programLevel'])}
        >
          <option value="Masters">Master’s</option>
          <option value="PhD">PhD</option>
          <option value="PG-Diploma">Postgraduate diploma</option>
        </GSelect>
      </GField>

      <GField label="When does it start?" htmlFor="f-intake">
        <GSelect id="f-intake" value={intake} onChange={(e) => setIntake(e.target.value as Intake)}>
          {INTAKES.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </GSelect>
      </GField>

      <GField label="How long is the course?" htmlFor="f-months">
        <GSelect id="f-months" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={12}>1 year</option>
          <option value={18}>18 months</option>
          <option value={24}>2 years</option>
          <option value={36}>3 years or more</option>
        </GSelect>
      </GField>

      <ActionBar>
        <GButton block onClick={next}>
          Next — what it costs
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-05 · Cost & ask
// ---------------------------------------------------------------------------
const COST_DOC = /^University COA per academic year$/i
const COST_BUCKET = /^E6$/

export function Cost({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const declare = useDeclaration(app, {
    section: 'applicant',
    group: 'Cost of Attendance (E6)',
    backingMatch: COST_DOC,
    backingBucket: COST_BUCKET,
  })
  const saved = useSessionStore((s) => s.prequal[app.appId]) ?? PREQUAL_DEFAULTS
  const setPreQual = useSessionStore((s) => s.setPreQual)

  const [coaUsd, setCoaUsd] = useState<number>(saved.coaUsd)
  const [ownInr, setOwnInr] = useState<number>(saved.ownContributionInr)
  const [askInr, setAskInr] = useState<number>(app.askInr)
  const [touchedAsk, setTouchedAsk] = useState(false)

  const coaInr = coaUsd * POLICY.fxReference
  const suggested = Math.max(0, Math.min(Math.round(coaInr - ownInr), POLICY.maxTicketInr))
  const effectiveAsk = touchedAsk ? askInr : suggested

  function next() {
    // Evidenced only, deliberately. This screen invites an estimate — "take
    // these off your cost-of-attendance page, estimates are fine for now" — and
    // a self-declared field becomes a condition of disbursement once the Phase C
    // gate lands. Turning an invited guess into a payment blocker, which a 1%
    // tolerance against the real COA would almost always trip, is not a thing to
    // do to someone. A figure actually read off the COA is a fact and is kept.
    if (declare.evidenced) {
      declare.commit([
        {
          key: 'coa_year',
          label: 'Cost of attendance, per year',
          value: usdFull(coaUsd),
          fromKey: 'total',
        },
      ])
    }

    milestone(
      'COST AND ASK CAPTURED',
      `Course cost ${usdFull(coaUsd)}/yr · own funds ${inrFull(ownInr)} · asking ${inrFull(effectiveAsk)}`,
      (a) => {
        a.askInr = Math.min(effectiveAsk, POLICY.maxTicketInr)
      },
    )
    setPreQual(app.appId, { coaUsd, ownContributionInr: ownInr })
    nav(`/apply/${app.appId}/parent-snapshot`)
  }

  return (
    <AppShell steps={draftRail('cost')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/plan`}>Your plan</BackLink>
      <ScreenTitle
        title="What will it cost?"
        intro="Take these off your university’s cost-of-attendance page. Estimates are fine for now — we’ll check against your I-20 later."
      />

      <SmartFill
        app={app}
        match={COST_DOC}
        bucket={COST_BUCKET}
        noun="your university’s cost sheet"
        onExtracted={(f) => {
          if (f.total) setCoaUsd(moneyToNumber(f.total))
        }}
        onComplete={declare.onSwarmComplete}
      />

      <GField
        label="Cost of attendance, per year"
        hint="Tuition plus living costs, as your university states it."
        htmlFor="f-coa"
      >
        <GNumber id="f-coa" prefix="US$" value={coaUsd} onValue={setCoaUsd} />
      </GField>

      <GCard tone="support" className="mb-4">
        <p className="text-[14px] leading-[21px]">
          That&rsquo;s about <span className="num font-semibold">{inrFull(coaInr)}</span> a year at
          today&rsquo;s reference rate of{' '}
          <span className="num">₹{POLICY.fxReference.toFixed(2)}</span> to US$1. The rate on the
          day money actually moves will be different.
        </p>
      </GCard>

      <GField
        label="How much can your family put in?"
        hint="Savings, scholarships, family support — anything that isn’t the loan."
        htmlFor="f-own"
      >
        <GNumber id="f-own" prefix="₹" value={ownInr} onValue={setOwnInr} />
      </GField>

      <GField
        label="How much do you want to borrow?"
        hint={`Up to ${inrShort(POLICY.maxTicketInr)}. We've suggested ${inrShort(suggested)} based on your numbers.`}
        htmlFor="f-ask"
      >
        <GNumber
          id="f-ask"
          prefix="₹"
          value={effectiveAsk}
          onValue={(n) => {
            setTouchedAsk(true)
            setAskInr(n)
          }}
        />
      </GField>

      {effectiveAsk > POLICY.maxTicketInr ? (
        <Callout tone="warn">
          The most this product lends is {inrShort(POLICY.maxTicketInr)}. We&rsquo;ll show your
          offer at that figure.
        </Callout>
      ) : null}

      <ActionBar>
        <GButton block onClick={next}>
          Next — about your parent
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-06 · Co-applicant snapshot
// ---------------------------------------------------------------------------
/** P2 is the salaried income bucket, so this document only exists on a salaried
 *  file — the self-employed branch is P3 and has no payslips to read. */
const PARENT_INCOME_DOC = /^3 payslips$/i
const PARENT_INCOME_BUCKET = /^P2$/

export function ParentSnapshot({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const declare = useDeclaration(app, {
    section: 'co_applicant',
    group: 'Income — salaried (P2)',
    backingMatch: PARENT_INCOME_DOC,
    backingBucket: PARENT_INCOME_BUCKET,
  })
  const saved = useSessionStore((s) => s.prequal[app.appId]) ?? PREQUAL_DEFAULTS
  const setPreQual = useSessionStore((s) => s.setPreQual)

  const [incomeType, setIncomeType] = useState<'salaried' | 'self_employed'>(app.incomeBranch)
  const [monthly, setMonthly] = useState<number>(saved.monthlyIncomeInr)
  const [emi, setEmi] = useState<number>(saved.existingEmiInr)
  const [nri, setNri] = useState(app.nriOverlay)

  function next() {
    // Evidenced only, for the same reason as CJ-05: this screen asks for a
    // rough figure ("they'll confirm their own details later, privately"), and
    // a rough figure must not become a condition of disbursement.
    if (declare.evidenced) {
      declare.commit([
        {
          key: 'monthly_income',
          label: 'Monthly income',
          value: inrFull(monthly),
          fromKey: 'net',
        },
      ])
    }

    milestone(
      'CO-APPLICANT SNAPSHOT CAPTURED',
      `${incomeType === 'salaried' ? 'Salaried' : 'Self-employed'}${nri ? ' · NRI' : ''} — indicative income ${inrFull(monthly)}/month`,
      (a) => {
        a.incomeBranch = incomeType
        a.nriOverlay = nri
      },
    )
    setPreQual(app.appId, {
      incomeType,
      monthlyIncomeInr: monthly,
      existingEmiInr: emi,
      isNri: nri,
    })
    nav(`/apply/${app.appId}/offer`)
  }

  return (
    <AppShell steps={draftRail('parent-snapshot')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/cost`}>What it costs</BackLink>
      <ScreenTitle
        title="About the parent who’ll co-sign"
        intro="You’re the borrower, but a parent’s income is what the bank assesses. Rough figures are fine — they’ll confirm their own details later, privately."
      />

      <SectionHeading>How do they earn?</SectionHeading>
      <div className="mb-5 space-y-2">
        <GChoice
          selected={incomeType === 'salaried'}
          onClick={() => setIncomeType('salaried')}
          title="Salaried"
          detail="They draw a monthly salary from an employer."
        />
        <GChoice
          selected={incomeType === 'self_employed'}
          onClick={() => setIncomeType('self_employed')}
          title="Self-employed or business"
          detail="They run a business or practise professionally."
        />
      </div>

      {incomeType === 'salaried' ? (
        <SmartFill
          app={app}
          match={PARENT_INCOME_DOC}
          bucket={PARENT_INCOME_BUCKET}
          noun="one of their payslips"
          onExtracted={(f) => {
            if (f.net) setMonthly(moneyToNumber(f.net))
          }}
          onComplete={declare.onSwarmComplete}
        />
      ) : null}

      <GField label="Roughly, their monthly income" htmlFor="f-inc">
        <GNumber id="f-inc" prefix="₹" value={monthly} onValue={setMonthly} />
      </GField>

      <GField
        label="What do they already pay each month in loan instalments?"
        hint="Home loan, car loan, anything with an EMI. Enter 0 if none."
        htmlFor="f-emi"
      >
        <GNumber id="f-emi" prefix="₹" value={emi} onValue={setEmi} />
      </GField>

      <div className="mb-2 space-y-2">
        <GChoice
          selected={!nri}
          onClick={() => setNri(false)}
          title="They live in India"
        />
        <GChoice
          selected={nri}
          onClick={() => setNri(true)}
          title="They live outside India"
          detail="We’ll ask for a few extra documents about overseas income."
        />
      </div>

      <ActionBar>
        <GButton block onClick={next}>
          Show me what I could borrow
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-07 · Indicative offer
// ---------------------------------------------------------------------------
export function Offer({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })

  // The pre-qual answers live in the session store, keyed by application, so
  // they survive every navigation in the arc and a revisit from CJ-15.
  const pq = useSessionStore((s) => s.prequal[app.appId]) ?? PREQUAL_DEFAULTS
  const setOffer = useSessionStore((s) => s.setOffer)
  const ref = findUniversity(app.university)

  const input: EligibilityInput = useMemo(
    () => ({
      country: 'US',
      universityName: app.university,
      universityRank: ref?.rank,
      programme: app.program,
      intake: String(app.intake).replace('-', ' '),
      courseMonths: pq.courseMonths,
      coaUsd: pq.coaUsd,
      ownContributionInr: pq.ownContributionInr,
      askInr: app.askInr,
      coApplicant: {
        incomeType: app.incomeBranch,
        monthlyIncomeInr: pq.monthlyIncomeInr,
        existingEmiInr: pq.existingEmiInr,
        isNri: app.nriOverlay,
      },
      securityOffered: 'none',
    }),
    [app, ref, pq],
  )

  const offer: IndicativeOffer = useMemo(() => quote(input), [input])

  function accept() {
    setOffer(app.appId, offer)
    milestone(
      'INDICATIVE OFFER ACCEPTED',
      `${TIER_LABEL[offer.tier]} · up to ${inrFull(offer.maxEligibleInr)} · ${offer.securityRequired ? 'security required' : 'no security required'}${offer.premierOverlay ? ` · premier overlay ${offer.premierOverlay}` : ''}`,
      (a) => {
        a.securedConstruct = offer.securityRequired
        a.tier = offer.securityRequired
          ? 'Tier-3'
          : offer.premierOverlay
            ? 'Premier-Overlay-Unsecured'
            : 'Tier-3'
        if (offer.premierOverlay) {
          // The basis LABEL is derived from the band alone, which is only
          // honest while `rank` in US_UNIVERSITIES is a global university rank.
          // If a programme-specific table is ever used for `rank` — the FT
          // Global MBA Ranking was proposed and rejected, see the comment above
          // US_UNIVERSITIES — this line would stamp `Global-Rank-Top-50` on a
          // decision that consulted no such ranking, and it renders to a
          // reviewer on the Decision tab and the Tier chip. `OverlayBasis`
          // already carries `'Programmatic-Top'` for that case, and POLICY's
          // own note allows it; the label must move with the source.
          //
          // BUT NOT BY EDITING THE TERNARY BELOW. The same expression appears
          // twice — once as the audit LABEL, once as the KEY into
          // `POLICY.premierOverlayCeilings`, which holds only the two
          // Global-Rank entries. Retarget the label alone and the ceiling
          // lookup returns undefined, so `overlayCeilingInr` becomes NaN and
          // the file carries no ceiling at all. Decouple the two first.
          a.overlayBasis = offer.premierOverlay === 'top50' ? 'Global-Rank-Top-50' : 'Global-Rank-Top-100'
          a.overlayCeilingInr = Number(
            POLICY.premierOverlayCeilings[
              offer.premierOverlay === 'top50' ? 'Global-Rank-Top-50' : 'Global-Rank-Top-100'
            ],
          )
        }
      },
    )
    nav(`/apply/${app.appId}/profile`)
  }

  return (
    <AppShell steps={draftRail('offer')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/parent-snapshot`}>About your parent</BackLink>
      <ScreenTitle title="What you could borrow" />

      <GCard tone="info" className="mb-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--blue-700)]">
          Indicative
        </p>
        <p className="num mt-1 display text-[32px] font-bold leading-9 text-[var(--glib-grey)]">
          {inrFull(offer.maxEligibleInr)}
        </p>
        <p className="mt-2 text-[14px] leading-[21px]">
          This is an estimate from what you&rsquo;ve told us, not an approval.
          Horizon Bank makes the real decision once your documents are in, and the
          figure can move either way.
        </p>
      </GCard>

      <GCard className="mb-4">
        <DataRow label="You asked for" value={inrFull(offer.askInr)} />
        <DataRow
          label="Security needed"
          value={offer.securityRequired ? 'Yes' : 'No'}
          hint={
            offer.securityRequired
              ? 'Property or a financial security'
              : offer.premierOverlay
                ? 'Covered by the premier-university allowance'
                : 'Within the unsecured limit'
          }
        />
        <DataRow
          label="Your share"
          value={offer.marginPct === 0 ? 'None' : `${offer.marginPct}%`}
          hint="Already deducted above"
        />
        <DataRow
          label="Repayment starts"
          value="After the course"
          hint={offer.moratoriumText}
        />
        <DataRow label="Offer valid until" value={fmtDate(offer.expiresAt)} />
      </GCard>

      {offer.premierOverlay ? (
        <div className="mb-4">
          <GChip tone="ok">
            {app.universityShort} is in the global top {offer.premierOverlay === 'top50' ? '50' : '100'}
          </GChip>
        </div>
      ) : null}

      {offer.caveats.length > 0 ? (
        <div className="mb-4">
          <SectionHeading>Worth knowing</SectionHeading>
          <ul className="space-y-2">
            {offer.caveats.map((c) => (
              <li key={c}>
                <GCard tone="support">
                  <p className="text-[14px] leading-[21px]">{c}</p>
                </GCard>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionBar>
        <GButton block onClick={accept}>
          Continue with this
        </GButton>
        <GButton block tone="quiet" onClick={() => nav(`/apply/${app.appId}/cost`)}>
          Change my numbers
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
