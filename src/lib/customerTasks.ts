// ============================================================================
// The projection (§10) — THE heart of the build.
//
// 22 buckets · 126 templates · 5 sourcing modes · 7 consents · 73 validations,
// turned into a short ordered list a person can actually finish.
//
// Pure: no React, no store. Given an Application and a party, it returns the
// same tasks every time. That is what makes /__dev/tasks a real proof rather
// than a screenshot.
// ============================================================================
import type {
  Application,
  ConsentType,
  DocumentItem,
  PartyRole,
  PartySection,
  RequiredByStage,
  Stage,
} from '@/types'
import type { CustomerTask, TaskKind } from '@/types/journeys'
import { CONSENT_BY_TYPE } from '@/data/consents'
import { POLICY } from '@/data/policy'
import { bucketCopy, CONSENT_COPY, sectionsFor } from '@/journeys/copy'
import { isBlockedOnConsent } from '@/lib/sourcing'
import { customerFixableFailures, sendBackCopy } from '@/lib/plainLanguage'
import { nowIso } from '@/lib/clock'

// ---- Stage helpers ---------------------------------------------------------

export function stageRank(stage: Stage): number {
  const m = /^S(\d\d)$/.exec(String(stage))
  if (m) return parseInt(m[1], 10)
  // Terminals sit past the end of the line.
  return String(stage) === 'DISBURSED_ACTIVE' ? 14 : 99
}

/** §10.1 rule 2 — when a bucket's documents start being ASKED FOR.
 *
 *  Deliberately one step ahead of the internal gate: a customer asked for a
 *  document only at the stage that blocks on it has no time to find it. A visa
 *  document (`disbursement_t1`) still cannot appear during S04, which is the
 *  constraint the rule exists to enforce. */
const ASK_FROM_STAGE: Record<RequiredByStage, number> = {
  kyc: 2, // identity, from the moment capture is underway
  sanction: 3, // the main checklist, alongside KYC
  documentation: 11, // mandate & signing, once sanctioned
  disbursement_t1: 12, // visa & charge creation, once documentation starts
  disbursement_living: 12,
}

// ---- Effort estimates ------------------------------------------------------
// Rendered as "about 2 minutes" — an honest estimate, never a countdown.

const CONSENT_SECONDS_FULL = 120
const CONSENT_SECONDS_TAP = 40
const UPLOAD_SECONDS_PER_DOC = 55
const FORM_SECONDS = 180

/** A document has arrived (or been excused) and must never produce a task. */
const SETTLED: DocumentItem['status'][] = [
  'uploaded',
  'fetched',
  'extracted',
  'qc_pass',
  'verified',
  'waived',
]

/** A document the customer has to REDO — sent back, or failed quality check. */
const REDO: DocumentItem['status'][] = ['rejected', 'qc_fail']

export function isSettled(d: DocumentItem): boolean {
  return SETTLED.includes(d.status)
}
export function isRedo(d: DocumentItem): boolean {
  return REDO.includes(d.status)
}

// ---- The projection --------------------------------------------------------

