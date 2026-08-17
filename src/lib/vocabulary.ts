// ============================================================================
// The no-internal-vocabulary rule, as code (§0.6).
//
// A customer never reads a rule id, a stage id, a bucket code, a department
// name or a lifecycle enum. Four such leaks reached customer screens during the
// V1 build — a bucket code in a tranche gate (`E10 Foreign banking verified`),
// a bucket code in a covenant title (`Mortgage perfection (C4)`), a duplicated
// gate sentence, and a classifier label rendering as the bare word "document".
// Reading screens one at a time does not hold this rule.
//
// This module exists because the check that found those leaks was a snippet
// pasted into a browser console and never checked in — so it could not be
// re-run, and by v2.0.0 it had not been run against the screens V2 added. The
// patterns now live in one place, used by BOTH:
//
//   - scripts/scan-vocabulary.mjs — static, over customer-facing source
//   - a live DOM walk over the customer routes, which catches leaks that only
//     exist once a value has been interpolated
//
// Static analysis alone would miss `${bucket.code} verified`; a DOM walk alone
// only covers the routes someone remembered to visit. Neither is sufficient,
// and sharing the pattern list means the two cannot drift apart.
// ============================================================================

export interface VocabPattern {
  name: string
  re: RegExp
  why: string
}

/** Each pattern is global — callers should not rely on `lastIndex` surviving. */
export const INTERNAL_PATTERNS: VocabPattern[] = [
  {
    name: 'rule id',
    re: /\b(?:VAL|SB|REJ|DEV|COV|HLD|EXP|WD)-[A-Z]*-?\d+\b/g,
    why: 'Catalogue identifiers are how the bank talks to itself.',
  },
  {
    name: 'stage id',
    re: /\bS(?:0[1-9]|1[0-3])\b/g,
    why: 'A customer has no idea what S07 is, and should not need one.',
  },
  {
    name: 'bucket code',
    re: /\b[EPCL]\d{1,2}(?:#\d+)?\b(?!\w)/g,
    why: 'Checklist bucket codes. This one leaked twice in V1.',
  },
  {
    name: 'terminal',
    re: /\b(?:DISBURSED_ACTIVE|REJECTED|WITHDRAWN|EXPIRED)\b/g,
    why: 'Terminal status enums. "Rejected" in prose is fine; the enum is not.',
  },
  {
    name: 'SNAKE_CASE',
    re: /\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/g,
    why: 'Any screaming-snake identifier is internal by construction.',
  },
  {
    name: 'department / internal term',
    re: /\b(?:Credit-Regional|Risk-Central|maker-checker|FOIR|LTV|DoA)\b/g,
    why: 'Org structure and credit jargon. Bare "Credit" is deliberately absent — it is an ordinary word.',
  },
  {
    name: 'sourcing mode',
    re: /\b(?:manual_upload|consent_fetch|auto_fetch|bank_generated)\b/g,
    why: 'Sourcing modes are a console concept.',
  },
  {
    name: 'lifecycle',
    re: /\b(?:qc_pass|qc_fail|not_started|in_progress|pending_checker|sent_back)\b/g,
    why: 'Document and application lifecycle enums.',
  },
]

export interface VocabHit {
  pattern: string
  why: string
  samples: string[]
}

/** Scan a blob of rendered text (or a source string) for internal vocabulary. */
export function scanText(text: string): VocabHit[] {
  const hits: VocabHit[] = []
  for (const p of INTERNAL_PATTERNS) {
    const m = text.match(new RegExp(p.re.source, p.re.flags))
    if (m && m.length > 0) {
      hits.push({ pattern: p.name, why: p.why, samples: [...new Set(m)].slice(0, 6) })
    }
  }
  return hits
}

/** Every customer-facing route. `:id` is substituted by the caller.
 *
 *  Kept here rather than in the walker so that adding a customer screen and
 *  forgetting to scan it is a visible omission in a reviewed file, not an
 *  invisible one in somebody's console history. */
export const CUSTOMER_ROUTES: string[] = [
  '/',
  '/apply',
  '/start',
  '/otp',
  // pre-qualification
  '/apply/:id/plan',
  '/apply/:id/cost',
  '/apply/:id/parent-snapshot',
  '/apply/:id/offer',
  // capture
  '/apply/:id/profile',
  '/apply/:id/academics',
  '/apply/:id/admission',
  '/apply/:id/co-applicant',
  '/apply/:id/co-applicant/sent',
  '/apply/:id/security',
  '/apply/:id/submit',
  // verification and sharing
  '/apply/:id/kyc',
  '/apply/:id/consents',
  // work
  '/apply/:id/tasks',
  '/apply/:id/status',
  '/apply/:id/action',
  // post-sanction
  '/apply/:id/sanction',
  '/apply/:id/fee',
  '/apply/:id/agreement',
  '/apply/:id/mandate',
  '/apply/:id/disbursement',
  '/apply/:id/closed',
  // §Phase C — added in v2.0.0 and never scanned before
  '/apply/:id/verify',
]
