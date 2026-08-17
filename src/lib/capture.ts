// ============================================================================
// Capture, classification and extraction (§12).
//
// Everything here is DETERMINISTIC: quality scores derive from a hash of the
// filename and size, so a demo repeats exactly. A random sprinkle would make
// the retake path fire on a different document every run, which is unusable in
// front of a committee — and it is the same reasoning that made classification
// confidence modelled rather than randomised in v3.
//
// Dev overrides are exposed through window.__glibmoney.capture.
// ============================================================================
import type { DocumentItem } from '@/types'
import type { CaptureQuality, CaptureResult } from '@/types/journeys'
import { POLICY } from '@/data/policy'
import { ambiguityReason, classifyDoc } from '@/data/classification'

// ---- Deterministic hash ----------------------------------------------------

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** A stable 0–1 draw from a seed and a channel name. */
function draw(seed: string, channel: string): number {
  return (hash(`${seed}::${channel}`) % 1000) / 1000
}

// ---- Quality ---------------------------------------------------------------

export function assessQuality(fileName: string, sizeKb: number): CaptureQuality {
  const seed = `${fileName}|${sizeKb}`

  // Filenames a person would give a bad photo bias the draw hard, so a demo can
  // be STEERED on purpose: name the file "blurry.jpg" and it is rejected every
  // time, on every machine.
  const blurNudge = /blur|shake|dark|bad/i.test(fileName) ? 0.6 : 0
  const glareNudge = /glare|flash/i.test(fileName) ? 0.5 : 0

  // The scaling factors matter. An earlier pass used 0.5 / 0.42 / 0.12, which
  // rejected roughly HALF of all clean files — so a customer retaking a photo
  // was as likely to be rejected again, and the retry path could not be
  // demonstrated. Real capture SDKs reject a minority. These factors put a
  // clean file's failure rate near one in eight: the retake path still shows up
  // unprompted, but a retry almost always succeeds.
  return {
    blur: clamp01(draw(seed, 'blur') * 0.38 + blurNudge),
    glare: clamp01(draw(seed, 'glare') * 0.31 + glareNudge),
    edgesDetected: draw(seed, 'edges') > 0.02 && !/crop|cut/i.test(fileName),
    resolutionOk: sizeKb >= 40 && !/tiny|small/i.test(fileName),
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Retake instructions are SPECIFIC. "The top edge is cut off — retake with the
 *  whole page in frame", never a generic error (§12.1). */
export function retakeReason(q: CaptureQuality, sizeKb: number): string | undefined {
  if (!q.edgesDetected) {
    return 'Part of the page is outside the frame. Lay it flat and retake so all four corners are visible.'
  }
  if (q.blur > POLICY.blurThreshold) {
    return 'The photo came out soft. Rest your phone on something steady, wait for it to focus, and take it again.'
  }
  if (q.glare > POLICY.glareThreshold) {
    return 'There is a bright reflection across the page. Move away from the light or tilt the document slightly.'
  }
  if (!q.resolutionOk) {
    return sizeKb < 40
      ? 'This file is too small to read once we zoom in. Send the original rather than a forwarded copy.'
      : 'The text isn’t sharp enough to read. Take it again a little closer.'
  }
  return undefined
}

// ---- Accepted types & size -------------------------------------------------

export interface FileCheck {
  ok: boolean
  message?: string
}

/** Rejects state the ACTUAL limit, not "invalid file" (§12.1). */
export function checkFile(fileName: string, sizeKb: number): FileCheck {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!POLICY.uploadAcceptedTypes.includes(ext)) {
    return {
      ok: false,
      message: `We can read ${POLICY.uploadAcceptedTypes.join(', ')} files. “${fileName}” is a .${ext || 'file with no extension'}.`,
    }
  }
  const maxKb = POLICY.uploadMaxMb * 1024
  if (sizeKb > maxKb) {
    return {
      ok: false,
      message: `This file is ${(sizeKb / 1024).toFixed(1)} MB and the limit is ${POLICY.uploadMaxMb} MB. A photo usually comes in well under that.`,
    }
  }
  return { ok: true }
}

// ---- Extraction ------------------------------------------------------------
// 4–8 fields maximum, the ones that matter: name, number, dates, amount.
// Field-level confidence shows only as a subtle "check this" flag — never a
// percentage (§12.3).

export interface ExtractedFieldMock {
  key: string
  label: string
  value: string
  /** True when the reader wasn't sure. Renders as "check this", not a number. */
  uncertain: boolean
}

const EXTRACTION_SHAPES: { match: RegExp; fields: { key: string; label: string }[] }[] = [
  { match: /^PAN|PAN \+/i, fields: [
    { key: 'name', label: 'Name' },
    { key: 'pan', label: 'PAN' },
    { key: 'dob', label: 'Date of birth' },
    { key: 'father', label: 'Father’s name' },
  ] },
  { match: /Aadhaar/i, fields: [
    { key: 'name', label: 'Name' },
    { key: 'aadhaar', label: 'Aadhaar (last 4)' },
    { key: 'dob', label: 'Date of birth' },
    { key: 'address', label: 'Address' },
  ] },
  { match: /Passport/i, fields: [
    { key: 'name', label: 'Name' },
    { key: 'passport', label: 'Passport number' },
    { key: 'issued', label: 'Issued' },
    { key: 'expires', label: 'Expires' },
  ] },
  { match: /I-20/i, fields: [
    { key: 'name', label: 'Name' },
    { key: 'sevis', label: 'SEVIS ID' },
    { key: 'programme', label: 'Programme' },
    { key: 'start', label: 'Course starts' },
    { key: 'end', label: 'Course ends' },
    { key: 'coa', label: 'Cost per year' },
  ] },
  { match: /COA|Cost of Attendance|Tuition/i, fields: [
    { key: 'university', label: 'University' },
    { key: 'year', label: 'Academic year' },
    { key: 'tuition', label: 'Tuition' },
    { key: 'living', label: 'Living costs' },
    { key: 'total', label: 'Total for the year' },
  ] },
  { match: /payslip/i, fields: [
    { key: 'employer', label: 'Employer' },
    { key: 'month', label: 'Month' },
    { key: 'gross', label: 'Gross pay' },
    { key: 'net', label: 'Net pay' },
  ] },
  { match: /marksheet|transcript/i, fields: [
    { key: 'name', label: 'Name' },
    { key: 'institution', label: 'Institution' },
    { key: 'result', label: 'Result' },
    { key: 'year', label: 'Year' },
  ] },
  { match: /statement|account/i, fields: [
    { key: 'holder', label: 'Account holder' },
    { key: 'bank', label: 'Bank' },
    { key: 'period', label: 'Period' },
    { key: 'closing', label: 'Closing balance' },
  ] },
]

const SAMPLE: Record<string, string> = {
  name: 'as printed',
  pan: 'ABCDE1234F',
  dob: '14-08-2002',
  father: 'as printed',
  aadhaar: '•••• •••• 4471',
  passport: 'Z3927104',
  issued: '02-03-2021',
  expires: '01-03-2031',
  sevis: 'N0031882745',
  programme: 'as printed',
  start: '24-08-2026',
  end: '15-05-2028',
  coa: 'US$62,400',
  university: 'as printed',
  year: '2026–27',
  tuition: 'US$44,200',
  living: 'US$18,200',
  total: 'US$62,400',
  employer: 'as printed',
  month: 'June 2026',
  gross: '₹2,85,000',
  net: '₹2,11,400',
  institution: 'as printed',
  result: '8.4 CGPA',
  holder: 'as printed',
  bank: 'as printed',
  period: 'Jan–Jun 2026',
  closing: '₹4,86,210',
}

export function extractFields(doc: DocumentItem, seed: string): ExtractedFieldMock[] {
  const shape = EXTRACTION_SHAPES.find((s) => s.match.test(doc.label))
  const fields = shape?.fields ?? [
    { key: 'name', label: 'Name' },
    { key: 'year', label: 'Date on the document' },
  ]
  return fields.slice(0, 8).map((f, i) => ({
    key: f.key,
    label: f.label,
    value: SAMPLE[f.key] ?? '—',
    // One field per document at most gets flagged, and only when the draw is
    // genuinely low — a page of "check this" flags teaches people to ignore it.
    uncertain: i === fields.length - 1 && draw(seed, `field:${f.key}`) < 0.18,
  }))
}

// ---- The whole capture -----------------------------------------------------

export function runCapture(doc: DocumentItem, fileName: string, sizeKb: number): CaptureResult {
  const quality = assessQuality(fileName, sizeKb)
  const reason = retakeReason(quality, sizeKb)
  const seed = `${doc.id}|${fileName}|${sizeKb}`

  if (reason) {
    return {
      docId: doc.id,
      fileName,
      sizeKb,
      quality,
      verdict: 'retake',
      retakeReason: reason,
    }
  }

  const cls = classifyUpload(doc, fileName)
  return {
    docId: doc.id,
    fileName,
    sizeKb,
    quality,
    verdict: 'accept',
    classification: {
      label: cls.label,
      confidence: cls.confidence,
      // Below the threshold the customer is NOT asked to resolve it — the
      // document is accepted and marked for a human (§12.2).
      ambiguous: cls.confidence < POLICY.lowConfidenceThreshold,
    },
    extracted: Object.fromEntries(extractFields(doc, seed).map((f) => [f.key, f.value])),
  }
}

/** What the classifier thinks the UPLOADED FILE is (§12.2).
 *
 *  `data/classification.ts` infers a label from a document's checklist NAME —
 *  that is its documented contract and it is not ours to change. Run against the
 *  slot, it can only ever agree with itself, so the mismatch path ("this looks
 *  like a passport, but we asked for your I-20") could never fire.
 *
 *  So the mock reads the FILENAME through the same LABEL_RULES. A filename that
 *  names a document type ("passport-scan.jpg") classifies as that type and can
 *  disagree with the slot; an uninformative one ("IMG_4471.jpg") falls back to
 *  the slot, because a meaningless filename is not evidence of anything. */
export function classifyUpload(doc: DocumentItem, fileName: string) {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')
  const fromFile = classifyDoc(stem)
  if (fromFile.label !== 'GENERIC_UPLOAD') return fromFile
  // Uninformative filename — trust the slot, and keep the slot's modelled
  // ambiguity (the five cases BRD-21's `reup-class` node names).
  return classifyDoc(doc.label)
}

/** Why the classifier was unsure — shown to the BANK, never to the customer. */
export { ambiguityReason }

/** A human-readable classifier label for the confirmation screen: the vocabulary
 *  is SNAKE_CASE internally and must never surface that way (§0.6). */
export function labelToWords(label: string): string {
  const special: Record<string, string> = {
    I20_SEVIS: 'I-20',
    PAN_CARD: 'PAN card',
    AADHAAR_XML: 'Aadhaar',
    COA_STATEMENT: 'cost of attendance sheet',
    GRE_SCORECARD: 'GRE scorecard',
    GRE_SUBJECT_SCORECARD: 'GRE Subject scorecard',
    GMAT_SCORECARD: 'GMAT scorecard',
    GMAT_FOCUS_SCORECARD: 'GMAT Focus scorecard',
    EA_SCORECARD: 'Executive Assessment scorecard',
    LSAT_SCORECARD: 'LSAT scorecard',
    CIBIL_REPORT: 'credit report',
    UG_TRANSCRIPT_SEALED: 'university transcript',
    CREDENTIAL_EVAL_WES: 'credential evaluation',
    TITLE_DEED: 'title deed',
    ENCUMBRANCE_CERTIFICATE: 'encumbrance certificate',
    VALUATION_REPORT: 'valuation report',
    LEGAL_OPINION: 'legal opinion',
    SELF_DECLARATION: 'declaration',
    BANK_STATEMENT: 'bank statement',
    GENERIC_UPLOAD: 'document',
    FORM16: 'Form 16',
    ITR: 'tax return',
    PAYSLIP: 'payslip',
    PASSPORT: 'passport',
    SPONSORSHIP_LETTER_MBA: 'sponsorship letter',
    EMPLOYER_RELIEVING: 'relieving letter',
    PORTFOLIO_LETTER: 'portfolio',
    CASPER_RESULT: 'CASPer result',
  }
  if (special[label]) return special[label]
  if (label.startsWith('PROGRAMMATIC_')) return 'accreditation certificate'
  return label.toLowerCase().replace(/_/g, ' ')
}
