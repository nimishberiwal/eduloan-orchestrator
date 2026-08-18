// ============================================================================
// CJ-08 Profile · CJ-09 Academics · CJ-10 Admission · CJ-11 Add parent ·
// CJ-12 Security
//
// The capture arc. Each screen writes an audited milestone and, where it
// changes the shape of the file (a co-applicant joining, security being
// offered), extends the checklist through the EXISTING store verbs rather than
// regenerating it — regenerating would discard verified documents (§7.7).
// ============================================================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GCheckbox,
  GChoice,
  GField,
  GInput,
  GNumber,
  GSelect,
  ScreenTitle,
  SectionHeading,
  inrShort,
} from '@/journeys/common/glib'
import { draftRail } from './rail'
import { useJourney } from '@/journeys/useJourney'
import { useDeclaration } from '@/journeys/useDeclaration'
import { SmartFill } from '@/journeys/common/SmartFill'
import { useSessionStore } from '@/store/sessionStore'
import { POLICY } from '@/data/policy'

// ---------------------------------------------------------------------------
// Dates cross a namespace here the way form keys do. A date input holds
// `2002-08-14`; a PAN prints `14-08-2002`. `valuesAgree` compares the first
// number it finds, so handing it the two forms unchanged reads 2002 against 14
// and reports a discrepancy on a date that matches perfectly.
// ---------------------------------------------------------------------------
const isoFromPrinted = (d: string): string => {
  const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const printedFromIso = (d: string): string => {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d
}

// ---------------------------------------------------------------------------
// CJ-08 · Your details
// ---------------------------------------------------------------------------
/** The PAN evidences who you are. The label repeats in P1, so the bucket is
 *  part of the match — see `DeclarationSpec.backingBucket`. */
const PROFILE_DOC = /^PAN$/i
const PROFILE_BUCKET = /^E1$/

export function Profile({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const declare = useDeclaration(app, {
    section: 'applicant',
    group: 'Identity (E1)',
    backingMatch: PROFILE_DOC,
    backingBucket: PROFILE_BUCKET,
  })
  const me = app.parties.find((p) => p.role === 'applicant')

  const [name, setName] = useState(me?.name === 'New applicant' ? '' : (me?.name ?? ''))
  const [dob, setDob] = useState('')
  const [pan, setPan] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function next() {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Enter your name exactly as it appears on your PAN.'
    if (!dob) e.dob = 'We need your date of birth.'
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase()))
      e.pan = 'A PAN looks like ABCDE1234F — five letters, four digits, one letter.'
    if (address.trim().length < 5) e.address = 'Enter the address on your ID.'
    if (!/^\d{6}$/.test(pin)) e.pin = 'A PIN code is six digits.'
    setErrors(e)
    if (Object.keys(e).length) return

    // Only the three facts the PAN can actually evidence. Address, city and PIN
    // are evidenced by the Aadhaar — a different document in the same bucket —
    // so declaring them against the PAN would create an obligation that the
    // document collected at CJ-28 could never discharge.
    declare.commit([
      { key: 'name', label: 'Full name', value: name, fromKey: 'name' },
      { key: 'dob', label: 'Date of birth', value: printedFromIso(dob), fromKey: 'dob' },
      { key: 'pan', label: 'PAN', value: pan.toUpperCase(), fromKey: 'pan' },
      // §v5 — the applicant's own city and PIN, which this screen has always
      // collected and always thrown away: they went into the milestone remark
      // and nowhere else. The only geography on the data model is the SERVICING
      // BRANCH, so a cohort agent asked about "where applicants come from" can
      // currently only answer about where the bank has offices. Recording these
      // does not fix that today — no closed file has one — but it is the
      // difference between the gap closing over time and never closing.
      { key: 'city', label: 'City', value: city },
      { key: 'pin', label: 'PIN code', value: pin },
    ])

    milestone('PROFILE SUBMITTED', `${name.trim()} · PAN on file · ${city || pin}`, (a) => {
      a.studentName = name.trim()
      const p = a.parties.find((x) => x.role === 'applicant')
      if (p) p.name = name.trim()
    })
    nav(`/apply/${app.appId}/academics`)
  }

  return (
    <AppShell steps={draftRail('profile')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/offer`}>Your offer</BackLink>
      <ScreenTitle
        title="About you"
        intro="Enter these exactly as they appear on your documents — a mismatch later means re-doing this."
      />

      <SmartFill
        app={app}
        match={PROFILE_DOC}
        bucket={PROFILE_BUCKET}
        noun="your PAN"
        onExtracted={(f) => {
          // Prefilled, not committed. 'as printed' is the reader's placeholder
          // for a field it has no context for, and 'New applicant' is the
          // draft's own stand-in — neither is a name to put in front of someone.
          if (f.name && f.name !== 'as printed' && f.name !== 'New applicant') setName(f.name)
          if (f.pan && f.pan !== 'as printed') setPan(f.pan.toUpperCase())
          if (f.dob) {
            const iso = isoFromPrinted(f.dob)
            if (iso) setDob(iso)
          }
        }}
        onComplete={declare.onSwarmComplete}
      />

      <GField label="Full name" error={errors.name} htmlFor="d-name">
        <GInput id="d-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </GField>

      <GField label="Date of birth" error={errors.dob} htmlFor="d-dob">
        <GInput id="d-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </GField>

      <GField label="PAN" hint="Ten characters, as printed." error={errors.pan} htmlFor="d-pan">
        <GInput
          id="d-pan"
          value={pan}
          maxLength={10}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          className="num uppercase"
        />
      </GField>

      <SectionHeading>Where you live in India</SectionHeading>
      <GField label="Address" error={errors.address} htmlFor="d-addr">
        <GInput id="d-addr" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </GField>
      <div className="flex gap-3">
        <div className="flex-1">
          <GField label="City" htmlFor="d-city">
            <GInput id="d-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </GField>
        </div>
        <div className="w-[140px]">
          <GField label="PIN code" error={errors.pin} htmlFor="d-pin">
            <GInput
              id="d-pin"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="num"
            />
          </GField>
        </div>
      </div>

      <ActionBar>
        <GButton block onClick={next}>
          Next — your studies so far
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-09 · Academic history
// ---------------------------------------------------------------------------
/** The marksheet is what evidences everything on CJ-09. */
const ACADEMIC_DOC = /UG marksheets all semesters/i

export function Academics({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const declare = useDeclaration(app, {
    section: 'applicant',
    group: 'Academic (E3)',
    backingMatch: ACADEMIC_DOC,
  })

  const [ugInstitution, setUg] = useState('')
  const [ugResult, setUgResult] = useState('')
  const [ugYear, setUgYear] = useState('')
  const [backlogs, setBacklogs] = useState<number>(0)
  const [hasGap, setHasGap] = useState(false)
  const [gapReason, setGapReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function next() {
    const e: Record<string, string> = {}
    if (ugInstitution.trim().length < 2) e.ug = 'Which college or university awarded your degree?'
    if (!ugResult.trim()) e.result = 'Your final percentage or CGPA, as printed on the marksheet.'
    if (hasGap && gapReason.trim().length < 5)
      e.gap = 'A line about what you were doing is enough — work, exams, health, anything.'
    setErrors(e)
    if (Object.keys(e).length) return

    // Previously this screen persisted NOTHING — the values lived only inside
    // the audit remark. They are now recorded as fields, either evidenced by
    // the uploaded marksheet or self-declared and owed later.
    declare.commit([
      { key: 'ug_institution', label: 'Institution', value: ugInstitution, fromKey: 'institution' },
      { key: 'ug_result', label: 'Result', value: ugResult, fromKey: 'result' },
      { key: 'ug_year', label: 'Year finished', value: ugYear, fromKey: 'awardYear' },
      { key: 'ug_backlogs', label: 'Backlogs outstanding', value: String(backlogs), fromKey: 'backlogs' },
    ])

    milestone(
      'ACADEMICS SUBMITTED',
      `${ugInstitution.trim()} · ${ugResult.trim()} · ${backlogs} backlog(s)${hasGap ? ' · gap declared' : ''}${
        declare.evidenced ? ' · read from the marksheet' : ' · self-declared'
      }`,
    )
    nav(`/apply/${app.appId}/admission`)
  }

  return (
    <AppShell steps={draftRail('profile')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/profile`}>About you</BackLink>
      <ScreenTitle
        title="Your degree"
        intro="Your undergraduate results, as they appear on your marksheets."
      />

      <SmartFill
        app={app}
        match={ACADEMIC_DOC}
        noun="your marksheets"
        onExtracted={(f) => {
          // Prefilled, not committed — every one of these is editable below.
          if (f.institution && f.institution !== 'as printed') setUg(f.institution)
          if (f.result) setUgResult(f.result)
          if (f.awardYear) setUgYear(String(f.awardYear).slice(0, 4))
          if (f.backlogs !== undefined) setBacklogs(Number(f.backlogs) || 0)
        }}
        onComplete={declare.onSwarmComplete}
      />

      <GField label="College or university" error={errors.ug} htmlFor="a-ug">
        <GInput id="a-ug" value={ugInstitution} onChange={(e) => setUg(e.target.value)} />
      </GField>

      <div className="flex gap-3">
        <div className="flex-1">
          <GField label="Final result" hint="Percentage or CGPA" error={errors.result} htmlFor="a-res">
            <GInput id="a-res" value={ugResult} onChange={(e) => setUgResult(e.target.value)} placeholder="8.4 CGPA" />
          </GField>
        </div>
        <div className="w-[140px]">
          <GField label="Year finished" htmlFor="a-year">
            <GInput
              id="a-year"
              inputMode="numeric"
              maxLength={4}
              value={ugYear}
              onChange={(e) => setUgYear(e.target.value.replace(/\D/g, ''))}
              className="num"
              placeholder="2025"
            />
          </GField>
        </div>
      </div>

      <GField
        label="Any backlogs still open?"
        hint="Papers you haven’t cleared yet. Zero is common."
        htmlFor="a-back"
      >
        <GNumber id="a-back" value={backlogs} onValue={setBacklogs} />
      </GField>

      <GCheckbox id="a-gap" checked={hasGap} onChange={setHasGap}>
        There&rsquo;s a gap of more than a year between finishing my degree and
        starting this course
      </GCheckbox>

      {hasGap ? (
        <GField label="What were you doing?" error={errors.gap} htmlFor="a-gapr">
          <GInput
            id="a-gapr"
            value={gapReason}
            onChange={(e) => setGapReason(e.target.value)}
            placeholder="Working at …, preparing for GRE, family reasons"
          />
        </GField>
      ) : null}

      <ActionBar>
        <GButton block onClick={next}>
          Next — your admission
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-10 · Admission & tests
// ---------------------------------------------------------------------------
/** The I-20 evidences the SEVIS ID. The test scores on the same screen come off
 *  the score reports in E4 — different documents, so a second backing. */
const ADMISSION_DOC = /^I-20 \(USA F-1\) with SEVIS ID$/i
const ADMISSION_BUCKET = /^E5$/

const SCORECARD_BUCKET = /^E4$/
const LANGUAGE_DOC = /^IELTS\/TOEFL-iBT$/i
/** All of E4's score reports, as the backing for the scores as a group. Which
 *  ONE the customer actually uploads decides which fields get a reading; the
 *  rest stay owed. */
const SCORECARD_DOCS = /^(GRE General|GRE Subject|GMAT\/GMAT-Focus\/EA|LSAT|IELTS\/TOEFL-iBT)$/i

/** Which entrance test this programme sits, following the checklist's own
 *  conditionality (E4: GRE for MS/MA/PhD, GMAT for MBA/MSc-Mgmt, LSAT for JD).
 *  Offering all three would ask someone to pick a document they don't have. */
function entranceDocFor(program: string): RegExp {
  const p = program.toLowerCase()
  if (/\bmba\b|manage/.test(p)) return /^GMAT\/GMAT-Focus\/EA$/i
  if (/\bjd\b|\blaw\b/.test(p)) return /^LSAT$/i
  return /^GRE General$/i
}

export function Admission({ app }: { app: Application }) {
  const nav = useNavigate()
  const { milestone } = useJourney({ appId: app.appId, partyRole: 'applicant', surface: 'customer' })
  const declare = useDeclaration(app, {
    section: 'applicant',
    group: 'Admission (E5)',
    backingMatch: ADMISSION_DOC,
    backingBucket: ADMISSION_BUCKET,
  })
  const scores = useDeclaration(app, {
    section: 'applicant',
    group: 'Entrance & language (E4)',
    backingMatch: SCORECARD_DOCS,
    backingBucket: SCORECARD_BUCKET,
  })
  // Stable identity — a regex literal rebuilt each render would churn
  // SmartFill's document useMemo on every keystroke.
  const entranceDoc = useMemo(() => entranceDocFor(app.program), [app.program])

  const [admitStatus, setAdmitStatus] = useState<'unconditional' | 'conditional' | 'awaiting'>(
    'unconditional',
  )
  const [sevis, setSevis] = useState('')
  const [testOptional, setTestOptional] = useState(false)
  const [tests, setTests] = useState<Record<string, string>>({})

  const TESTS = ['GRE', 'GMAT', 'LSAT', 'IELTS', 'TOEFL']

  /** One handler for every score report — whichever shape the reader used, only
   *  the keys it actually returned are applied. */
  function applyScores(f: Record<string, string>) {
    setTests((t) => ({
      ...t,
      ...(f.gre ? { GRE: f.gre } : {}),
      ...(f.gmat ? { GMAT: f.gmat } : {}),
      ...(f.lsat ? { LSAT: f.lsat } : {}),
      ...(f.ielts ? { IELTS: f.ielts } : {}),
      ...(f.toefl ? { TOEFL: f.toefl } : {}),
    }))
  }

  function next() {
    const taken = Object.entries(tests)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k} ${v}`)

    // Empty values are dropped by the builders, so a customer still waiting on
    // their I-20 declares nothing here rather than an empty obligation.
    declare.commit([{ key: 'sevis', label: 'SEVIS ID', value: sevis, fromKey: 'sevis' }])

    // The scores previously lived only inside the audit remark — the same gap
    // Academics had. On the test-optional route there is nothing to declare.
    if (!testOptional) {
      scores.commit([
        { key: 'gre', label: 'GRE', value: tests.GRE ?? '', fromKey: 'gre' },
        { key: 'gmat', label: 'GMAT', value: tests.GMAT ?? '', fromKey: 'gmat' },
        { key: 'lsat', label: 'LSAT', value: tests.LSAT ?? '', fromKey: 'lsat' },
        { key: 'ielts', label: 'IELTS', value: tests.IELTS ?? '', fromKey: 'ielts' },
        { key: 'toefl', label: 'TOEFL', value: tests.TOEFL ?? '', fromKey: 'toefl' },
      ])
    }

    milestone(
      'ADMISSION SUBMITTED',
      `${admitStatus} admit${sevis ? ` · SEVIS ${sevis}` : ''}${
        testOptional ? ' · test-optional route' : taken.length ? ` · ${taken.join(', ')}` : ''
      }`,
    )
    nav(`/apply/${app.appId}/co-applicant`)
  }

  return (
    <AppShell steps={draftRail('profile')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/academics`}>Your degree</BackLink>
      <ScreenTitle
        title="Your admission"
        intro="If you already have your I-20, the details on it are what matter most."
      />

      <SmartFill
        app={app}
        match={ADMISSION_DOC}
        bucket={ADMISSION_BUCKET}
        noun="your I-20"
        onExtracted={(f) => {
          if (f.sevis) setSevis(f.sevis.toUpperCase())
        }}
        onComplete={declare.onSwarmComplete}
      />

      <SectionHeading>Where are you with the admission?</SectionHeading>
      <div className="mb-5 space-y-2">
        <GChoice
          selected={admitStatus === 'unconditional'}
          onClick={() => setAdmitStatus('unconditional')}
          title="I have an unconditional offer"
        />
        <GChoice
          selected={admitStatus === 'conditional'}
          onClick={() => setAdmitStatus('conditional')}
          title="My offer has conditions attached"
          detail="We can still proceed — the conditions get tracked alongside."
        />
        <GChoice
          selected={admitStatus === 'awaiting'}
          onClick={() => setAdmitStatus('awaiting')}
          title="I’m still waiting to hear"
          detail="You can start now and add the offer when it arrives."
        />
      </div>

      <GField
        label="SEVIS ID"
        hint="On your I-20, top right. Leave it blank if you don’t have the I-20 yet."
        htmlFor="ad-sevis"
      >
        <GInput
          id="ad-sevis"
          value={sevis}
          onChange={(e) => setSevis(e.target.value.toUpperCase())}
          placeholder="N0031882745"
          className="num"
        />
      </GField>

      <SectionHeading>Test scores</SectionHeading>
      <GCheckbox id="ad-opt" checked={testOptional} onChange={setTestOptional}>
        My university admitted me without an entrance test
      </GCheckbox>

      {!testOptional ? (
        <div className="mt-2">
          <SmartFill
            app={app}
            match={entranceDoc}
            bucket={SCORECARD_BUCKET}
            noun="your entrance score report"
            onExtracted={applyScores}
            onComplete={scores.onSwarmComplete}
          />
          <SmartFill
            app={app}
            match={LANGUAGE_DOC}
            bucket={SCORECARD_BUCKET}
            noun="your IELTS or TOEFL report"
            onExtracted={applyScores}
            onComplete={scores.onSwarmComplete}
          />
          {TESTS.map((t) => (
            <GField key={t} label={t} htmlFor={`ad-${t}`}>
              <GInput
                id={`ad-${t}`}
                value={tests[t] ?? ''}
                onChange={(e) => setTests({ ...tests, [t]: e.target.value })}
                placeholder="Score, or leave blank"
                className="num"
              />
            </GField>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <Callout tone="support">
            That&rsquo;s fine — plenty of programmes are test-optional now.
            We&rsquo;ll ask for your university&rsquo;s confirmation of it later,
            and a credit officer takes a look rather than it being an automatic
            no.
          </Callout>
        </div>
      )}

      <ActionBar>
        <GButton block onClick={next}>
          Next — add your parent
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-11 · Add your parent
// ---------------------------------------------------------------------------
/** The parent's own PAN, in P1 — NOT the student's identical "PAN" label in E1. */
const COAPP_PAN_DOC = /^PAN$/i
const COAPP_PAN_BUCKET = /^P1$/

export function AddParent({ app }: { app: Application }) {
  const nav = useNavigate()
  const { emit, milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'customer',
  })
  // Every hook runs before the `joined` / `existing` early returns below.
  const declare = useDeclaration(app, {
    section: 'co_applicant',
    group: 'Identity & relationship (P1)',
    backingMatch: COAPP_PAN_DOC,
    backingBucket: COAPP_PAN_BUCKET,
  })
  const createInvite = useSessionStore((s) => s.createInvite)
  const invites = useSessionStore((s) => s.invites)

  const existing = invites.find((i) => i.appId === app.appId && i.kind === 'co_applicant')
  const joined = app.parties.some((p) => p.role === 'co_applicant')

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('Father')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function send() {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Their name as it appears on their PAN.'
    if (mobile.replace(/\D/g, '').length !== 10) e.mobile = 'A 10-digit Indian mobile number.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) e.email = 'An email address they check.'
    setErrors(e)
    if (Object.keys(e).length) return

    const invite = createInvite({
      kind: 'co_applicant',
      appId: app.appId,
      name: name.trim(),
      relationship,
      mobile: `+91${mobile.replace(/\D/g, '')}`,
      email: email.trim(),
      channel,
    })
    // The name the student gives us for their parent, owed against the parent's
    // own PAN. Relationship is deliberately not declared here — a PAN does not
    // state it, the relationship proof in the same bucket does.
    declare.commit([{ key: 'name', label: 'Full name', value: name, fromKey: 'name' }])

    emit(
      'COAPPLICANT_INVITED',
      { name: name.trim(), relationship, channel, inviteId: invite.id },
      invite.id,
    )
    milestone(
      'CO-APPLICANT INVITED',
      `${name.trim()} (${relationship}) invited by ${channel} — link valid ${POLICY.coApplicantInviteDays} days`,
    )
    nav(`/apply/${app.appId}/co-applicant/sent`)
  }

  if (joined) {
    const parent = app.parties.find((p) => p.role === 'co_applicant')
    return (
      <AppShell steps={draftRail('profile')} homeTo="/apply">
        <BackLink to={`/apply/${app.appId}/admission`}>Your admission</BackLink>
        <ScreenTitle title="Your parent has joined" />
        <Callout tone="ok" title={`${parent?.name} is on your application`}>
          They&rsquo;ll do their own verification and share their own documents.
          You won&rsquo;t see those, and they won&rsquo;t see yours.
        </Callout>
        <ActionBar>
          <GButton block onClick={() => nav(`/apply/${app.appId}/security`)}>
            Continue
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  if (existing) {
    return (
      <AppShell steps={draftRail('profile')} homeTo="/apply">
        <BackLink to={`/apply/${app.appId}/admission`}>Your admission</BackLink>
        <ScreenTitle
          title={`We’ve sent ${existing.name} a link`}
          intro={`It's good for ${POLICY.coApplicantInviteDays} days. They’ll verify their own mobile before anything else.`}
        />
        <Callout tone="support" title="What they’ll be asked">
          Their identity, their income documents, and permission to check their
          bank statements, tax records and credit report. Four of those
          permissions can only be given by them — nobody, including us, can grant
          them on their behalf.
        </Callout>
        <ActionBar>
          <GButton block onClick={() => nav(`/apply/${app.appId}/security`)}>
            Continue without waiting
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  return (
    <AppShell steps={draftRail('profile')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/admission`}>Your admission</BackLink>
      <ScreenTitle
        title="Add your parent as co-applicant"
        intro="You’re the borrower, but the bank assesses a parent’s income. They get their own private link — you won’t see their documents or their income figures."
      />

      <SmartFill
        app={app}
        match={COAPP_PAN_DOC}
        bucket={COAPP_PAN_BUCKET}
        noun="their PAN"
        onExtracted={(f) => {
          // Until the parent joins there is no name on file for the reader to
          // return, so this arrives as the placeholder and is skipped rather
          // than filled with the student's own name.
          if (f.name && f.name !== 'as printed') setName(f.name)
        }}
        onComplete={declare.onSwarmComplete}
      />

      <GField label="Their name" error={errors.name} htmlFor="p-name">
        <GInput id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
      </GField>

      <GField label="Their relationship to you" htmlFor="p-rel">
        <GSelect id="p-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
          {['Father', 'Mother', 'Guardian', 'Spouse', 'Sibling'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </GSelect>
      </GField>

      <GField label="Their mobile number" error={errors.mobile} htmlFor="p-mob">
        <div className="flex items-stretch gap-2">
          <span className="num flex min-h-[48px] items-center rounded-xl border border-[var(--grey-300)] bg-[var(--blue-grey)] px-3 text-[15px] text-[var(--grey-600)]">
            +91
          </span>
          <GInput
            id="p-mob"
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="num"
          />
        </div>
      </GField>

      <GField label="Their email" error={errors.email} htmlFor="p-em">
        <GInput id="p-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </GField>

      <SectionHeading>How should we send it?</SectionHeading>
      <div className="mb-4 space-y-2">
        {(
          [
            ['sms', 'Text message'],
            ['whatsapp', 'WhatsApp'],
            ['email', 'Email'],
          ] as const
        ).map(([k, label]) => (
          <GChoice key={k} selected={channel === k} onClick={() => setChannel(k)} title={label} />
        ))}
      </div>

      <ActionBar>
        <GButton block onClick={send}>
          Send to my parent
        </GButton>
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-12 · Security (Tier-3 only)
// ---------------------------------------------------------------------------
export function Security({ app }: { app: Application }) {
  const nav = useNavigate()
  const { emit, milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'customer',
  })
  const createInvite = useSessionStore((s) => s.createInvite)
  const invites = useSessionStore((s) => s.invites)
  const existing = invites.find((i) => i.appId === app.appId && i.kind === 'collateral_provider')

  const [who, setWho] = useState<'family' | 'third_party' | null>(null)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('Uncle')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // §8 — the portal only exists for a Tier-3 file with security. Everything
  // else skips straight to the checklist.
  if (!app.securedConstruct) {
    return (
      <AppShell steps={draftRail('submit')} homeTo="/apply">
        <BackLink to={`/apply/${app.appId}/co-applicant`}>Your parent</BackLink>
        <ScreenTitle
          title="No security needed"
          intro="At the amount you’ve asked for, the bank doesn’t need property or a financial security behind this loan."
        />
        <ActionBar>
          <GButton block onClick={() => nav(`/apply/${app.appId}/submit`)}>
            Continue
          </GButton>
        </ActionBar>
      </AppShell>
    )
  }

  function selfOwned() {
    // The parent (or the student) is the security owner: the C1–C4 documents
    // land in that party's existing list, and no separate portal appears (§8).
    milestone(
      'SECURITY DECLARED — FAMILY',
      'Security offered by the co-applicant; collateral documents added to their list',
      (a) => {
        const parent = a.parties.find((p) => p.role === 'co_applicant')
        if (!a.parties.some((p) => p.role === 'collateral_provider')) {
          a.parties = [
            ...a.parties,
            {
              id: `${a.appId}-COL`,
              role: 'collateral_provider',
              name: parent?.name ?? a.studentName,
              kycStatus: 'not_started',
              kycDetail: 'Same person as the co-applicant',
              bucketIds: a.buckets.filter((b) => b.section === 'collateral').map((b) => b.id),
            },
          ]
        }
      },
    )
    nav(`/apply/${app.appId}/submit`)
  }

  function inviteOwner() {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Their name as it appears on the property papers.'
    if (mobile.replace(/\D/g, '').length !== 10) e.mobile = 'A 10-digit Indian mobile number.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) e.email = 'An email address they check.'
    setErrors(e)
    if (Object.keys(e).length) return

    const invite = createInvite({
      kind: 'collateral_provider',
      appId: app.appId,
      name: name.trim(),
      relationship,
      mobile: `+91${mobile.replace(/\D/g, '')}`,
      email: email.trim(),
      channel: 'sms',
    })
    emit('COLLATERAL_INVITED', { name: name.trim(), relationship, inviteId: invite.id }, invite.id)
    milestone('SECURITY OWNER INVITED', `${name.trim()} (${relationship}) invited to share property details`)
    nav(`/apply/${app.appId}/submit`)
  }

  return (
    <AppShell steps={draftRail('submit')} homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/co-applicant`}>Your parent</BackLink>
      <ScreenTitle
        title="The security behind the loan"
        intro={`Above ${inrShort(POLICY.tierBands.tier2CeilingInr)} the bank asks for property or a financial security. It doesn't have to belong to you.`}
      />

      {existing ? (
        <Callout tone="ok" title={`We’ve sent ${existing.name} a link`}>
          They&rsquo;ll verify their own mobile and share the property papers
          themselves.
        </Callout>
      ) : (
        <>
          <div className="mb-5 space-y-2">
            <GChoice
              selected={who === 'family'}
              onClick={() => setWho('family')}
              title="It belongs to me or my parent"
              detail="The papers get added to that person’s document list."
            />
            <GChoice
              selected={who === 'third_party'}
              onClick={() => setWho('third_party')}
              title="It belongs to someone else"
              detail="They get their own private link, like your parent did."
            />
          </div>

          {who === 'third_party' ? (
            <>
              <GField label="Their name" error={errors.name} htmlFor="s-name">
                <GInput id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
              </GField>
              <GField label="Their relationship to you" htmlFor="s-rel">
                <GSelect id="s-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                  {['Uncle', 'Aunt', 'Grandparent', 'Sibling', 'Family friend', 'Other'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </GSelect>
              </GField>
              <GField label="Their mobile number" error={errors.mobile} htmlFor="s-mob">
                <div className="flex items-stretch gap-2">
                  <span className="num flex min-h-[48px] items-center rounded-xl border border-[var(--grey-300)] bg-[var(--blue-grey)] px-3 text-[15px] text-[var(--grey-600)]">
                    +91
                  </span>
                  <GInput
                    id="s-mob"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="num"
                  />
                </div>
              </GField>
              <GField label="Their email" error={errors.email} htmlFor="s-em">
                <GInput id="s-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </GField>
            </>
          ) : null}

          <GCard tone="support" className="mt-2">
            <p className="text-[14px] leading-[21px]">
              The bank sends its own lawyer and valuer to check the property.
              That part costs you nothing and needs nothing from you.
            </p>
          </GCard>
        </>
      )}

      <ActionBar>
        {existing || who === 'family' ? (
          <GButton block onClick={existing ? () => nav(`/apply/${app.appId}/submit`) : selfOwned}>
            Continue
          </GButton>
        ) : (
          <GButton block disabled={who !== 'third_party'} onClick={inviteOwner}>
            Send them a link
          </GButton>
        )}
      </ActionBar>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// CJ-11a · Invite sent confirmation
// ---------------------------------------------------------------------------
export function ParentInviteSent({ app }: { app: Application }) {
  const nav = useNavigate()
  const invites = useSessionStore((s) => s.invites)
  const invite = invites.find((i) => i.appId === app.appId && i.kind === 'co_applicant')

  return (
    <AppShell steps={draftRail('profile')} homeTo="/apply">
      <ScreenTitle
        title={invite ? `Sent to ${invite.name}` : 'Invitation sent'}
        intro="They’ll get a link to verify themselves and share their details. You can carry on in the meantime."
      />
      <Callout tone="support" title="You won’t see their side">
        Their income, their documents and their credit report stay between them
        and the bank. Your tracker will just say how far along they are.
      </Callout>
      <ActionBar>
        <GButton block onClick={() => nav(`/apply/${app.appId}/security`)}>
          Continue
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
