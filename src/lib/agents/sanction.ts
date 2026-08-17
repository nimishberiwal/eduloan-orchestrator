// ============================================================================
// The sanction swarm (§Phase D) — seven agents in parallel at countersign.
//
// Six produce a `GeneratedDoc`; the seventh writes outreach DRAFTS and sends
// nothing. Like the document swarm, every one is a pure function of the
// application: same file in, same papers out, every time. The staggered timing
// lives in the runtime and nothing here knows about it.
//
// WHAT THESE ARE NOT
// They are not the checklist. `app.documents` are rows we ask the customer to
// COLLECT; these are artifacts the bank PRODUCES. They live in a separate
// container for that reason — putting a paper the bank wrote onto a customer's
// outstanding-items list would be a category error the tracker would faithfully
// render.
//
// EVERY NUMBER IS DERIVED. Nothing here invents a figure: the amount comes off
// the application, the rate and the moratorium off POLICY, the covenants and
// deviations off the file's own collections. Where a value genuinely is not
// known yet, the row says so rather than showing a plausible placeholder.
// ============================================================================
import type { Application, Covenant, GeneratedDoc, GeneratedSection } from '@/types'
import type { AgentFinding, AgentResult } from './types'
import { finding, result } from './runtime'
import { POLICY, DOA_BANDS } from '@/data/policy'
import { effectiveBand } from '@/lib/doa'
import { fmtDate } from '@/lib/format'
import { pendingDeclarationCount } from '@/lib/declared'

// ---- Local formatting ------------------------------------------------------
// Deliberately not imported from journeys/common/glib — that is a component
// module, and a lib that produces credit papers should not pull in React.

function inr(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}
function pct(n: number): string {
  return `${n.toFixed(2)}%`
}
function months(n: number): string {
  return `${n} month${n === 1 ? '' : 's'}`
}
/** The value for a row we cannot answer from the file. Never a plausible
 *  placeholder: a sanction letter showing an invented figure is worse than one
 *  that admits the figure is not set yet. */
const NOT_SET = 'not set on this file'

// ---- Shared derivations ----------------------------------------------------

export interface SanctionTerms {
  principalInr: number
  annualPct: number
  courseMonths: number
  moratoriumMonths: number
  repaymentMonths: number
  emiInr: number
  moratoriumInterestMonthlyInr: number
  totalInterestInr: number
  processingFeeInr: number
  validityDays: number
  sanctionedOn?: string
  validUntil?: string
}

/** Everything the letter, the KFS and the schedule agree on, computed once so
 *  three papers cannot quote three different numbers for the same loan. */
export function sanctionTerms(app: Application): SanctionTerms {
  const principalInr = app.askInr
  const annualPct = POLICY.sanctionRoi.annualPct
  const courseMonths = POLICY.courseMonthsByLevel[app.programLevel] ?? 24
  const moratoriumMonths = courseMonths + POLICY.postCourseMoratoriumMonths
  // A 15-year outer tenor is the working figure for this build; the repayment
  // period is what remains after the moratorium.
  const repaymentMonths = 180 - moratoriumMonths

  const r = annualPct / 100 / 12
  // Standard amortisation. During the moratorium only interest accrues, so the
  // principal entering repayment is the sanctioned amount.
  const emiInr =
    r === 0
      ? principalInr / repaymentMonths
      : (principalInr * r * Math.pow(1 + r, repaymentMonths)) /
        (Math.pow(1 + r, repaymentMonths) - 1)

  const moratoriumInterestMonthlyInr = (principalInr * (annualPct / 100)) / 12
  const totalInterestInr =
    emiInr * repaymentMonths - principalInr + moratoriumInterestMonthlyInr * moratoriumMonths

  return {
    principalInr,
    annualPct,
    courseMonths,
    moratoriumMonths,
    repaymentMonths,
    emiInr,
    moratoriumInterestMonthlyInr,
    totalInterestInr,
    processingFeeInr: Math.max(
      POLICY.processingFee.minInr,
      (principalInr * POLICY.processingFee.pct) / 100,
    ),
    validityDays: POLICY.sanctionValidityDays,
    sanctionedOn: app.sanctionDate,
    validUntil: app.sanctionExpiryDate,
  }
}