export function buildTasks(
  app: Application,
  forParty: PartyRole,
  now: string = nowIso(),
): CustomerTask[] {
  const sections = sectionsFor(forParty)
  const sectionOf = new Map<string, PartySection>()
  const gateOf = new Map<string, RequiredByStage>()
  const codeOf = new Map<string, string>()
  for (const b of app.buckets) {
    sectionOf.set(b.id, b.section)
    gateOf.set(b.id, b.requiredByStage)
    codeOf.set(b.id, b.code)
  }
  const rank = stageRank(app.stage)

  /** Rule 1 (party) + rule 2 (milestone), applied once. */
  function inScope(d: DocumentItem): boolean {
    const sec = sectionOf.get(d.bucketId)
    if (!sec || !sections.includes(sec)) return false
    const gate = gateOf.get(d.bucketId)
    if (!gate) return false
    return rank >= ASK_FROM_STAGE[gate]
  }

  const mine = app.documents.filter(inScope)
  const tasks: CustomerTask[] = []

  // -- 1. Send-backs and quality failures come first (rule 5) ---------------
  //
  // An Ops send-back does not necessarily reject a NAMED document — `sendBack`
  // moves the stage and sets the blocker with a reason code. If the projection
  // only watched document status, the most urgent thing that can happen to a
  // file would produce no customer task at all. So the send-back itself is a
  // task, translated through the reason code (§10.1 rule 6).
  const sentBack = latestSendBack(app)
  if (sentBack && app.blocker.kind === 'customer' && forParty === 'applicant') {
    tasks.push({
      id: `${app.appId}:review:sendback:${sentBack.id}`,
      appId: app.appId,
      forParty,
      kind: 'review',
      title: 'The bank needs something looked at again',
      // The reason CODE never renders — only this sentence does.
      why:
        sendBackCopy(sentBack.reasonCode) ??
        'The bank has read your documents and needs one of them again.',
      blocking: true,
      origin: 'send_back',
      raisedAt: sentBack.ts,
      estSeconds: 120,
      route: 'action',
    })
  }

  // A document the bank pushed back is the most urgent thing on the list, and
  // it is styled as needing attention wherever it renders (§10.1 rule 6).
  for (const d of mine.filter(isRedo)) {
    tasks.push({
      id: `${app.appId}:upload:redo:${d.id}`,
      appId: app.appId,
      forParty,
      kind: 'upload',
      title: `Replace ${lower(d.label)}`,
      why: d.reason
        ? plainSendBack(d.reason)
        : 'The copy we have can’t be read clearly enough to use.',
      detail: d.label,
      docIds: [d.id],
      blocking: true,
      origin: 'send_back',
      raisedAt: now,
      estSeconds: UPLOAD_SECONDS_PER_DOC,
      route: `capture/${d.id}`,
    })
  }

  // -- 2. Validation failures the customer can actually fix (§13) -----------
  for (const f of customerFixableFailures(app)) {
    // Only surface it to the party who owns the documents it points at.
    const targets = f.targetDocIds.filter((id) => mine.some((d) => d.id === id))
    if (f.targetDocIds.length > 0 && targets.length === 0) continue
    if (forParty !== 'applicant' && f.targetDocIds.length === 0) continue
    tasks.push({
      id: `${app.appId}:review:${f.id}`,
      appId: app.appId,
      forParty,
      kind: 'review',
      title: f.title,
      why: f.body,
      docIds: targets,
      blocking: true,
      origin: 'validation',
      raisedAt: now,
      estSeconds: 90,
      route: `fix/${f.id}`,
    })
  }

  // -- 3. Consent asks (rule 3) ---------------------------------------------
  // ONE task per consent artifact, not per document. A single approval can
  // clear eleven rows, and that is the whole point of the category.
  const outstanding = mine.filter((d) => d.status === 'requested')
  const consentTypes = new Set<ConsentType>()
  for (const d of outstanding) {
    if (d.sourcing === 'consent_fetch' && d.consentType) consentTypes.add(d.consentType)
  }
  for (const type of consentTypes) {
    const def = CONSENT_BY_TYPE[type]
    // Only ask the party who actually owns this consent (§7.2).
    if (def.grantedBy !== forParty) continue
    const artifact = app.consents.find((c) => c.type === type)
    // A granted consent has nothing left to ask; a declined one falls back to
    // upload tasks below, and never reappears as a consent ask (§11.4).
    if (artifact && ['granted', 'declined', 'revoked'].includes(artifact.status)) continue

    const clears = outstanding.filter((d) => d.consentType === type)
    const copy = CONSENT_COPY[type]
    tasks.push({
      id: `${app.appId}:consent:${type}`,
      appId: app.appId,
      forParty,
      kind: 'consent',
      title: copy.title,
      why: copy.why,
      detail:
        clears.length > 0
          ? `Clears ${clears.length} document${clears.length === 1 ? '' : 's'} at once.`
          : copy.unlocks,
      docIds: clears.map((d) => d.id),
      consentId: type,
      blocking: true,
      origin: 'checklist',
      raisedAt: now,
      estSeconds: copy.full ? CONSENT_SECONDS_FULL : CONSENT_SECONDS_TAP,
      route: `consent/${type}`,
    })
  }

  // -- 4. Upload asks, collapsed by bucket (rule 4) -------------------------
  // Never eleven rows for E3. One coherent ask, expandable.
  const byBucket = new Map<string, DocumentItem[]>()
  for (const d of outstanding) {
    // Rule 3: auto_fetch / bank_generated / internal produce NO customer task.
    // They are the bank's work, and the header count says so.
    if (d.sourcing !== 'manual_upload') {
      // A consent-gated document whose consent was declined has already been
      // rewritten to manual_upload by the store, so this stays exact.
      continue
    }
    const arr = byBucket.get(d.bucketId) ?? []
    arr.push(d)
    byBucket.set(d.bucketId, arr)
  }
  for (const [bucketId, docs] of byBucket) {
    const code = codeOf.get(bucketId) ?? bucketId
    const copy = bucketCopy(code)
    const mandatory = docs.filter((d) => d.mandate !== 'O')
    const blocking = mandatory.length > 0
    tasks.push({
      id: `${app.appId}:upload:${bucketId}`,
      appId: app.appId,
      forParty,
      kind: 'upload',
      title: copy.title,
      why: copy.why,
      detail:
        docs.length === 1 ? docs[0].label : `${docs.length} items`,
      docIds: docs.map((d) => d.id),
      blocking,
      origin: 'checklist',
      raisedAt: now,
      estSeconds: Math.min(docs.length * UPLOAD_SECONDS_PER_DOC, 600),
      route: `bucket/${bucketId}`,
    })
  }

  // -- 5. Milestone tasks ----------------------------------------------------
  tasks.push(...milestoneTasks(app, forParty, now))

  return orderTasks(tasks)
}

