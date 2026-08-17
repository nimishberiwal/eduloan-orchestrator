// ============================================================================
// Validation → customer copy (§13).
//
// THE GATE: a validation reaches the customer only if all three hold —
//   1. severity === 'BLOCK'
//   2. status  === 'fail'
//   3. it is CUSTOMER-FIXABLE — resolvable by uploading, correcting or
//      confirming something the customer actually controls.
//
// Everything else stays internal. WARN and INFO never reach the customer. A
// BLOCK the BANK must resolve (an external lookup failing, a panel vendor
// running late) shows as "We're working on this", never as a customer task.
//
// Rules for the copy itself: never show the rule ID, never show the similarity
// score, never say "failed". Name the two documents, quote both values, offer
// the specific fix.
//
// MAINTENANCE (§13.3): a validation with no CUSTOMER_COPY entry is
// internal-only BY DEFAULT — that is the safe failure mode. A dev-only warning
// fires when a customer-fixable BLOCK has no entry, so gaps surface here rather
// than in front of a customer.
// ============================================================================
import type { Application, ValidationResult } from '@/types'
import { VALIDATION_BY_ID } from '@/data/validations'

export type FixKind = 'reupload' | 'correct' | 'confirm' | 'explain'

export interface CustomerCopyEntry {
  title: string
  /** May interpolate the SAME tokens the internal message uses, so both
   *  surfaces quote identical values. */
  body: (t: Record<string, string | number>) => string
  fix: FixKind
  /** Actions offered, in order. The first is primary. */
  actions: { label: string; kind: FixKind }[]
  /** Which documents the customer would act on. */
  targetDocIds?: (app: Application) => string[]
}

// ---- Helpers to find the document a rule points at -------------------------

function docsMatching(app: Application, ...needles: string[]): string[] {
  const out: string[] = []
  for (const d of app.documents) {
    const l = d.label.toLowerCase()
    if (needles.some((n) => l.includes(n.toLowerCase()))) out.push(d.id)
  }
  return out
}

const q = (v: unknown, fallback = 'the value on file') =>
  v === undefined || v === null || v === '' ? fallback : String(v)

// ---- The catalogue ---------------------------------------------------------
// Only customer-fixable BLOCKs appear here. Everything absent is internal.

