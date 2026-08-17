// ============================================================================
// The document swarm (§v5) — extraction · fraud · validation.
//
// Three agents run against one uploaded document. Every one is a PURE function
// of (application, document, capture result): same inputs, same findings, every
// time. The staggered timing lives in the runtime; nothing here knows about it.
//
// Reuse note: extraction wraps `lib/capture.ts` rather than reimplementing it,
// and validation writes real `ValidationResult`s against the existing 73-rule
// catalogue. Neither invents a parallel model of the truth.
// ============================================================================
import type { Application, DocumentItem, ValidationResult } from '@/types'
import type { CaptureResult } from '@/types/journeys'
import type { AgentFinding, AgentResult } from './types'
import { draw, finding, result } from './runtime'
import { extractFields, labelToWords, type ExtractionContext } from '@/lib/capture'
import { POLICY } from '@/data/policy'
import { VALIDATION_BY_ID, renderMessage } from '@/data/validations'

// ---------------------------------------------------------------------------
// Which catalogue rules each document actually participates in.
//
// Keyed by a regex over the CHECKLIST LABEL, the same key `EXTRACTION_SHAPES`
// uses, so the two tables line up. A document with no entry runs no validation
// agent findings — better silence than a rule fired at the wrong paper.
// ---------------------------------------------------------------------------
const DOC_VALIDATIONS: { match: RegExp; ids: string[] }[] = [
  { match: /^PAN$|^PAN \+/i, ids: ['VAL-INT-01', 'VAL-EXT-01', 'VAL-CRS-01'] },
  { match: /Aadhaar/i, ids: ['VAL-INT-03', 'VAL-EXT-03', 'VAL-CRS-02'] },
  { match: /Passport/i, ids: ['VAL-INT-04', 'VAL-EXT-04', 'VAL-CRS-02'] },
  { match: /I-20/i, ids: ['VAL-INT-05', 'VAL-CRS-01', 'VAL-CRS-02'] },
  { match: /COA|Cost of Attendance|Tuition/i, ids: ['VAL-INT-06', 'VAL-INT-11'] },
  { match: /marksheet|transcript/i, ids: ['VAL-INT-08', 'VAL-EXT-05', 'VAL-CRS-01'] },
  { match: /GRE|GMAT|LSAT|IELTS|TOEFL/i, ids: ['VAL-INT-07', 'VAL-EXT-06', 'VAL-CRS-05'] },
  { match: /payslip|Form 16|ITR/i, ids: ['VAL-INT-12'] },
]

export function validationsForDoc(label: string): string[] {
  return DOC_VALIDATIONS.find((d) => d.match.test(label))?.ids ?? []
}

// ---------------------------------------------------------------------------
// 1. Extraction
// ---------------------------------------------------------------------------

export interface ExtractionOutput {
  fields: { key: string; label: string; value: string; uncertain: boolean }[]
}

/** What the reader can legitimately know about this file, so a prefilled form
 *  shows the customer's own name and university rather than a placeholder. */
export function extractionContext(app: Application): ExtractionContext {
  const student = app.parties.find((p) => p.role === 'applicant')?.name ?? app.studentName
  return {
    studentName: student,
    // The destination university — used on COA and I-20 shapes, which are
    // genuinely about that institution. Deliberately NOT used for `institution`,
    // which is where the undergraduate degree came from.
    university: app.university,
    programme: app.program,
  }
}

export function runExtraction(
  app: Application,
  doc: DocumentItem,
  capture: CaptureResult,
): AgentResult {
  const seed = `${doc.id}|${capture.fileName}|${capture.sizeKb}`
  const fields = extractFields(doc, seed, extractionContext(app))

  const findings: AgentFinding[] = []
  const unsure = fields.filter((f) => f.uncertain)
  for (const f of unsure) {
    findings.push(
      finding(
        'extraction',
        'info',
        'customer',
        `Worth checking: ${f.label.toLowerCase()}`,
        'We weren’t completely sure we read this one right. Have a quick look before you carry on.',
        { kind: 'field', id: f.key },
      ),
    )
  }

  const headline =
    fields.length === 0
      ? 'Nothing to read off this one'
      : `Read ${fields.length} detail${fields.length === 1 ? '' : 's'}${unsure.length ? ` · ${unsure.length} to check` : ''}`

  return result('extraction', headline, findings, { fields } satisfies ExtractionOutput)
}

// ---------------------------------------------------------------------------
// 2. Fraud
//
// EVERY finding here is `audience: 'bank'`. A customer is never told their
// document looks altered — they see the neutral summary from
// `runtime.customerSummary`. This is the rule the whole feature turns on.
// ---------------------------------------------------------------------------

export interface FraudOutput {
  score: number // 0–1, higher = more concerning
  signals: string[]
}

