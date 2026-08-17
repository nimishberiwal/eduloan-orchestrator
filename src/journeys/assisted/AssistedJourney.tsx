// ============================================================================
// RM-01…RM-09 — the assisted journey (tablet & desktop, 1024px+).
//
// The rule this whole surface is built around (§9.1): an RM may enter data,
// upload documents and progress a file. An RM may NOT perform any act bound to
// the customer's identity. Those controls are PRESENT BUT DISABLED with an
// inline explanation and a single primary action — never hidden, because the
// officer needs to see what is still outstanding.
// ============================================================================
import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { Application, PartyRole } from '@/types'
import type { HandoffReason, Lead } from '@/types/journeys'
import { useStore } from '@/store/appStore'
import {
  HANDOFF_LABEL,
  HANDOFF_WHY,
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_LABEL,
  useSessionStore,
} from '@/store/sessionStore'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  GChoice,
  GField,
  GInput,
  GNumber,
  GSelect,
  GEmpty,
  ScreenTitle,
  SectionHeading,
  inrFull,
  inrShort,
} from '@/journeys/common/glib'
import { Identify } from '@/journeys/auth/Identify'
import { Otp } from '@/journeys/auth/Otp'
import { GlibMark } from '@/journeys/shell/BrandHeader'
import { CONSENT_HANDOFF, handoffPrompt, partyFor } from '@/lib/handoff'
import { buildTasks, collectedHeadline, stageRank } from '@/lib/customerTasks'
import { CONSENT_DEFS } from '@/data/consents'
import { BRANCH_BY_ID, OFFICER_BY_ID, OFFICERS } from '@/data/org'
import { STAGE_NAME } from '@/data/stages'
import { customerFacingStatus } from '@/data/customerMirror'
import { WD_CODES } from '@/data/reasonCodes'
import { evaluateGate } from '@/lib/gating'
import { slaFor } from '@/lib/escalation'
import { daysInStage, fmtDate, sanctionCountdown } from '@/lib/format'
import { startApplication } from '@/journeys/customer/startApplication'
import { useJourney } from '@/journeys/useJourney'

/** The officer this demo signs in as, unless one is chosen at RM sign-in. */
const DEFAULT_OFFICER = 'OFF-SAL-01' // P. Shah, Sales Officer, Mumbai BKC

export function AssistedJourney() {
  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const session = sessions.find((s) => s.id === activeIds.rm)
  const officerId = session?.officerId ?? DEFAULT_OFFICER

  return (
    <Routes>
      <Route
        path="signin"
        element={<Identify partyRole="rm" returnTo="/rm" backTo="/" backLabel="Home" officerId={DEFAULT_OFFICER} />}
      />
      <Route path="otp" element={<Otp />} />
      <Route index element={<RmHome officerId={officerId} />} />
      <Route path="leads" element={<Leads officerId={officerId} />} />
      <Route path="leads/new" element={<NewLead officerId={officerId} />} />
      <Route path="pipeline" element={<Pipeline officerId={officerId} />} />
      <Route path="branch" element={<BranchView officerId={officerId} />} />
      <Route path="apply/:appId/*" element={<OnBehalf officerId={officerId} />} />
      <Route path="*" element={<Navigate to="/rm" replace />} />
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function RmShell({
  children,
  officerId,
  title,
}: {
  children: React.ReactNode
  officerId: string
  title?: string
}) {
  const officer = OFFICER_BY_ID[officerId]
  return (
    <AppShell
      wide
      homeTo="/rm"
      right={
        <span className="flex items-center gap-2">
          {/* §3.4 — the diamond clip is the ONE other permitted use of the
              signature geometry, on the RM avatar. */}
          <span className="glib-diamond flex h-7 w-7 items-center justify-center bg-[var(--glib-blue)] text-[11px] font-bold text-white">
            {officer?.name.replace(/[^A-Z]/g, '').slice(0, 2) ?? 'RM'}
          </span>
          <span className="hidden text-left text-[11px] leading-[14px] text-[var(--grey-600)] sm:block">
            {officer?.name}
            <br />
            <span className="display font-semibold text-[var(--glib-grey)]">{officer?.title}</span>
          </span>
        </span>
      }
    >
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-[var(--blue-grey)] pb-3">
        {[
          ['/rm', 'Today'],
          ['/rm/leads', 'Leads'],
          ['/rm/pipeline', 'My pipeline'],
          ['/rm/branch', 'Branch'],
        ].map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className="min-h-[40px] rounded-lg px-3 py-2 text-[14px] font-semibold text-[var(--grey-600)] hover:bg-[var(--blue-grey)] hover:text-[var(--glib-grey)]"
          >
            {label}
          </Link>
        ))}
      </nav>
      {title ? <ScreenTitle title={title} /> : null}
      {children}
    </AppShell>
  )
}