// ---- Milestones (§10.1 origin 'milestone') ---------------------------------

function milestoneTasks(app: Application, forParty: PartyRole, now: string): CustomerTask[] {
  const out: CustomerTask[] = []
  if (forParty !== 'applicant') return out
  const rank = stageRank(app.stage)

  // The parent is the credit spine — inviting them is the single highest-value
  // thing an applicant can do, so it is a first-class task, not a form field.
  const parent = app.parties.find((p) => p.role === 'co_applicant')
  if (!parent) {
    out.push({
      id: `${app.appId}:invite:co_applicant`,
      appId: app.appId,
      forParty,
      kind: 'invite',
      title: 'Add your parent as co-applicant',
      why: 'Their income is what the loan is assessed on. Nothing moves until they join.',
      blocking: true,
      origin: 'milestone',
      raisedAt: now,
      estSeconds: 90,
      route: 'co-applicant',
    })
  }

  if (app.securedConstruct) {
    const owner = app.parties.find((p) => p.role === 'collateral_provider')
    if (!owner) {
      out.push({
        id: `${app.appId}:invite:collateral`,
        appId: app.appId,
        forParty,
        kind: 'invite',
        title: 'Tell us about the security you’re offering',
        why: 'At this amount the bank needs property or a financial security behind the loan.',
        blocking: true,
        origin: 'milestone',
        raisedAt: now,
        estSeconds: 120,
        route: 'security',
      })
    }
  }

  // Post-sanction: each of these is a single, named act (§15).
  if (app.stage === 'S11') {
    out.push({
      id: `${app.appId}:acknowledge:sanction`,
      appId: app.appId,
      forParty,
      kind: 'acknowledge',
      title: 'Review and accept your offer',
      why: 'Your sanction letter is ready. Accepting it starts the paperwork.',
      blocking: true,
      origin: 'milestone',
      raisedAt: now,
      dueBy: app.sanctionExpiryDate,
      estSeconds: 300,
      route: 'sanction',
    })
    out.push({
      id: `${app.appId}:payment:fee`,
      appId: app.appId,
      forParty,
      kind: 'payment',
      title: 'Pay the processing fee',
      why: `${POLICY.processingFee.pct}% of the sanctioned amount, with a minimum of ₹${POLICY.processingFee.minInr.toLocaleString('en-IN')}.`,
      blocking: false,
      origin: 'milestone',
      raisedAt: now,
      estSeconds: 120,
      route: 'fee',
    })
  }

  if (app.stage === 'S12') {
    out.push({
      id: `${app.appId}:esign:agreement`,
      appId: app.appId,
      forParty,
      kind: 'esign',
      title: 'Sign your loan agreement',
      why: 'Read it through, then sign with a one-time code.',
      blocking: true,
      origin: 'milestone',
      raisedAt: now,
      estSeconds: 420,
      route: 'agreement',
    })
    out.push({
      id: `${app.appId}:mandate:nach`,
      appId: app.appId,
      forParty,
      kind: 'mandate',
      title: 'Set up repayment',
      why: 'A standing instruction on your parent’s rupee account.',
      blocking: true,
      origin: 'milestone',
      raisedAt: now,
      estSeconds: 240,
      route: 'mandate',
    })
  }

  // Capture is only "done" once the file has left the customer's hands.
  if (rank <= 2) {
    out.push({
      id: `${app.appId}:form:submit`,
      appId: app.appId,
      forParty,
      kind: 'form',
      title: 'Finish and submit your application',
      why: 'A few details about you, your studies and your admission.',
      blocking: true,
      origin: 'milestone',
      raisedAt: now,
      estSeconds: FORM_SECONDS,
      route: 'submit',
    })
  }

  return out
}