function doc(
  app: Application,
  kind: GeneratedDoc['kind'],
  title: string,
  audience: GeneratedDoc['audience'],
  sections: GeneratedSection[],
  producedAt: string,
): GeneratedDoc {
  return { id: `${app.appId}-${kind}`, kind, title, audience, producedAt, sections }
}

function coApplicantName(app: Application): string {
  return app.parties.find((p) => p.role === 'co_applicant')?.name ?? NOT_SET
}

function openCovenants(app: Application): Covenant[] {
  return app.covenants.filter((c) => c.status !== 'cleared')
}

// ---- 1. Credit assessment memo (bank) --------------------------------------

export function runCam(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  const band = effectiveBand(app)
  const openDevs = app.deviations.filter((d) => d.status === 'open')

  const d = doc(app, 'cam', 'Credit assessment memo', 'bank', [
    {
      title: 'The proposal',
      rows: [
        { label: 'Application', value: app.appId },
        { label: 'Borrower', value: app.studentName },
        { label: 'Co-applicant', value: coApplicantName(app) },
        { label: 'Programme', value: `${app.programLevel} · ${app.program}` },
        { label: 'Institution', value: app.university },
        { label: 'Amount', value: inr(t.principalInr) },
      ],
    },
    {
      title: 'Construct',
      rows: [
        // `app.tier` ('Tier-3' | 'Premier-Overlay-Unsecured' | …) is NOT the
        // same vocabulary as `OfferTier` ('tier1'|'tier2'|'tier3') that
        // TIER_LABEL keys on. Two tier scales, one field name; the application's
        // own value is already the one a credit officer reads.
        { label: 'Tier', value: app.tier },
        { label: 'Security', value: app.securedConstruct ? 'Tangible security taken' : 'Unsecured' },
        { label: 'Overlay basis', value: app.overlayBasis ?? 'none applied' },
        {
          label: 'Unsecured ceiling',
          value: app.overlayCeilingInr ? inr(app.overlayCeilingInr) : inr(POLICY.tierBands.tier2CeilingInr),
        },
        { label: 'Income branch', value: app.incomeBranch === 'salaried' ? 'Salaried' : 'Self-employed' },
        { label: 'NRI overlay', value: app.nriOverlay ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Authority',
      rows: [
        { label: 'Decision', value: app.decision ?? NOT_SET },
        { label: 'DoA band', value: band },
        { label: 'Approver', value: DOA_BANDS.approvers[band] ?? band },
        { label: 'Open deviations', value: String(openDevs.length) },
      ],
      note: openDevs.length
        ? openDevs.map((x) => `${x.title} — ${x.rationale}`).join(' · ')
        : undefined,
    },
    {
      title: 'Evidence position',
      rows: [
        { label: 'Documents on file', value: String(app.documents.length) },
        {
          label: 'Verified',
          value: String(app.documents.filter((x) => x.status === 'verified').length),
        },
        { label: 'Validations failed', value: String(app.validations.filter((v) => v.status === 'fail').length) },
        { label: 'Self-declared groups still unevidenced', value: String(pendingDeclarationCount(app)) },
      ],
    },
  ], now)

  const findings: AgentFinding[] = []
  if (openDevs.length > 0) {
    findings.push(
      finding(
        'cam',
        'attention',
        'bank',
        `${openDevs.length} deviation(s) open at countersign`,
        openDevs.map((x) => x.title).join(', '),
      ),
    )
  }
  return result('cam', `Credit file assembled · ${d.sections.length} sections`, findings, { doc: d })
}

// ---- 2. Sanction letter (customer) -----------------------------------------

export function runSanctionLetter(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  const d = doc(app, 'sanction_letter', 'Sanction letter', 'customer', [
    {
      title: 'Your loan',
      rows: [
        { label: 'Sanctioned amount', value: inr(t.principalInr) },
        { label: 'Rate of interest', value: `${pct(t.annualPct)} per year` },
        { label: 'Rate basis', value: POLICY.sanctionRoi.basis },
        { label: 'Margin', value: `${POLICY.marginPct}%` },
        { label: 'Purpose', value: `${app.programLevel} · ${app.program}, ${app.university}` },
      ],
    },
    {
      title: 'When you repay',
      rows: [
        { label: 'Study period', value: months(t.courseMonths) },
        { label: 'Before repayment starts', value: months(t.moratoriumMonths) },
        { label: 'Repayment period', value: months(t.repaymentMonths) },
        { label: 'Monthly instalment after that', value: inr(t.emiInr) },
      ],
      note: POLICY.moratorium,
    },
    {
      title: 'This offer',
      rows: [
        { label: 'Sanctioned on', value: t.sanctionedOn ? fmtDate(t.sanctionedOn) : NOT_SET },
        { label: 'Valid until', value: t.validUntil ? fmtDate(t.validUntil) : NOT_SET },
        { label: 'Valid for', value: `${t.validityDays} days from sanction` },
      ],
    },
  ], now)
  return result('sanction_letter', 'Offer written', [], { doc: d })
}

// ---- 3. Key Facts Statement (customer) -------------------------------------

export function runKfs(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  // APR here is the contracted rate plus the one-off fee spread across the
  // full term. It is stated as computed rather than presented as a regulatory
  // filing — the format is RBI-style, the figures are this prototype's.
  const totalTermMonths = t.moratoriumMonths + t.repaymentMonths
  const feeSpreadPct = (t.processingFeeInr / t.principalInr) * 100 * (12 / totalTermMonths)
  const aprPct = t.annualPct + feeSpreadPct

  const d = doc(app, 'kfs', 'Key Facts Statement', 'customer', [
    {
      title: 'What it costs',
      rows: [
        { label: 'Amount', value: inr(t.principalInr) },
        { label: 'Interest rate', value: `${pct(t.annualPct)} per year` },
        { label: 'Annual percentage rate', value: pct(aprPct) },
        { label: 'Processing fee', value: `${inr(t.processingFeeInr)} (${POLICY.processingFee.pct}%)` },
        { label: 'Total interest over the term', value: inr(t.totalInterestInr) },
        { label: 'Total you repay', value: inr(t.principalInr + t.totalInterestInr) },
      ],
      note: 'The APR includes the processing fee spread across the full term.',
    },
    {
      title: 'The instalments',
      rows: [
        { label: 'During study and the months after', value: `${inr(t.moratoriumInterestMonthlyInr)} interest only` },
        { label: 'After that', value: `${inr(t.emiInr)} a month` },
        { label: 'Number of instalments', value: String(t.repaymentMonths) },
      ],
    },
    {
      title: 'If things go wrong',
      rows: [
        { label: 'Recovery', value: 'The bank contacts you before any recovery step; nothing is outsourced without notice.' },
        { label: 'Grievance', value: 'Raise it with the branch first. If unresolved in 30 days it goes to the Banking Ombudsman.' },
        { label: 'Prepayment', value: 'No charge for prepaying an education loan.' },
      ],
    },
  ], now)
  return result('kfs', `All-in cost set out · APR ${pct(aprPct)}`, [], { doc: d })
}

// ---- 4. Repayment schedule (customer) --------------------------------------

export function runRepaymentSchedule(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  const d = doc(app, 'repayment_schedule', 'Repayment schedule', 'customer', [
    {
      title: `Phase 1 — while you study, and ${months(POLICY.postCourseMoratoriumMonths)} after`,
      rows: [
        { label: 'Length', value: months(t.moratoriumMonths) },
        { label: 'You pay each month', value: inr(t.moratoriumInterestMonthlyInr) },
        { label: 'What that covers', value: 'Interest only. The amount you borrowed is untouched.' },
        {
          label: 'Interest over this phase',
          value: inr(t.moratoriumInterestMonthlyInr * t.moratoriumMonths),
        },
      ],
      note: 'Paying the interest during this phase keeps the balance from growing. If you do not, it is added to what you owe.',
    },
    {
      title: 'Phase 2 — repayment',
      rows: [
        { label: 'Length', value: months(t.repaymentMonths) },
        { label: 'You pay each month', value: inr(t.emiInr) },
        { label: 'Instalments', value: String(t.repaymentMonths) },
        { label: 'Principal repaid', value: inr(t.principalInr) },
        { label: 'Interest paid', value: inr(t.emiInr * t.repaymentMonths - t.principalInr) },
      ],
    },
  ], now)
  return result(
    'repayment_schedule',
    `${months(t.moratoriumMonths)} interest-only, then ${inr(t.emiInr)} a month`,
    [],
    { doc: d },
  )
}

// ---- 5. Conditions & covenants (customer) ----------------------------------

export function runCovenantsSchedule(app: Application, now: string): AgentResult {
  const open = openCovenants(app)
  const d = doc(app, 'covenants_schedule', 'Conditions attached to your offer', 'customer', [
    {
      title: open.length ? 'What still has to happen' : 'Nothing outstanding',
      rows: open.map((c) => ({ label: c.title, value: `by ${c.clearBy}` })),
      note: open.length
        ? 'Each of these has to be satisfied before the money it applies to can move.'
        : 'No conditions are attached to this offer.',
    },
    {
      title: 'Cleared',
      rows: app.covenants
        .filter((c) => c.status === 'cleared')
        .map((c) => ({ label: c.title, value: 'done' })),
    },
  ], now)

  const findings: AgentFinding[] = []
  const breached = app.covenants.filter((c) => c.status === 'breached')
  if (breached.length > 0) {
    findings.push(
      finding(
        'covenants_schedule',
        'attention',
        'bank',
        `${breached.length} covenant(s) breached`,
        breached.map((c) => c.title).join(', '),
      ),
    )
  }
  return result('covenants_schedule', `${open.length} condition(s) outstanding`, findings, { doc: d })
}

// ---- 6. Internal risk note (bank) ------------------------------------------

export function runRiskNote(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  const band = effectiveBand(app)
  const openDevs = app.deviations.filter((d) => d.status === 'open')
  const failed = app.validations.filter((v) => v.status === 'fail')

  const d = doc(app, 'risk_note', 'Internal risk note', 'bank', [
    {
      title: 'Exposure',
      rows: [
        { label: 'Sanctioned', value: inr(t.principalInr) },
        { label: 'Construct', value: app.securedConstruct ? 'Secured' : 'Unsecured' },
        { label: 'Overlay basis', value: app.overlayBasis ?? 'none applied' },
        { label: 'Ceiling relied on', value: app.overlayCeilingInr ? inr(app.overlayCeilingInr) : NOT_SET },
      ],
      note: app.overlayBasis
        ? 'The overlay raised the unsecured ceiling. The basis above is what the file asserts it relied on.'
        : undefined,
    },
    {
      title: 'Deviations',
      rows: openDevs.map((x) => ({ label: x.title, value: `${x.approvalLevel} · ${x.status}` })),
      note: openDevs.length === 0 ? 'None open at countersign.' : undefined,
    },
    {
      title: 'Authority',
      rows: [
        { label: 'DoA band', value: band },
        { label: 'Approver', value: DOA_BANDS.approvers[band] ?? band },
        { label: 'Decision', value: app.decision ?? NOT_SET },
      ],
    },
    {
      title: 'Open checks',
      rows: failed.map((v) => ({ label: v.catalogueId, value: v.message })),
      note: failed.length === 0 ? 'No failed validations at countersign.' : undefined,
    },
  ], now)

  const findings: AgentFinding[] = []
  if (failed.length > 0) {
    findings.push(
      finding(
        'risk_note',
        'attention',
        'bank',
        `${failed.length} validation(s) failing at sanction`,
        failed.map((v) => v.catalogueId).join(', '),
      ),
    )
  }
  return result('risk_note', `Risk position recorded · band ${band}`, findings, { doc: d })
}

// ---- 7. Pre-sanction outreach — DRAFTS ONLY (item 5) -----------------------

export interface OutreachDraft {
  channel: 'Email' | 'SMS' | 'WhatsApp'
  subject: string
  body: string
}

export interface OutreachOutput {
  drafts: OutreachDraft[]
}

/** Writes what we would say. Sends nothing.
 *
 *  The three drafts say the same thing at three lengths, because an SMS that
 *  is a truncated email reads as a mistake. Every figure comes from
 *  `sanctionTerms`, so the message and the letter cannot disagree — a customer
 *  reading "₹40,00,000" in a text and a different number in the letter would
 *  be right not to trust either. */
export function runOutreach(app: Application, now: string): AgentResult {
  const t = sanctionTerms(app)
  const first = app.studentName.split(' ')[0]
  const validity = t.validUntil ? fmtDate(t.validUntil) : `${t.validityDays} days from today`

  const drafts: OutreachDraft[] = [
    {
      channel: 'Email',
      subject: 'Your education loan is sanctioned',
      body:
        `Dear ${first},\n\n` +
        `Your education loan of ${inr(t.principalInr)} for ${app.program} at ${app.university} has been sanctioned.\n\n` +
        `Rate: ${pct(t.annualPct)} a year. You pay interest only while you study and for ${months(POLICY.postCourseMoratoriumMonths)} after, then ${inr(t.emiInr)} a month.\n\n` +
        `This offer is valid until ${validity}. Your sanction letter, Key Facts Statement and repayment schedule are on your application.\n\n` +
        `Horizon Bank`,
    },
    {
      channel: 'SMS',
      subject: 'Loan sanctioned',
      body: `Horizon Bank: your education loan of ${inr(t.principalInr)} is sanctioned. Valid until ${validity}. Your letter and repayment schedule are on your application.`,
    },
    {
      channel: 'WhatsApp',
      subject: 'Loan sanctioned',
      body:
        `Hi ${first} — good news. Your education loan of ${inr(t.principalInr)} for ${app.university} is sanctioned.\n\n` +
        `You pay interest only while you study, then ${inr(t.emiInr)} a month. The offer is valid until ${validity}.\n\n` +
        `Your sanction letter and repayment schedule are on your application.`,
    },
  ]

  void now
  return result(
    'outreach',
    `${drafts.length} message(s) drafted — awaiting an officer`,
    [
      finding(
        'outreach',
        'info',
        'bank',
        'Drafted, not sent',
        'Each message needs an officer to approve it before it goes anywhere.',
      ),
    ],
    { drafts } satisfies OutreachOutput,
  )
}

// ---- The whole swarm, in one call ------------------------------------------

export function runSanctionSwarm(app: Application, now: string): Record<string, AgentResult> {
  return {
    cam: runCam(app, now),
    sanction_letter: runSanctionLetter(app, now),
    kfs: runKfs(app, now),
    repayment_schedule: runRepaymentSchedule(app, now),
    covenants_schedule: runCovenantsSchedule(app, now),
    risk_note: runRiskNote(app, now),
    outreach: runOutreach(app, now),
  }
}

/** The six papers, in the order the pack is read. */
export function docsFromRun(results: Record<string, AgentResult>): GeneratedDoc[] {
  const out: GeneratedDoc[] = []
  for (const r of Object.values(results)) {
    const d = (r.output as { doc?: GeneratedDoc } | undefined)?.doc
    if (d) out.push(d)
  }
  return out
}

export function draftsFromRun(results: Record<string, AgentResult>): OutreachDraft[] {
  return (results.outreach?.output as OutreachOutput | undefined)?.drafts ?? []
}

/** A generated paper as plain text, for `downloadText`. */
export function docToText(d: GeneratedDoc): string {
  const lines: string[] = [d.title, '='.repeat(d.title.length), '']
  for (const s of d.sections) {
    lines.push(s.title, '-'.repeat(s.title.length))
    if (s.rows.length === 0) lines.push('(nothing to show)')
    for (const r of s.rows) lines.push(`${r.label}: ${r.value}`)
    if (s.note) lines.push('', s.note)
    lines.push('')
  }
  lines.push(`Produced ${fmtDate(d.producedAt)} · prototype output, not a bank document.`)
  return lines.join('\n')
}