/** Applications this officer is working. */
function useMyApps(officerId: string): Application[] {
  const apps = useStore((s) => s.applications)
  return useMemo(() => {
    const officer = OFFICER_BY_ID[officerId]
    return apps.filter(
      (a) =>
        a.assignment.officerId === officerId ||
        a.owner.officerId === officerId ||
        (officer && a.owner.officer === officer.name),
    )
  }, [apps, officerId])
}

// ---------------------------------------------------------------------------
// RM-01 · Today
// ---------------------------------------------------------------------------
function RmHome({ officerId }: { officerId: string }) {
  const nav = useNavigate()
  const mine = useMyApps(officerId)
  const leads = useSessionStore((s) => s.leads)
  const handoffs = useSessionStore((s) => s.handoffs)

  const withMe = mine.filter((a) => a.blocker.kind === 'bank' || a.blocker.kind === 'none')
  const withCustomer = mine.filter((a) => a.blocker.kind === 'customer')
  const expiring = mine.filter((a) => {
    const { days, rag } = sanctionCountdown(a.sanctionExpiryDate)
    return rag === 'amber' || (rag === 'red' && days >= 0)
  })
  const breached = mine.filter((a) => slaFor(a).state === 'breached')
  const openHandoffs = handoffs.filter((h) => h.status === 'issued' || h.status === 'opened')

  return (
    <RmShell officerId={officerId} title="Today">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending with me" value={withMe.length} tone="accent" />
        <Stat label="Pending with customer" value={withCustomer.length} />
        <Stat label="Offers expiring" value={expiring.length} tone={expiring.length ? 'warn' : 'neutral'} />
        <Stat label="Past their SLA" value={breached.length} tone={breached.length ? 'stop' : 'neutral'} />
      </div>

      {openHandoffs.length > 0 ? (
        <div className="mb-6">
          <SectionHeading>Waiting on a customer to finish</SectionHeading>
          <ul className="space-y-2">
            {openHandoffs.map((h) => (
              <li key={h.id}>
                <GCard tone="support">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">
                      {HANDOFF_LABEL[h.reason]} · {h.appId}
                    </span>
                    <GChip tone={h.status === 'opened' ? 'accent' : 'neutral'}>
                      {h.status === 'opened' ? 'They’ve opened it' : 'Sent, not opened'}
                    </GChip>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--grey-600)]">
                    {h.mode === 'in_branch' ? 'Handed over in branch' : `Sent by ${h.channel}`} ·
                    expires {fmtDate(h.expiresAt)}
                  </p>
                </GCard>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SectionHeading>Files with me</SectionHeading>
      {withMe.length === 0 ? (
        <GEmpty title="Nothing sitting with you">
          Everything on your desk is either done or waiting on someone else.
        </GEmpty>
      ) : (
        <ul className="mb-6 space-y-2">
          {withMe.slice(0, 8).map((a) => (
            <AppRow key={a.appId} app={a} onOpen={() => nav(`/rm/apply/${a.appId}/summary`)} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <GButton onClick={() => nav('/rm/leads/new')}>Capture a new lead</GButton>
        <GButton tone="secondary" onClick={() => nav('/rm/leads')}>
          My leads ({leads.length})
        </GButton>
      </div>
    </RmShell>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'accent' | 'warn' | 'stop'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--blue-grey)]',
    accent: 'bg-[var(--blue-100)]',
    warn: 'bg-[#fdf6ea]',
    stop: 'bg-[#fdf3f2]',
  }
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <p className="num display text-[26px] font-bold leading-8">{value}</p>
      <p className="text-[13px] leading-[18px] text-[var(--grey-600)]">{label}</p>
    </div>
  )
}

function AppRow({ app, onOpen }: { app: Application; onOpen: () => void }) {
  const days = daysInStage(app.stageEnteredAt)
  const sla = slaFor(app).state
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--grey-300)] bg-white p-3.5 text-left hover:border-[var(--glib-blue)] hover:bg-[var(--blue-100)]/40"
      >
        <span className="min-w-0">
          <span className="num block text-[13px] font-semibold text-[var(--grey-600)]">
            {app.appId}
          </span>
          <span className="display block text-[15px] font-semibold leading-[21px]">
            {app.studentName} · {app.universityShort}
          </span>
          <span className="block text-[13px] text-[var(--grey-600)]">
            {STAGE_NAME[String(app.stage)]} · {days} day{days === 1 ? '' : 's'} here
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {sla === 'breached' ? <GChip tone="stop">Past SLA</GChip> : null}
          {app.blocker.kind === 'customer' ? <GChip tone="warn">With customer</GChip> : null}
          <span className="num text-[15px] font-bold">{inrShort(app.askInr)}</span>
        </span>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// RM-02 · Leads
// ---------------------------------------------------------------------------
function Leads({ officerId }: { officerId: string }) {
  const nav = useNavigate()
  const leads = useSessionStore((s) => s.leads)
  const setLeadStatus = useSessionStore((s) => s.setLeadStatus)
  const convertLead = useSessionStore((s) => s.convertLead)
  const createJourneyApplication = useStore((s) => s.createJourneyApplication)
  const officer = OFFICER_BY_ID[officerId]

  const [dropping, setDropping] = useState<string | null>(null)

  function convert(lead: Lead) {
    const appId = startApplication({
      create: createJourneyApplication,
      studentName: lead.studentName,
      officerId,
      branchId: officer?.branchId,
      actor: {
        kind: 'rm',
        officerId,
        onBehalfOf: 'applicant',
        sessionId: 'SES-RM',
      },
    })
    convertLead(lead.id, appId)
    nav(`/rm/apply/${appId}/summary`)
  }

  return (
    <RmShell officerId={officerId} title="Leads">
      <div className="mb-4">
        <GButton onClick={() => nav('/rm/leads/new')}>Capture a new lead</GButton>
      </div>

      {leads.length === 0 ? (
        <GEmpty title="No leads captured yet">
          A lead takes about sixty seconds to capture and can be converted into a
          full application at any point.
        </GEmpty>
      ) : (
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l.id}>
              <GCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="num text-[12px] font-semibold text-[var(--grey-600)]">{l.id}</p>
                    <p className="display text-[16px] font-semibold leading-[22px]">
                      {l.studentName}
                    </p>
                    <p className="num text-[13px] text-[var(--grey-600)]">
                      {l.mobile} · {LEAD_SOURCE_LABEL[l.source]}
                      {l.indicativeAskInr ? ` · ${inrShort(l.indicativeAskInr)}` : ''}
                    </p>
                  </div>
                  <GChip
                    tone={
                      l.status === 'converted'
                        ? 'ok'
                        : l.status === 'dropped'
                          ? 'stop'
                          : l.status === 'new'
                            ? 'accent'
                            : 'neutral'
                    }
                  >
                    {LEAD_STATUS_LABEL[l.status]}
                  </GChip>
                </div>

                {l.dropReason ? (
                  <p className="mt-2 text-[13px] text-[var(--grey-600)]">{l.dropReason}</p>
                ) : null}

                {dropping === l.id ? (
                  <div className="mt-3">
                    <GField label="Why is it dropping?" htmlFor={`d-${l.id}`}>
                      <GSelect
                        id={`d-${l.id}`}
                        onChange={(e) => {
                          setLeadStatus(l.id, 'dropped', e.target.value)
                          setDropping(null)
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Choose a reason
                        </option>
                        {WD_CODES.map((c) => (
                          <option key={c.id} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </GSelect>
                    </GField>
                  </div>
                ) : null}

                {l.status !== 'converted' && l.status !== 'dropped' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GButton size="sm" onClick={() => convert(l)}>
                      Start an application
                    </GButton>
                    <GButton
                      size="sm"
                      tone="secondary"
                      onClick={() => setLeadStatus(l.id, l.status === 'new' ? 'contacted' : 'qualified')}
                    >
                      {l.status === 'new' ? 'Mark as contacted' : 'Mark as qualified'}
                    </GButton>
                    <GButton size="sm" tone="quiet" onClick={() => setDropping(l.id)}>
                      Drop
                    </GButton>
                  </div>
                ) : l.appId ? (
                  <div className="mt-3">
                    <GButton size="sm" tone="secondary" onClick={() => nav(`/rm/apply/${l.appId}/summary`)}>
                      Open {l.appId}
                    </GButton>
                  </div>
                ) : null}
              </GCard>
            </li>
          ))}
        </ul>
      )}
    </RmShell>
  )
}

// ---------------------------------------------------------------------------
// RM-03 · New lead — 60-second capture, dedupe on mobile
// ---------------------------------------------------------------------------
function NewLead({ officerId }: { officerId: string }) {
  const nav = useNavigate()
  const captureLead = useSessionStore((s) => s.captureLead)
  const officer = OFFICER_BY_ID[officerId]

  const [studentName, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<Lead['source']>('walk_in')
  const [ask, setAsk] = useState<number>(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dupe, setDupe] = useState<string | null>(null)

  function save() {
    const e: Record<string, string> = {}
    if (studentName.trim().length < 2) e.name = 'The student’s name.'
    if (mobile.replace(/\D/g, '').length !== 10) e.mobile = 'A 10-digit Indian mobile number.'
    setErrors(e)
    if (Object.keys(e).length) return

    const res = captureLead({
      studentName: studentName.trim(),
      mobile: `+91${mobile.replace(/\D/g, '')}`,
      email: email.trim(),
      source,
      indicativeAskInr: ask || undefined,
      capturedBy: officerId,
      branchId: officer?.branchId ?? 'BR-MUM-BKC',
    })
    if (!res.ok) {
      setDupe(res.message)
      return
    }
    nav('/rm/leads')
  }

  return (
    <RmShell officerId={officerId} title="Capture a lead">
      <BackLink to="/rm/leads">Leads</BackLink>
      <div className="max-w-[520px]">
        {dupe ? (
          <div className="mb-4">
            <Callout tone="warn" title="We already have this number">
              {dupe}
            </Callout>
          </div>
        ) : null}

        <GField label="Student’s name" error={errors.name} htmlFor="l-name">
          <GInput id="l-name" value={studentName} onChange={(e) => setName(e.target.value)} />
        </GField>

        <GField label="Mobile" error={errors.mobile} htmlFor="l-mob">
          <div className="flex items-stretch gap-2">
            <span className="num flex min-h-[48px] items-center rounded-xl border border-[var(--grey-300)] bg-[var(--blue-grey)] px-3 text-[15px] text-[var(--grey-600)]">
              +91
            </span>
            <GInput
              id="l-mob"
              inputMode="numeric"
              maxLength={10}
              value={mobile}
              onChange={(e) => {
                setDupe(null)
                setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
              }}
              className="num"
            />
          </div>
        </GField>

        <GField label="Email" htmlFor="l-em">
          <GInput id="l-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </GField>

        <GField label="Where did they come from?" htmlFor="l-src">
          <GSelect
            id="l-src"
            value={source}
            onChange={(e) => setSource(e.target.value as Lead['source'])}
          >
            {(Object.keys(LEAD_SOURCE_LABEL) as Lead['source'][]).map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABEL[s]}
              </option>
            ))}
          </GSelect>
        </GField>

        <GField label="Roughly how much do they need?" hint="Optional" htmlFor="l-ask">
          <GNumber id="l-ask" prefix="₹" value={ask} onValue={setAsk} />
        </GField>

        <ActionBar>
          <GButton block onClick={save}>
            Save this lead
          </GButton>
        </ActionBar>
      </div>
    </RmShell>
  )
}

// ---------------------------------------------------------------------------
// RM-04 · My pipeline — reuses the dashboard's stage/blocker/RAG language
// ---------------------------------------------------------------------------
function Pipeline({ officerId }: { officerId: string }) {
  const nav = useNavigate()
  const mine = useMyApps(officerId)
  const byStage = useMemo(() => {
    const m = new Map<string, Application[]>()
    for (const a of mine) {
      const k = String(a.stage)
      m.set(k, [...(m.get(k) ?? []), a])
    }
    return [...m.entries()].sort((a, b) => stageRank(a[0] as never) - stageRank(b[0] as never))
  }, [mine])

  return (
    <RmShell officerId={officerId} title="My pipeline">
      {mine.length === 0 ? (
        <GEmpty title="No files assigned to you">
          Convert a lead and it will appear here.
        </GEmpty>
      ) : (
        byStage.map(([stage, apps]) => (
          <section key={stage} className="mb-6">
            <SectionHeading>
              {STAGE_NAME[stage] ?? stage}{' '}
              <span className="num font-normal text-[var(--grey-600)]">({apps.length})</span>
            </SectionHeading>
            <ul className="space-y-2">
              {apps.map((a) => (
                <AppRow key={a.appId} app={a} onOpen={() => nav(`/rm/apply/${a.appId}/summary`)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </RmShell>
  )
}

// ---------------------------------------------------------------------------
// RM-09 · Branch view (branch manager only)
// ---------------------------------------------------------------------------
function BranchView({ officerId }: { officerId: string }) {
  const officer = OFFICER_BY_ID[officerId]
  const apps = useStore((s) => s.applications)
  const leads = useSessionStore((s) => s.leads)
  const branch = officer ? BRANCH_BY_ID[officer.branchId] : undefined

  // A manager is anyone with people reporting to them.
  const team = OFFICERS.filter((o) => o.managerId === officerId)
  const isManager = team.length > 0

  if (!isManager) {
    return (
      <RmShell officerId={officerId} title="Branch">
        <Callout tone="support" title="This view is for branch managers">
          Your own files are under &ldquo;My pipeline&rdquo;. If you think you
          should see the branch numbers, your manager can arrange it.
        </Callout>
      </RmShell>
    )
  }

  const branchApps = apps.filter((a) => a.branchId === officer?.branchId)
  const branchLeads = leads.filter((l) => l.branchId === officer?.branchId)
  const converted = branchLeads.filter((l) => l.status === 'converted').length

  return (
    <RmShell officerId={officerId} title={branch?.name ?? 'Branch'}>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live applications" value={branchApps.length} tone="accent" />
        <Stat label="Leads captured" value={branchLeads.length} />
        <Stat label="Converted" value={converted} tone={converted ? 'accent' : 'neutral'} />
        <Stat label="Officers" value={team.length} />
      </div>

      <SectionHeading>Officers</SectionHeading>
      <ul className="space-y-2">
        {team.map((o) => {
          const theirs = apps.filter((a) => a.assignment.officerId === o.id)
          const aged = theirs.filter((a) => daysInStage(a.stageEnteredAt) > 7).length
          return (
            <li key={o.id}>
              <GCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="display text-[15px] font-semibold">{o.name}</p>
                    <p className="text-[13px] text-[var(--grey-600)]">{o.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <GChip tone="neutral">{theirs.length} files</GChip>
                    {aged > 0 ? <GChip tone="warn">{aged} ageing</GChip> : null}
                  </div>
                </div>
              </GCard>
            </li>
          )
        })}
      </ul>
    </RmShell>
  )
}

// ---------------------------------------------------------------------------
// RM-05…RM-08 · On behalf of a customer
// ---------------------------------------------------------------------------
function OnBehalf({ officerId }: { officerId: string }) {
  const { appId } = useParams()
  const app = useStore((s) => s.applications.find((a) => a.appId === appId))

  if (!app) {
    return (
      <RmShell officerId={officerId} title="File not found">
        <Callout tone="support">That application isn&rsquo;t on this system.</Callout>
      </RmShell>
    )
  }

  return (
    <Routes>
      <Route index element={<Navigate to="summary" replace />} />
      <Route path="summary" element={<FileSummary app={app} officerId={officerId} />} />
      <Route path="handoff" element={<HandoffDesk app={app} officerId={officerId} />} />
      <Route path="docs" element={<CollectDocs app={app} officerId={officerId} />} />
      {/* ABSOLUTE, deliberately. `to="summary"` here resolves relative to the
          CURRENT location, not to the route pattern — so an unknown path like
          /rm/apply/:id/tasks redirected to /rm/apply/:id/tasks/summary, which
          did not match `summary` either, so this catch-all fired again, and
          again: a redirect loop that appended a segment each time and built a
          URL hundreds of levels deep. The `index` route above is relative and
          correct, because at the index the location IS the parent.

          The guard on this screen still held throughout — no assisted route
          reached an identity-bound screen — which is why nobody noticed. */}
      <Route path="*" element={<Navigate to={`/rm/apply/${appId}/summary`} replace />} />
    </Routes>
  )
}

// ---- RM-08 · File summary --------------------------------------------------
function FileSummary({ app, officerId }: { app: Application; officerId: string }) {
  const nav = useNavigate()
  const gate = evaluateGate(app)
  const h = collectedHeadline(app)
  const student = buildTasks(app, 'applicant').filter((t) => t.blocking).length
  const parent = buildTasks(app, 'co_applicant').filter((t) => t.blocking).length

  return (
    <RmShell officerId={officerId}>
      <BackLink to="/rm/pipeline">My pipeline</BackLink>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="num text-[13px] font-semibold text-[var(--grey-600)]">{app.appId}</p>
          <h1 className="display text-[24px] font-bold leading-[30px]">{app.studentName}</h1>
          <p className="text-[14px] text-[var(--grey-600)]">
            {app.program} · {app.university}
          </p>
        </div>
        <div className="text-right">
          <p className="num display text-[22px] font-bold">{inrFull(app.askInr)}</p>
          <p className="text-[13px] text-[var(--grey-600)]">{STAGE_NAME[String(app.stage)]}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Documents in" value={h.collected} tone="accent" />
        <Stat label="Still needed" value={h.needsYou} tone={h.needsYou ? 'warn' : 'neutral'} />
        <Stat label="With the student" value={student} />
        <Stat label="With the parent" value={parent} />
      </div>

      <SectionHeading>What&rsquo;s blocking</SectionHeading>
      {gate && !gate.passed ? (
        <ul className="mb-4 space-y-2">
          {gate.failures.map((f) => (
            <li key={f.id}>
              <GCard tone="warn">
                <p className="text-[14px] font-semibold leading-[21px]">{f.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--grey-600)]">{f.message}</p>
              </GCard>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4">
          <Callout tone="ok">
            Nothing is failing the gate for {STAGE_NAME[String(app.stage)]}.
          </Callout>
        </div>
      )}

      <SectionHeading>The customer sees</SectionHeading>
      <GCard tone="support" className="mb-4">
        <p className="text-[15px] leading-[22px]">{customerFacingStatus(app)}</p>
      </GCard>

      {/* A READ-ONLY mirror of the customer's list. Deliberately not a link
          into /apply/:id — an assisted session must not be able to reach an
          Aadhaar, AA, e-sign or NACH screen by any route (acceptance item 15).
          What the officer needs is to SEE the list, not to walk it. */}
      <SectionHeading>On the customer&rsquo;s list right now</SectionHeading>
      <ul className="mb-6 space-y-1.5">
        {[
          ...buildTasks(app, 'applicant').map((t) => ['Student', t] as const),
          ...buildTasks(app, 'co_applicant').map((t) => ['Co-applicant', t] as const),
        ].map(([who, t]) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-1">
            <GChip tone="neutral">{who}</GChip>
            <span className="text-[14px] leading-[21px]">{t.title}</span>
            {t.blocking ? <GChip tone="warn">Blocking</GChip> : null}
          </li>
        ))}
        {buildTasks(app, 'applicant').length + buildTasks(app, 'co_applicant').length === 0 ? (
          <li className="text-[14px] text-[var(--grey-600)]">
            Nothing outstanding with either of them.
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap gap-2">
        <GButton onClick={() => nav(`/rm/apply/${app.appId}/handoff`)}>
          Hand something to the customer
        </GButton>
        <GButton tone="secondary" onClick={() => nav(`/rm/apply/${app.appId}/docs`)}>
          Collect documents
        </GButton>
      </div>
    </RmShell>
  )
}

// ---- RM-06 · Hand off to the customer -------------------------------------
function HandoffDesk({ app, officerId }: { app: Application; officerId: string }) {
  const nav = useNavigate()
  const issueHandoff = useSessionStore((s) => s.issueHandoff)
  const handoffs = useSessionStore((s) => s.handoffs)
  const { milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'assisted',
    onBehalfOfficerId: officerId,
  })

  const [mode, setMode] = useState<'remote_link' | 'in_branch'>('remote_link')
  const [channel, setChannel] = useState<'sms' | 'email' | 'whatsapp'>('sms')
  const [issued, setIssued] = useState<string | null>(null)

  // Every outstanding consent is an identity-bound act, and therefore a handoff.
  const outstanding = CONSENT_DEFS.filter((def) => {
    const c = app.consents.find((x) => x.type === def.type)
    return !c || (c.status !== 'granted' && c.status !== 'declined')
  })

  const nonConsent: HandoffReason[] = []
  if (app.stage === 'S11') nonConsent.push('sanction_acceptance')
  if (app.stage === 'S12') nonConsent.push('esign_agreement', 'nach_mandate')

  function issue(reason: HandoffReason) {
    const forParty: PartyRole = partyFor(reason)
    const h = issueHandoff({
      appId: app.appId,
      forParty,
      reason,
      mode,
      channel: mode === 'remote_link' ? channel : undefined,
      issuedBy: officerId,
      returnTo: `/rm/apply/${app.appId}/handoff`,
    })
    milestone(
      'HANDOFF ISSUED',
      `${HANDOFF_LABEL[reason]} handed to the ${forParty.replace('_', '-')} — ${
        mode === 'in_branch' ? 'device handed over in branch' : `link sent by ${channel}`
      }`,
    )
    setIssued(h.token)
    if (mode === 'in_branch') nav(`/handoff/${h.token}`)
  }

  const party = (r: HandoffReason) => partyFor(r)
  const nameFor = (r: HandoffReason) =>
    app.parties.find((p) => p.role === party(r))?.name ?? app.studentName

  return (
    <RmShell officerId={officerId} title="Hand this to the customer">
      <BackLink to={`/rm/apply/${app.appId}/summary`}>{app.appId}</BackLink>

      <Callout tone="support" title="Why you can’t just do this yourself">
        These steps are bound to the customer&rsquo;s identity. Aadhaar sends its
        code to their phone; a consent is an assertion by a named person; a
        signature is legally theirs. There is no version of this you can fill in
        on their behalf, and pretending otherwise would make the audit trail a
        fiction.
      </Callout>

      <div className="mt-5">
        <SectionHeading>How are you handing it over?</SectionHeading>
        <div className="mb-4 space-y-2 max-w-[520px]">
          <GChoice
            selected={mode === 'in_branch'}
            onClick={() => setMode('in_branch')}
            title="Hand over this device"
            detail={`They complete it here and hand it back. The link dies in 30 minutes.`}
          />
          <GChoice
            selected={mode === 'remote_link'}
            onClick={() => setMode('remote_link')}
            title="Send them a link"
            detail="They do it on their own phone, in their own time. Good for 24 hours."
          />
        </div>

        {mode === 'remote_link' ? (
          <div className="mb-4 max-w-[320px]">
            <GField label="Send it by" htmlFor="ho-ch">
              <GSelect
                id="ho-ch"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="sms">Text message</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </GSelect>
            </GField>
          </div>
        ) : null}
      </div>

      {issued ? (
        <div className="mb-5">
          <Callout tone="ok" title="Sent">
            The link is in the &ldquo;Links issued&rdquo; tray at the top right.
            This screen updates as soon as they finish.
          </Callout>
        </div>
      ) : null}

      <SectionHeading>What&rsquo;s outstanding</SectionHeading>
      <ul className="space-y-2">
        {outstanding.map((def) => {
          const reason = CONSENT_HANDOFF[def.type]
          const live = handoffs.find(
            (h) => h.appId === app.appId && h.reason === reason && h.status !== 'expired',
          )
          return (
            <li key={def.type}>
              <IdentityBoundRow
                title={HANDOFF_LABEL[reason]}
                why={HANDOFF_WHY[reason]}
                prompt={handoffPrompt(reason, nameFor(reason))}
                who={nameFor(reason)}
                status={live?.status}
                onHand={() => issue(reason)}
              />
            </li>
          )
        })}
        {nonConsent.map((reason) => {
          const live = handoffs.find(
            (h) => h.appId === app.appId && h.reason === reason && h.status !== 'expired',
          )
          return (
            <li key={reason}>
              <IdentityBoundRow
                title={HANDOFF_LABEL[reason]}
                why={HANDOFF_WHY[reason]}
                prompt={handoffPrompt(reason, nameFor(reason))}
                who={nameFor(reason)}
                status={live?.status}
                onHand={() => issue(reason)}
              />
            </li>
          )
        })}
      </ul>
      {outstanding.length === 0 && nonConsent.length === 0 ? (
        <GEmpty title="Nothing identity-bound outstanding">
          Every permission this file needs has been given or declined.
        </GEmpty>
      ) : null}
    </RmShell>
  )
}

/** §9.2 — present but DISABLED, with an inline explanation and ONE primary
 *  action. Never hidden: the officer needs to see what is outstanding. */
function IdentityBoundRow({
  title,
  why,
  prompt,
  who,
  status,
  onHand,
}: {
  title: string
  why: string
  prompt: string
  who: string
  status?: string
  onHand: () => void
}) {
  return (
    <GCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-[16px] font-semibold leading-[22px]">{title}</p>
          <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">{prompt}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--grey-600)]">{why}</p>
        </div>
        {status ? (
          <GChip tone={status === 'completed' ? 'ok' : 'accent'}>
            {status === 'completed'
              ? 'Done'
              : status === 'opened'
                ? 'They’ve opened it'
                : 'Sent'}
          </GChip>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* The control the officer would want, shown and disabled. */}
        <GButton size="sm" tone="secondary" disabled title="Only the customer can do this">
          <GlibMark size={13} /> Do it here
        </GButton>
        <GButton size="sm" onClick={onHand}>
          Hand to {who.split(' ')[0]}
        </GButton>
      </div>
    </GCard>
  )
}

// ---- RM-07 · Collect documents on behalf ----------------------------------
function CollectDocs({ app, officerId }: { app: Application; officerId: string }) {
  const nav = useNavigate()
  const uploadDocument = useStore((s) => s.uploadDocument)
  const [done, setDone] = useState<string[]>([])

  // An RM CAN upload documents — that is not identity-bound. Attribution says
  // who actually did it (§9.5).
  const outstanding = app.documents.filter(
    (d) => d.status === 'requested' && d.sourcing === 'manual_upload',
  )

  function upload(docId: string, label: string) {
    uploadDocument(app.appId, docId, {
      fileName: `branch-scan-${docId}.pdf`,
      sizeKb: 420,
      actor: {
        kind: 'rm',
        officerId,
        onBehalfOf: 'applicant',
        sessionId: 'SES-RM',
      },
    })
    setDone((d) => [...d, docId])
    void label
  }

  return (
    <RmShell officerId={officerId} title="Collect documents">
      <BackLink to={`/rm/apply/${app.appId}/summary`}>{app.appId}</BackLink>

      <Callout tone="support" title="Attribution">
        Anything you scan here is recorded as collected by you on the
        customer&rsquo;s behalf, not as something they sent in. The audit trail
        keeps the two apart.
      </Callout>

      <div className="mt-5">
        <SectionHeading>Outstanding uploads ({outstanding.length})</SectionHeading>
        {outstanding.length === 0 ? (
          <GEmpty title="Nothing left to scan">
            Everything a customer has to physically provide is in.
          </GEmpty>
        ) : (
          <ul className="space-y-2">
            {outstanding.map((d) => (
              <li key={d.id}>
                <GCard>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-[21px]">{d.label}</p>
                      <p className="text-[13px] text-[var(--grey-600)]">
                        {d.mandate === 'M' ? 'Needed' : d.mandate === 'C' ? 'If applicable' : 'Optional'}
                      </p>
                    </div>
                    <GButton
                      size="sm"
                      disabled={done.includes(d.id)}
                      onClick={() => upload(d.id, d.label)}
                    >
                      {done.includes(d.id) ? 'Scanned' : 'Scan to file'}
                    </GButton>
                  </div>
                </GCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <GButton tone="secondary" onClick={() => nav(`/rm/apply/${app.appId}/summary`)}>
          Back to the file
        </GButton>
      </div>
    </RmShell>
  )
}