export function runFraud(
  app: Application,
  doc: DocumentItem,
  capture: CaptureResult,
): AgentResult {
  const seed = `${doc.id}|${capture.fileName}|${capture.sizeKb}`
  const findings: AgentFinding[] = []
  const signals: string[] = []
  let score = 0

  // -- a. Quality anomalies that read as manipulation rather than a bad photo.
  //       A very clean file that still fails edge detection is more suspicious
  //       than a blurry one — a blurry photo is a bad camera, a cropped-but-
  //       sharp page is someone removing something.
  if (!capture.quality.edgesDetected && capture.quality.blur < 0.15) {
    score += 0.35
    signals.push('page edges absent on an otherwise sharp scan')
    findings.push(
      finding(
        'fraud',
        'attention',
        'bank',
        'Page boundary missing on a sharp scan',
        'The image is in focus but no page edge was detected, which is more consistent with a crop than with a poor photo. Worth an eye before this is accepted.',
        { kind: 'document', id: doc.id },
      ),
    )
  }

  // -- b. The classifier disagrees with the slot.
  if (capture.classification && doc.classification) {
    if (capture.classification.label !== doc.classification.label) {
      score += 0.3
      signals.push('classified as a different document type')
      findings.push(
        finding(
          'fraud',
          'attention',
          'bank',
          `Filed as ${labelToWords(doc.classification.label)}, reads as ${labelToWords(capture.classification.label)}`,
          'The document does not look like the slot it was filed against. Usually a mis-file; occasionally a substitution.',
          { kind: 'document', id: doc.id },
        ),
      )
    }
  }

  // -- c. Re-upload churn. A document replaced several times after rejection is
  //       a normal customer struggling — but it is also the shape of someone
  //       iterating until something passes.
  if (doc.version >= 3) {
    score += 0.2
    signals.push(`version ${doc.version}`)
    findings.push(
      finding(
        'fraud',
        'info',
        'bank',
        `Replaced ${doc.version - 1} times`,
        'Repeated replacement is usually an honest retry. Flagged for pattern only, not as an accusation.',
        { kind: 'document', id: doc.id },
      ),
    )
  }

  // -- d. Watchlist screen, reusing the VAL-EXT-14 vocabulary. Deterministic and
  //       deliberately rare — roughly one file in twenty-five.
  const watch = draw(`${app.appId}|${doc.id}`, 'watchlist')
  if (watch > 0.96) {
    score += 0.5
    signals.push('name similarity against a sanctions list')
    findings.push(
      finding(
        'fraud',
        'block',
        'bank',
        'Possible watchlist name match',
        'A name on this document is similar to an entry on a sanctions/PEP list. Compliance must clear this before the file moves — the customer is not told, and must not be.',
        { kind: 'validation', id: 'VAL-EXT-14' },
      ),
    )
  }

  score = Math.min(1, score)
  const headline =
    score === 0
      ? 'Nothing unusual'
      : score >= 0.5
        ? 'Needs a person to look'
        : 'A couple of things noted'

  return result('fraud', headline, findings, { score, signals } satisfies FraudOutput)
}

// ---------------------------------------------------------------------------
// 3. Validation
//
// Writes real results against the real catalogue. The agent decides pass/fail
// deterministically; the MESSAGE always comes from the rule's own text through
// `renderMessage`, so what a reviewer reads here is byte-identical to what the
// console shows. No parallel copy.
// ---------------------------------------------------------------------------

export interface ValidationOutput {
  results: ValidationResult[]
}

export function runValidation(
  app: Application,
  doc: DocumentItem,
  capture: CaptureResult,
): AgentResult {
  const ids = validationsForDoc(doc.label)
  const findings: AgentFinding[] = []
  const results: ValidationResult[] = []

  for (const id of ids) {
    const def = VALIDATION_BY_ID[id]
    if (!def) continue

    // Carry forward whatever tokens the file already holds for this rule so the
    // rendered message keeps its real values (the seed's "Kabir Singh" vs
    // "Kabir Sing", not a placeholder).
    const existing = app.validations.find((v) => v.catalogueId === id)
    const tokens = existing?.tokens ?? {}

    // A rule already resolved by a human stays resolved — an agent does not get
    // to re-open a waived validation.
    if (existing && (existing.status === 'waived' || existing.status === 'fail')) {
      results.push(existing)
      continue
    }

    const fails = draw(`${app.appId}|${doc.id}|${id}`, 'val') > 0.88
    const status: ValidationResult['status'] = fails ? 'fail' : 'pass'
    const message = renderMessage(fails ? def.failMessage : def.passMessage, tokens)
    results.push({ catalogueId: id, status, message, tokens })

    if (fails) {
      findings.push(
        finding(
          'validation',
          def.severity === 'BLOCK' ? 'block' : 'attention',
          // The rule ID and the internal message never reach a customer — the
          // customer-facing wording is lib/plainLanguage.ts's job, and only for
          // the rules it has copy for.
          'bank',
          def.title,
          message,
          { kind: 'validation', id },
        ),
      )
    }
  }

  const failed = results.filter((r) => r.status === 'fail').length
  const headline =
    ids.length === 0
      ? 'No checks apply to this one'
      : failed === 0
        ? `${results.length} check${results.length === 1 ? '' : 's'} passed`
        : `${failed} of ${results.length} need attention`

  return result('validation', headline, findings, { results } satisfies ValidationOutput)
}

// ---------------------------------------------------------------------------
// The whole swarm, in one call.
// ---------------------------------------------------------------------------

export function runDocumentSwarm(
  app: Application,
  doc: DocumentItem,
  capture: CaptureResult,
): Record<string, AgentResult> {
  return {
    extraction: runExtraction(app, doc, capture),
    fraud: runFraud(app, doc, capture),
    validation: runValidation(app, doc, capture),
  }
}

/** Extraction output as a plain key→value bag, for prefilling a form. */
export function fieldsFromRun(results: Record<string, AgentResult>): Record<string, string> {
  const out = results.extraction?.output as ExtractionOutput | undefined
  if (!out) return {}
  return Object.fromEntries(out.fields.map((f) => [f.key, f.value]))
}

export { POLICY }