export const CUSTOMER_COPY: Record<string, CustomerCopyEntry> = {
  // -- Identity -------------------------------------------------------------
  'VAL-INT-01': {
    title: 'We can’t read your PAN properly',
    body: () =>
      'The PAN number on the card you sent doesn’t scan cleanly. Take the photo again in good light, with all ten characters in frame.',
    fix: 'reupload',
    actions: [{ label: 'Retake my PAN', kind: 'reupload' }],
    targetDocIds: (a) => docsMatching(a, 'PAN'),
  },
  'VAL-INT-03': {
    title: 'The Aadhaar number didn’t check out',
    body: (t) =>
      `The Aadhaar number we have for ${q(t.party, 'you')} doesn’t pass its own checksum, which usually means a digit was misread. Verifying with Aadhaar directly fixes it in one step.`,
    fix: 'correct',
    actions: [
      { label: 'Verify with Aadhaar', kind: 'confirm' },
      { label: 'Send the Aadhaar copy again', kind: 'reupload' },
    ],
    targetDocIds: (a) => docsMatching(a, 'Aadhaar'),
  },
  'VAL-INT-04': {
    title: 'Your passport expires too soon',
    body: (t) =>
      `Your passport has ${q(t.months, 'fewer than six')} months left after your course starts, and it needs at least six. Renew it and send the new one — everything else can carry on in the meantime.`,
    fix: 'reupload',
    actions: [{ label: 'Send my renewed passport', kind: 'reupload' }],
    targetDocIds: (a) => docsMatching(a, 'Passport'),
  },

  // -- Cost & admission -----------------------------------------------------
  'VAL-INT-06': {
    title: 'The cost sheet doesn’t add up',
    body: (t) =>
      `The line items on your university’s cost sheet come to ${q(t.delta, 'a different total')} more than the figure printed at the bottom. Ask your university for a corrected cost sheet, or send a clearer copy if it was cut off.`,
    fix: 'reupload',
    actions: [
      { label: 'Send a corrected cost sheet', kind: 'reupload' },
      { label: 'The totals are right — take another look', kind: 'explain' },
    ],
    targetDocIds: (a) => docsMatching(a, 'COA', 'Tuition + fees'),
  },
  'VAL-INT-07': {
    title: 'One of your test scores is too old',
    body: (t) =>
      `Your ${q(t.which_test, 'test score')} is ${q(t.age, 'older than the accepted window')}. Either send a newer score, or send us your university’s confirmation that they admitted you without it.`,
    fix: 'reupload',
    actions: [
      { label: 'Send a newer score', kind: 'reupload' },
      { label: 'My university didn’t require it', kind: 'explain' },
    ],
    targetDocIds: (a) => docsMatching(a, 'GRE', 'GMAT', 'IELTS', 'LSAT'),
  },
  'VAL-INT-08': {
    title: 'Your marks don’t match what you told us',
    body: (t) =>
      `Adding up your semester marksheets gives ${q(t.calc)}%, but ${q(t.decl)}% was entered on the form. One of the two needs correcting — usually it’s a missing marksheet.`,
    fix: 'correct',
    actions: [
      { label: 'Send the missing marksheet', kind: 'reupload' },
      { label: 'Correct the percentage I entered', kind: 'correct' },
    ],
    targetDocIds: (a) => docsMatching(a, 'UG marksheets'),
  },

  // -- Cross-document -------------------------------------------------------
  // The worked example from the spec (§13.2).
  'VAL-CRS-01': {
    title: 'The name on your I-20 doesn’t quite match your PAN',
    body: (t) =>
      `Your ${q(t.docA, 'PAN')} says ${q(t.nameA, 'one spelling')}; your ${q(t.docB, 'I-20')} says ${q(t.nameB, 'another')}. Universities sometimes truncate names. Upload a name-affidavit or a corrected ${q(t.docB, 'I-20')}, or tell us this is the same person and we’ll review it.`,
    fix: 'confirm',
    actions: [
      { label: 'Upload document', kind: 'reupload' },
      { label: 'It’s the same person', kind: 'confirm' },
    ],
    targetDocIds: (a) => docsMatching(a, 'I-20', 'PAN'),
  },
  'VAL-CRS-02': {
    title: 'Your date of birth is different on two documents',
    body: (t) =>
      `${q(t.docA, 'One document')} shows ${q(t.dobA)}, and ${q(t.docB, 'another')} shows ${q(t.dobB)}. Send whichever one is correct and we’ll use that.`,
    fix: 'reupload',
    actions: [{ label: 'Send the correct document', kind: 'reupload' }],
    targetDocIds: (a) => docsMatching(a, 'Passport', 'Aadhaar'),
  },
  'VAL-CRS-03': {
    title: 'The course dates don’t line up',
    body: () =>
      'The course dates on your admission letter and your I-20 are different. Your university can reissue whichever one is out of date.',
    fix: 'reupload',
    actions: [{ label: 'Send the corrected letter', kind: 'reupload' }],
    targetDocIds: (a) => docsMatching(a, 'I-20', 'Course registration'),
  },
}

// ---- Public API ------------------------------------------------------------

export interface CustomerFailure {
  id: string
  title: string
  body: string
  fix: FixKind
  actions: { label: string; kind: FixKind }[]
  targetDocIds: string[]
}

const warned = new Set<string>()

/** Every BLOCK/fail on this application that the CUSTOMER can fix, translated.
 *  Anything without an entry stays internal — the safe default (§13.3). */
export function customerFixableFailures(app: Application): CustomerFailure[] {
  const out: CustomerFailure[] = []
  for (const v of app.validations) {
    if (v.status !== 'fail') continue
    const def = VALIDATION_BY_ID[v.catalogueId]
    if (!def || def.severity !== 'BLOCK') continue
    const entry = CUSTOMER_COPY[v.catalogueId]
    if (!entry) {
      maybeWarn(v, app)
      continue
    }
    const tokens = v.tokens ?? {}
    out.push({
      id: v.catalogueId,
      title: entry.title,
      body: entry.body(tokens),
      fix: entry.fix,
      actions: entry.actions,
      targetDocIds: entry.targetDocIds?.(app) ?? [],
    })
  }
  return out
}

/** Is this validation shown to customers at all? Used by the console so an
 *  officer can see which failures the customer already knows about. */