// ---- Ordering (rule 5) -----------------------------------------------------
// Send-backs first → blocking consents → blocking uploads → non-blocking →
// optional. Within a band, ascending estSeconds: quick wins first, which
// measurably improves completion.

const KIND_BAND: Record<TaskKind, number> = {
  consent: 0,
  invite: 1,
  upload: 2,
  form: 3,
  acknowledge: 4,
  payment: 5,
  esign: 6,
  mandate: 7,
  review: 8,
}

export function orderTasks(tasks: CustomerTask[]): CustomerTask[] {
  return [...tasks].sort((a, b) => {
    const band = (t: CustomerTask) =>
      t.origin === 'send_back' ? 0 : t.origin === 'validation' ? 1 : t.blocking ? 2 : 3
    const ba = band(a)
    const bb = band(b)
    if (ba !== bb) return ba - bb
    const ka = KIND_BAND[a.kind]
    const kb = KIND_BAND[b.kind]
    if (ka !== kb) return ka - kb
    if (a.estSeconds !== b.estSeconds) return a.estSeconds - b.estSeconds
    return a.id.localeCompare(b.id)
  })
}

// ---- The headline (§10.2) --------------------------------------------------
// "We've already collected 34 of 41 documents for you. 7 need you."
//
// This is the automation-ROI story the BRDs argue for, so it is computed live
// and it MUST agree with the dashboard's document sourcing mix — the two are
// deliberately derived from the same document list with no separate accounting.

export interface CollectedHeadline {
  /** Every document on the file — identical to sourcingMix(app).total. */
  total: number
  /** Obtained without the customer lifting a finger, or already in. */
  collected: number
  /** Still needs a human on the customer's side. */
  needsYou: number
  /** Of `needsYou`, the ones a single consent would clear. */
  needsConsent: number
  /** Of `needsYou`, the ones that genuinely need an upload. */
  needsUpload: number
  /** Of `needsYou`, the ones being asked for a second time. */
  needsRedo: number
}

