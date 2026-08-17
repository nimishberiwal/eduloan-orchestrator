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
import type { Application, ExtractedField, PartySection, Tranche, TrancheGate } from '@/types'

/** One screen's worth of facts, and the document that would evidence them. */
export interface DeclarationSpec {
  section: PartySection
  /** Matches the grouping the console already uses, e.g. "Academic (E3)". */
  group: string
  /** Which checklist document backs this group. */
  backingMatch: RegExp
  /** Which bucket that document sits in.
   *
   *  Checklist labels are NOT unique across the file — "PAN" is a document in
   *  both E1 (the student) and P1 (the parent), and "first match wins" would
   *  quietly hand a co-applicant screen the applicant's PAN. Same class of
   *  silent mis-lookup as the `fromKey` namespace mismatch: nothing errors, the
   *  wrong paper is simply recorded as the evidence. Omit only where the label
   *  really is unique. */
  backingBucket?: RegExp
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
export function backingDocIds(app: Application, match: RegExp, bucket?: RegExp): string[] {
  return app.documents
    .filter((d) => match.test(d.label) && (!bucket || bucket.test(d.bucketId)))
    .map((d) => d.id)
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

/** What the reader emits for a field it has no context for. It is display text,
 *  not a reading, and comparing it to what the customer typed manufactures a
 *  discrepancy out of our own placeholder — "you told us Rajesh Rao, the PAN
 *  says 'as printed'". */
const PLACEHOLDER = /^(as printed|—|-)$/i

function reading(v: string): string {
  const t = v.trim()
  return PLACEHOLDER.test(t) ? '' : t
}

/** Do a typed value and a read value agree?
 *
 *  Numbers compare with a 1% tolerance ONLY where one side is fractional,
 *  because that tolerance exists for one reason: a customer rounding 8.43 to
 *  8.4 is not a discrepancy. Whole numbers compare exactly.
 *
 *  A proportional tolerance is wrong for a quantity that is a label rather than
 *  a measurement. On a year it is ±20 years of slack, so "finished 2024"
 *  against a marksheet reading 2025 passed silently — a different graduation
 *  year, which is precisely what a credit officer checks for gaps and course
 *  duration, waved through as a rounding artefact. Caught at CJ-28, the first
 *  screen that re-checks a year against its document.
 *
 *  Text compares on the normalised form, and one being a prefix of the other
 *  counts — "VJTI" against "VJTI Mumbai" is the same institution, and flagging
 *  it would train people to ignore the flag. */
export function valuesAgree(entered: string, extracted: string): boolean {
  if (!entered.trim() || !extracted.trim()) return false

  const a = numeric(entered)
  const b = numeric(extracted)
  if (a !== null && b !== null) {
    if (a === b) return true
    const fractional = !Number.isInteger(a) || !Number.isInteger(b)
    if (!fractional) return false
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
  const backing = backingDocIds(app, spec.backingMatch, spec.backingBucket)
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
      sourceKey: f.fromKey ?? f.key,
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
  const backing = backingDocIds(app, spec.backingMatch, spec.backingBucket)
  return spec.fields
    .filter((f) => f.value.trim().length > 0)
    .map((f) => {
      const read = reading(extracted[f.fromKey ?? f.key] ?? '')
      // The document was read but said nothing about THIS field. We cannot
      // claim agreement, and the fact must not quietly stop being owed either —
      // it goes back into the self-declared queue for CJ-28 to collect against.
      if (!read) {
        return {
          id: fieldId(spec.section, f.key),
          section: spec.section,
          group: spec.group,
          label: f.label,
          enteredValue: f.value.trim(),
          extractedValue: '',
          match: 'pending' as const,
          selfDeclared: true,
          backingDocIds: backing,
          sourceKey: f.fromKey ?? f.key,
        } satisfies ExtractedField
      }
      return {
        id: fieldId(spec.section, f.key),
        section: spec.section,
        group: spec.group,
        label: f.label,
        enteredValue: f.value.trim(),
        extractedValue: read,
        match: valuesAgree(f.value, read) ? 'pass' : 'fail',
        selfDeclared: false,
        backingDocIds: [docId],
        sourceKey: f.fromKey ?? f.key,
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

/** Fields where the document contradicted what the customer told us.
 *
 *  Scoped to fields that came through the DECLARATION flow — `backingDocIds` is
 *  set by both builders and by nothing else. The seed carries seven extracted
 *  fields already marked 'fail' (an I-20 name mismatch, a COA arithmetic delta,
 *  a bureau flag); those are console-side validation failures with their own
 *  rules and their own gates, and sweeping them in here would have let a
 *  pre-existing mismatch on a demo file hold up a disbursement through a gate
 *  that is supposed to be about self-declared facts. */
export function declarationFields(app: Application): ExtractedField[] {
  return app.extracted.filter((f) => f.backingDocIds !== undefined)
}

export function discrepancies(app: Application): ExtractedField[] {
  return declarationFields(app).filter(
    (f) => f.match === 'fail' && f.extractedValue.trim().length > 0,
  )
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

/** Re-check fields ALREADY on the file against a fresh reading (CJ-28).
 *
 *  The difference from `declareEvidenced` is where the values come from. There,
 *  a screen holds the form state and builds a spec. Here the customer typed
 *  these days ago on a screen that is behind them: `enteredValue` is the record,
 *  and the only new information is what the document says. So this NEVER
 *  touches `enteredValue` — a verification step that could rewrite the thing
 *  being verified would be worthless.
 *
 *  A field with no usable reading is left exactly as it was, still owed, rather
 *  than being marked checked because a document arrived. */
export function verifyDeclared(
  fields: ExtractedField[],
  extracted: Record<string, string>,
  docId: string,
): ExtractedField[] {
  return fields.map((f) => {
    const read = reading(extracted[f.sourceKey ?? ''] ?? '')
    if (!read) return f
    return {
      ...f,
      extractedValue: read,
      match: valuesAgree(f.enteredValue, read) ? 'pass' : 'fail',
      selfDeclared: false,
      backingDocIds: [docId],
    } satisfies ExtractedField
  })
}

// ---- The condition of disbursement -----------------------------------------

/** Not a catalogue rule id — this gate is derived, not stored, so it needs a
 *  ref of its own that cannot collide with a VAL-/COV-/bucket reference. */
export const DECLARATION_GATE_REF = 'DECLARED-EVIDENCE'

/** The user's choice for how self-declared facts are enforced: the file
 *  sanctions and signs normally, and the money simply does not move until every
 *  typed fact has been evidenced and nothing is contradicted.
 *
 *  DERIVED, not stored. Journey applications are created with `tranches: []`
 *  and nothing ever fills them, so there is no creation point to attach a gate
 *  to; and a stored copy of a boolean that is recomputable from `app.extracted`
 *  is a copy that can go stale against it. */
export function declarationGate(app: Application): TrancheGate {
  return {
    label: 'Self-declared details evidenced',
    ref: DECLARATION_GATE_REF,
    passed: declarationsSettled(app),
  }
}

/** A tranche's gates as they should be READ — its own, plus the declaration
 *  gate on the first one. Tranche 1 only: the condition is about releasing any
 *  money at all, and repeating it on every instalment would say the same thing
 *  three times to a customer who has already dealt with it. */
export function gatesFor(app: Application, tranche: Tranche): TrancheGate[] {
  if (tranche.n !== 1) return tranche.gates
  return [...tranche.gates, declarationGate(app)]
}
