// ============================================================================
// Self-declared data and cross-validation (§Phase C).
//
// The gap this closes: a customer types their CGPA on CJ-09, uploads a marksheet
// carrying that CGPA, and until now the two never met — `Academics` persisted
// nothing at all and `confirmExtraction` wrote extracted values into an audit
// remark and nowhere else.
//
// `ExtractedField` already had the right shape for this all along:
//
//     enteredValue    what the customer typed
//     extractedValue  what we read off the document
//     match           whether they agree
//
// So there is no new model here. A typed value becomes an `ExtractedField` with
// `selfDeclared: true` and `match: 'pending'`; the document that later evidences
// it fills `extractedValue` and resolves `match`. The console's existing
// Extracted-data tab renders both sides with no changes at all.
// ============================================================================
import type { Application, ExtractedField, PartySection } from '@/types'

/** One screen's worth of facts, and the document that would evidence them. */
export interface DeclarationSpec {
  section: PartySection
  /** Matches the grouping the console already uses, e.g. "Academic (E3)". */
  group: string
  /** Which checklist document backs this group. */
  backingMatch: RegExp
  fields: {
    key: string
    label: string
    value: string
    /** Which EXTRACTION key evidences this field.
     *
     *  The form and the extractor live in different namespaces — a screen calls
     *  it `ug_institution`, the reader calls it `institution` — and without this
     *  mapping the lookup silently missed, so every evidenced field was written
     *  back with an empty reading and left `pending`. Omit only when nothing on
     *  the document can evidence the field. */
    fromKey?: string
  }[]
}

function fieldId(section: PartySection, key: string): string {
  return `${section}-${key}`.replace(/\W+/g, '-').toLowerCase()
}

/** Documents on this file that would evidence a spec. */
export function backingDocIds(app: Application, match: RegExp): string[] {
  return app.documents.filter((d) => match.test(d.label)).map((d) => d.id)
}

// ---- Comparison ------------------------------------------------------------

/** Normalise for comparison — case, spacing, punctuation and currency noise.
 *  "8.4 CGPA" and "8.4" are the same answer; so are "₹2,85,000" and "285000". */
function norm(v: string): string {
  return v
    .toLowerCase()
    .replace(/[₹$,]/g, '')
    .replace(/\b(cgpa|gpa|percent|pct|per cent|%)\b/g, '')
    .replace(/[^\w.\-/]+/g, ' ')
    .trim()
}

function numeric(v: string): number | null {
  const m = norm(v).match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/** Do a typed value and a read value agree?
 *
 *  Numbers compare with a 1% tolerance, because a customer rounding 8.43 to 8.4
 *  is not a discrepancy. Text compares on the normalised form, and one being a
 *  prefix of the other counts — "VJTI" against "VJTI Mumbai" is the same
 *  institution, and flagging it would train people to ignore the flag. */
export function valuesAgree(entered: string, extracted: string): boolean {
  if (!entered.trim() || !extracted.trim()) return false

  const a = numeric(entered)
  const b = numeric(extracted)
  if (a !== null && b !== null) {
    if (a === b) return true
    const scale = Math.max(Math.abs(a), Math.abs(b))
    return scale > 0 && Math.abs(a - b) / scale <= 0.01
  }

  const na = norm(entered)
  const nb = norm(extracted)
  if (!na || !nb) return false
  return na === nb || na.startsWith(nb) || nb.startsWith(na)
}

// ---- Building fields -------------------------------------------------------

/** The customer typed these and skipped the upload. Unevidenced until the
 *  post-decision verification screen collects the backing document. */
export function declareSelfReported(
  app: Application,
  spec: DeclarationSpec,
): ExtractedField[] {
  const backing = backingDocIds(app, spec.backingMatch)
  return spec.fields
    .filter((f) => f.value.trim().length > 0)
    .map((f) => ({
      id: fieldId(spec.section, f.key),
      section: spec.section,
      group: spec.group,
      label: f.label,
      enteredValue: f.value.trim(),
      extractedValue: '',
      match: 'pending' as const,
      selfDeclared: true,
      backingDocIds: backing,
    }))
}

/** The customer uploaded, the extraction agent read it, and they confirmed.
 *  Both sides are known at once, so the field is evidenced on creation. */
export function declareEvidenced(
  app: Application,
  spec: DeclarationSpec,
  extracted: Record<string, string>,
  docId: string,
): ExtractedField[] {
  return spec.fields
    .filter((f) => f.value.trim().length > 0)
    .map((f) => {
      const read = (extracted[f.fromKey ?? f.key] ?? '').trim()
      return {
        id: fieldId(spec.section, f.key),
        section: spec.section,
        group: spec.group,
        label: f.label,
        enteredValue: f.value.trim(),
        extractedValue: read,
        // No reading for this field means we cannot claim agreement — it stays
        // pending rather than being quietly marked as checked.
        match: read ? (valuesAgree(f.value, read) ? 'pass' : 'fail') : 'pending',
        selfDeclared: false,
        backingDocIds: [docId],
      } satisfies ExtractedField
    })
}

/** Merge new fields over existing ones by id, newest winning. */
export function mergeFields(
  existing: ExtractedField[],
  incoming: ExtractedField[],
): ExtractedField[] {
  const byId = new Map(existing.map((f) => [f.id, f]))
  for (const f of incoming) byId.set(f.id, f)
  return [...byId.values()]
}

// ---- Reading the state -----------------------------------------------------

export interface DeclaredGroup {
  section: PartySection
  group: string
  fields: ExtractedField[]
  backingDocIds: string[]
}

/** Everything still typed-but-unevidenced, grouped as the customer will see it. */
export function pendingDeclarations(app: Application): DeclaredGroup[] {
  const groups = new Map<string, DeclaredGroup>()
  for (const f of app.extracted) {
    if (!f.selfDeclared || f.match !== 'pending') continue
    const key = `${f.section}|${f.group}`
    const g = groups.get(key) ?? {
      section: f.section,
      group: f.group,
      fields: [],
      backingDocIds: f.backingDocIds ?? [],
    }
    g.fields.push(f)
    groups.set(key, g)
  }
  return [...groups.values()]
}

/** Fields where the document contradicted what the customer told us. */
export function discrepancies(app: Application): ExtractedField[] {
  return app.extracted.filter((f) => f.match === 'fail' && f.extractedValue.trim().length > 0)
}

/** The condition-of-disbursement test: nothing typed is left unevidenced, and
 *  nothing evidenced is left contradicted. */
export function declarationsSettled(app: Application): boolean {
  return pendingDeclarations(app).length === 0 && discrepancies(app).length === 0
}

/** Count for a task badge — how many groups still need their document. */
export function pendingDeclarationCount(app: Application): number {
  return pendingDeclarations(app).length
}
