// ============================================================================
// Document classification (§v3) — BRD-21 §7 classifier vocabulary and the
// pipeline's `reup-class` branch.
//
// The pipeline routes "unknown / low-confidence type" straight back to
// re-upload. The BRD names the exact cases the classifier struggles with, and
// those are modelled here rather than a random confidence sprinkle.
// ============================================================================
import type { DocClassification } from '@/types'

/** BRD §7 label vocabulary — what the classifier emits. */
export const CLASSIFIER_LABELS = [
  'GRE_SCORECARD', 'GRE_SUBJECT_SCORECARD', 'GMAT_SCORECARD', 'GMAT_FOCUS_SCORECARD',
  'EA_SCORECARD', 'LSAT_SCORECARD', 'CASPER_RESULT', 'PORTFOLIO_LETTER',
  'UG_TRANSCRIPT_SEALED', 'CREDENTIAL_EVAL_WES', 'CREDENTIAL_EVAL_ECE', 'CREDENTIAL_EVAL_IQAS',
  'PROGRAMMATIC_ACCREDITATION_AACSB', 'PROGRAMMATIC_ACCREDITATION_ABET',
  'PROGRAMMATIC_ACCREDITATION_ABA', 'PROGRAMMATIC_ACCREDITATION_LCME', 'PROGRAMMATIC_OTHER',
  'SPONSORSHIP_LETTER_MBA', 'EMPLOYER_RELIEVING',
  'PAN_CARD', 'AADHAAR_XML', 'PASSPORT', 'I20_SEVIS', 'COA_STATEMENT',
  'PAYSLIP', 'FORM16', 'ITR', 'BANK_STATEMENT', 'CIBIL_REPORT',
  'TITLE_DEED', 'ENCUMBRANCE_CERTIFICATE', 'VALUATION_REPORT', 'LEGAL_OPINION',
  'SELF_DECLARATION', 'GENERIC_UPLOAD',
] as const

/** Label inference from the document's checklist name. */
const LABEL_RULES: { match: RegExp; label: string }[] = [
  { match: /GRE Subject/i, label: 'GRE_SUBJECT_SCORECARD' },
  { match: /GRE General/i, label: 'GRE_SCORECARD' },
  { match: /GMAT-Focus/i, label: 'GMAT_FOCUS_SCORECARD' },
  { match: /GMAT/i, label: 'GMAT_SCORECARD' },
  { match: /LSAT/i, label: 'LSAT_SCORECARD' },
  { match: /CASPer/i, label: 'CASPER_RESULT' },
  { match: /Portfolio/i, label: 'PORTFOLIO_LETTER' },
  { match: /UG transcripts|sealed\/attested transcripts/i, label: 'UG_TRANSCRIPT_SEALED' },
  { match: /Credential evaluation/i, label: 'CREDENTIAL_EVAL_WES' },
  { match: /^ABET/i, label: 'PROGRAMMATIC_ACCREDITATION_ABET' },
  { match: /^ABA accreditation/i, label: 'PROGRAMMATIC_ACCREDITATION_ABA' },
  { match: /^LCME/i, label: 'PROGRAMMATIC_ACCREDITATION_LCME' },
  { match: /^Other programmatic/i, label: 'PROGRAMMATIC_OTHER' },
  { match: /AACSB|Programmatic accreditation/i, label: 'PROGRAMMATIC_ACCREDITATION_AACSB' },
  { match: /Sponsorship letter|Sponsorship declaration/i, label: 'SPONSORSHIP_LETTER_MBA' },
  { match: /Relieving letter/i, label: 'EMPLOYER_RELIEVING' },
  { match: /^PAN|PAN \+/i, label: 'PAN_CARD' },
  { match: /Aadhaar/i, label: 'AADHAAR_XML' },
  { match: /Passport/i, label: 'PASSPORT' },
  { match: /I-20/i, label: 'I20_SEVIS' },
  { match: /COA|Cost of Attendance/i, label: 'COA_STATEMENT' },
  { match: /payslip/i, label: 'PAYSLIP' },
  { match: /Form 16/i, label: 'FORM16' },
  { match: /ITR/i, label: 'ITR' },
  { match: /net-worth/i, label: 'SELF_DECLARATION' },
  { match: /account|statements?/i, label: 'BANK_STATEMENT' },
  { match: /CIBIL|bureau/i, label: 'CIBIL_REPORT' },
  { match: /title deed|sale\/title/i, label: 'TITLE_DEED' },
  { match: /EC 13|Encumbrance/i, label: 'ENCUMBRANCE_CERTIFICATE' },
  { match: /valuation/i, label: 'VALUATION_REPORT' },
  { match: /legal opinion|title search/i, label: 'LEGAL_OPINION' },
  { match: /declaration/i, label: 'SELF_DECLARATION' },
]

/** The five cases BRD-21's `reup-class` node calls out as genuinely ambiguous.
 *  These are the documents the classifier cannot bind with confidence. */
const AMBIGUOUS: { match: RegExp; confidence: number; reason: string }[] = [
  { match: /GRE Subject/i, confidence: 0.61, reason: 'GRE-Subject vs GRE-General templates differ; sectional cut-offs are not comparable' },
  { match: /Credential evaluation/i, confidence: 0.58, reason: 'Evaluation report may be from a non-NACES agency, outside the accepted list' },
  { match: /^Other programmatic/i, confidence: 0.64, reason: 'Certificate carries no accreditor identifier — cannot bind to a body' },
  { match: /Sponsorship letter/i, confidence: 0.55, reason: 'Letter may be on individual rather than company letterhead' },
  { match: /sealed\/attested transcripts/i, confidence: 0.67, reason: 'Transcript may be non-English without a certified translation' },
]

export function classifyDoc(docLabel: string): DocClassification {
  const label = LABEL_RULES.find((r) => r.match.test(docLabel))?.label ?? 'GENERIC_UPLOAD'
  const amb = AMBIGUOUS.find((a) => a.match.test(docLabel))
  if (amb) {
    return { label, confidence: amb.confidence, status: 'low_confidence' }
  }
  if (label === 'GENERIC_UPLOAD') {
    return { label, confidence: 0.72, status: 'classified' }
  }
  return { label, confidence: 0.96, status: 'classified' }
}

export function ambiguityReason(docLabel: string): string | undefined {
  return AMBIGUOUS.find((a) => a.match.test(docLabel))?.reason
}