/** `forParty` scopes the headline to ONE party's documents.
 *
 *  The student's CJ-15 is deliberately APP-WIDE — the file is theirs, the whole
 *  automation story is about the whole file, and this is the number acceptance
 *  item 8 reconciles against the dashboard's sourcing mix. It is a count, never
 *  a document, so it leaks nothing (§7.6).
 *
 *  The co-applicant and collateral portals pass their own party, because "70
 *  need you" on a parent's screen when 60 of them are the student's would be a
 *  lie AND would tell them how big the student's list is. */
export function collectedHeadline(
  app: Application,
  forParty?: PartyRole,
): CollectedHeadline {
  let needsConsent = 0
  let needsUpload = 0
  let needsRedo = 0

  const sections = forParty ? sectionsFor(forParty) : null
  const sectionOf = new Map(app.buckets.map((b) => [b.id, b.section]))

  const scoped = sections
    ? app.documents.filter((d) => {
        const sec = sectionOf.get(d.bucketId)
        return sec !== undefined && sections.includes(sec)
      })
    : app.documents

  for (const d of scoped) {
    if (isRedo(d)) {
      needsRedo++
      continue
    }
    if (isSettled(d)) continue
    // status === 'requested' from here on.
    if (isBlockedOnConsent(app, d)) {
      // A consent-gated document is only THIS party's problem if this party is
      // the one who can grant the consent. A parent's Aadhaar sits behind the
      // student's eKYC consent, so it is not something the parent can act on.
      if (forParty && !canGrant(d, forParty)) continue
      needsConsent++
    } else if (d.sourcing === 'manual_upload') needsUpload++
    // auto_fetch / bank_generated / internal / consent-already-granted are the
    // bank's work — they are "collected for you", not a customer ask.
  }

  const needsYou = needsConsent + needsUpload + needsRedo
  const total = scoped.length
  return {
    total,
    collected: total - needsYou,
    needsYou,
    needsConsent,
    needsUpload,
    needsRedo,
  }
}

/** Can this party grant the consent that gates this document? */
function canGrant(d: DocumentItem, forParty: PartyRole): boolean {
  if (!d.consentType) return false
  return CONSENT_BY_TYPE[d.consentType]?.grantedBy === forParty
}

// ---- Convenience for the dev inspector and window.__glibmoney -------------

export function tasksFor(app: Application, now: string = nowIso()) {
  return {
    appId: app.appId,
    stage: app.stage,
    headline: collectedHeadline(app),
    applicant: buildTasks(app, 'applicant', now),
    co_applicant: buildTasks(app, 'co_applicant', now),
    collateral_provider: buildTasks(app, 'collateral_provider', now),
  }
}

/** Blocking tasks for one party — the number the tracker and drawer show. */
export function blockingCount(app: Application, forParty: PartyRole): number {
  return buildTasks(app, forParty).filter((t) => t.blocking).length
}

/** The send-back the file is currently sitting on, if any.
 *
 *  Read from the audit trail because that is where the reason code lives —
 *  `Application` carries no "current send-back" field, and adding one would
 *  change the shape of the 14 seed literals. */
function latestSendBack(app: Application) {
  if (app.status !== 'sent_back') return undefined
  return app.audit.find((e) => e.verb === 'SEND BACK' && e.reasonCode)
}

// ---- Small text helpers ----------------------------------------------------

function lower(label: string): string {
  // Keep acronyms and proper nouns intact — "Replace PAN", not "Replace pan".
  return /^[A-Z0-9\-/ ]+$/.test(label.slice(0, 4)) ? label : label.charAt(0).toLowerCase() + label.slice(1)
}

/** An Ops send-back reason arrives as internal text. Strip anything that
 *  smells like a code before it reaches a customer screen (§0.6). */
function plainSendBack(reason: string): string {
  const cleaned = reason
    .replace(/\b(VAL|SB|REJ|DEV|COV|HLD|EXP|WD)-\d+\b/g, '')
    .replace(/→\s*(Send back to\s*)?[A-Z]\d+\.?/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s—–-]+|[\s—–-]+$/g, '')
    .trim()
  return cleaned.length > 0
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : 'We need a clearer copy of this one.'
}