export function isCustomerVisible(validationId: string): boolean {
  return validationId in CUSTOMER_COPY
}

/** Dev-only nudge when a BLOCK/fail looks customer-fixable but has no copy.
 *  Heuristic: its internal fail message tells the customer to send something.
 *  Firing this during the build is the point — it surfaces the gap early. */
function maybeWarn(v: ValidationResult, app: Application): void {
  if (!import.meta.env.DEV) return
  if (warned.has(v.catalogueId)) return
  const def = VALIDATION_BY_ID[v.catalogueId]
  const msg = def?.failMessage ?? ''
  const looksFixable = /re-?upload|request (a |the )?(correct|renewed|revised)|obtain|send back to [EPCL]\d/i.test(msg)
  if (!looksFixable) return
  warned.add(v.catalogueId)
  // eslint-disable-next-line no-console
  console.warn(
    `[plainLanguage] ${v.catalogueId} is a customer-fixable BLOCK failing on ${app.appId} but has no CUSTOMER_COPY entry — it will stay internal. Add one in lib/plainLanguage.ts if the customer should see it.`,
  )
}

// ---- Ops send-back reason codes → customer copy (§10.1 rule 6) ------------
// The reason code itself NEVER renders. Only this sentence does.

export const SEND_BACK_COPY: Record<string, string> = {
  'SB-01': 'The copy we have isn’t clear enough to read. A fresh photo in good light usually does it.',
  'SB-02': 'Some details we read off your documents don’t match. We need one of them corrected.',
  'SB-03': 'We need a bit more evidence of your parent’s income before this can move on.',
  'SB-04': 'Our lawyer has a question about the property papers.',
  'SB-05': 'We’re re-checking the amount you can borrow. Nothing is needed from you yet.',
  'SB-06': 'This was routed to the wrong team. We’re fixing it — nothing is needed from you.',
}

export function sendBackCopy(code?: string): string | undefined {
  return code ? SEND_BACK_COPY[code] : undefined
}

// ---- Covenants → customer copy (§15, CJ-22) --------------------------------
//
// A sanction letter's conditions are exactly what a customer must understand,
// and the catalogue's own titles are written for the credit file: they carry
// bucket codes ("Mortgage perfection (C4)"), gate names ("before Tranche-2")
// and document shorthand ("Form 60 → PAN"). Those render VERBATIM in the
// console — reviewers compare them against the BRD — so the translation lives
// here rather than in `data/covenants.ts`.

export const COVENANT_COPY: Record<string, { title: string; detail: string }> = {
  'COV-01': {
    title: 'Send us your unconditional offer',
    detail: 'Your offer still has conditions on it. We need the final version before the last instalment goes out.',
  },
  'COV-02': {
    title: 'Send us your credential evaluation',
    detail: 'The agency’s report has to confirm your degree is equivalent, before the last instalment.',
  },
  'COV-03': {
    title: 'Get your PAN',
    detail: 'You applied with a Form 60 while your PAN was pending. We need the PAN itself before any money moves.',
  },
  'COV-04': {
    title: 'The security has to be registered',
    detail: 'The bank registers its charge on the property before the first instalment. Your officer arranges it.',
  },
  'COV-05': {
    title: 'Send us your stamped visa',
    detail: 'Money can only leave the country once your F-1 visa is stamped.',
  },
  'COV-06': {
    title: 'Send us your final degree certificate',
    detail: 'A provisional certificate was fine at sanction. We need the final one before the second instalment.',
  },
  'COV-07': {
    title: 'Send us your backlog clearance',
    detail: 'Confirmation from your university that the outstanding papers are cleared.',
  },
}

/** A sanction condition in the customer's words. Falls back to stripping every
 *  internal reference rather than showing a code (§0.6). */
export function covenantCopy(defId: string, fallbackTitle: string): { title: string; detail?: string } {
  const entry = COVENANT_COPY[defId]
  if (entry) return entry
  const stripped = fallbackTitle
    .replace(/\((?:[EPCL]\d{1,2})\)/g, '')
    .replace(/\b(?:VAL|COV|DEV|SB|REJ)-[A-Z]*-?\d+\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { title: stripped.length > 3 ? stripped : 'A condition on your sanction' }
}
