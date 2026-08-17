// ============================================================================
// Selection over the university-intelligence corpus (§E).
//
// The corpus itself — `src/data/universityIntel.ts` — is hand-researched and is
// FIXED INPUT to this module: read, never written, never added to. It brings its
// own types (`IntelFinding`, `UniversityIntel`, `IntelCategory`) and its own
// lookup (`intelFor`). This file adds only the part the agent needs and the
// corpus deliberately does not provide: which of a university's findings belong
// on a PARTICULAR application's brief, and in what order.
//
// Everything here is a PURE function of (corpus, university, programme) — the
// same rule the document swarm follows. No clock, no store, no network.
//
// NOTE ON JUDGEMENT WE DO NOT SECOND-GUESS: the corpus already assigns each
// finding a `level` ('info' | 'attention', never 'block'). That is the
// researcher's call, made with the source in front of them, and the agent
// carries it through rather than re-deriving a severity from the category.
// ============================================================================
import type { IntelCategory, IntelFinding, UniversityIntel } from '@/data/universityIntel'
import { UNIVERSITY_INTEL, intelFor } from '@/data/universityIntel'

// ============================================================================
// RESOLUTION — matching an application's university to a corpus dossier.
//
// WHY THIS IS NOT JUST `intelFor(app.university)`.
//
// Three vocabularies name the same institutions and none of them agree:
//
//   `US_UNIVERSITIES`   full name + short   'University of California, Berkeley' / 'UC Berkeley'
//   `seedBulk`          mixed               'NYU', 'UT Austin', 'Georgia Tech', and
//                                           'University of Michigan Ross' — a university
//                                           and a business school concatenated
//   the corpus          its own short/name   whatever the researcher filed it under
//
// Extending the corpus to the FT Top 50 US MBA schools makes this acute, because a
// business school is conventionally named for its benefactor ('Ross', 'Tepper',
// 'Marshall') rather than its parent university. A dossier filed as
// `{ university: 'Ross', name: 'University of Michigan Ross School of Business' }`
// has to reach an application whose university reads 'University of Michigan Ross'
// — and must NOT reach one that reads plain 'University of Michigan'.
//
// So resolution is: the corpus's own exact lookup FIRST, then a token-subset
// match, then nothing. Deliberately NOT fuzzy string distance — that is how
// 'Boston College' silently acquires 'Boston University' findings.
//
// NO ALIAS TABLE. Writing out 'Kellogg = Northwestern' fifty times would be
// reproducing the FT Top 50 list, which is researched data and belongs in the
// corpus with its source. Resolution reads whatever the corpus filed and matches
// structurally, so the list stays in exactly one place.
// ============================================================================

/** Words that carry no distinguishing information. Dropped before comparison.
 *
 *  'College' is deliberately ABSENT: dropping it makes 'Boston College' and
 *  'Boston University' the same institution, which is a real pair in the seed
 *  pool. 'Institute' and 'Technology' are absent for the same reason — they are
 *  what separates MIT, Georgia Tech, Illinois Institute of Technology and
 *  Stevens Institute of Technology from one another. */
const STOPWORDS = new Set([
  'the', 'of', 'at', 'in', 'and', 'for',
  'university', 'universities', 'school', 'schools', 'graduate', 'business',
])

/** Single tokens that name a PLACE rather than an institution, and therefore
 *  must never carry a match on their own.
 *
 *  Without this, {boston} ⊆ {boston, college} resolves 'Boston University' to the
 *  'Boston College' dossier, and {michigan} ⊆ {michigan, ross} hands a plain
 *  'University of Michigan' engineering applicant the Ross MBA brief. A place
 *  name alone is an ambiguous key; it needs a second token, or an exact match. */
const PLACE_TOKENS = new Set([
  'boston', 'washington', 'texas', 'california', 'michigan', 'ohio', 'illinois',
  'indiana', 'virginia', 'carolina', 'york', 'georgia', 'florida', 'arizona',
  'colorado', 'pennsylvania', 'massachusetts', 'maryland', 'minnesota', 'wisconsin',
  'chicago', 'miami', 'pittsburgh', 'rochester', 'buffalo', 'amherst',
  'los', 'angeles', 'north', 'south', 'east', 'west', 'new',
])

/** Words that DEFINE a distinct institution rather than describe one.
 *
 *  These exist to rescue the place-token guard from being too blunt. The corpus
 *  files its MBA dossiers under parent-university short names — 'Michigan',
 *  'Chicago', 'Penn' — several of which ARE place tokens. So a place-only key has
 *  to be allowed sometimes:
 *
 *    'University of Michigan Ross'      + key 'Michigan' → SHOULD match.
 *                                         Leftover token: {ross}. A school name.
 *    'Illinois Institute of Technology' + key 'Chicago'  → MUST NOT match.
 *      (short 'IIT Chicago')              Leftover: {illinois, institute,
 *                                         technology, iit}. A different school.
 *    'Michigan State University'        + key 'Michigan' → MUST NOT match.
 *                                         Leftover: {state}.
 *
 *  So: a place-only key is allowed only when what is left over after it names a
 *  SCHOOL WITHIN the institution, not another institution. */
const INSTITUTION_TOKENS = new Set([
  'institute', 'institutes', 'institution', 'technology', 'tech', 'polytechnic',
  'college', 'state', 'agricultural', 'a&m', 'am', 'community', 'seminary',
])

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,''`()\-/]/g, ' ')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
}

function isSubset(small: string[], large: string[]): boolean {
  return small.length > 0 && small.every((t) => large.includes(t))
}

/** The token-subset primitive, exported so `/__dev/agents` can assert the guards
 *  against a fixed table of name pairs. It has to be testable independently of
 *  the corpus: the pairs that matter most are the ones that must NOT match, and
 *  those cannot be demonstrated by whatever dossiers happen to exist today. */
export function nameMatchesKey(appName: string, corpusKey: string): boolean {
  const a = tokens(appName)
  const k = tokens(corpusKey)
  if (a.length === 0 || k.length === 0) return false
  const [small, large] = k.length <= a.length ? [k, a] : [a, k]
  if (!isSubset(small, large)) return false

  // A key resting entirely on place names is ambiguous on its own. Allow it only
  // when the leftover tokens name a school WITHIN the institution rather than a
  // different institution. See INSTITUTION_TOKENS for the three worked cases.
  const leftover = large.filter((t) => !small.includes(t))

  // An institution-defining leftover means these are two DIFFERENT institutions
  // that happen to share a word. This caught a real one: 'Penn State University'
  // reduces to {penn, state} and was resolving to the corpus's 'Penn' dossier —
  // i.e. a Penn State applicant was being handed Wharton's brief. The leftover
  // {state} is what separates them, and it separates 'Michigan'/'Michigan State'
  // and 'Boston University'/'Boston College' the same way.
  if (leftover.some((t) => INSTITUTION_TOKENS.has(t))) return false

  // A key resting entirely on place names is ambiguous on its own.
  if (small.every((t) => PLACE_TOKENS.has(t))) {
    // Identical place-only token sets are NOT a match. 'University of Washington'
    // and 'Washington University' both reduce to {washington}, and they are
    // different institutions on opposite sides of the country — the corpus
    // carries both, as 'UW' and 'WashU'. A bare place name never identifies an
    // institution; the legitimate version of this match goes through the exact
    // lookup against the dossier's own `name`.
    if (leftover.length === 0) return false
    if (leftover.some((t) => PLACE_TOKENS.has(t))) return false
  }
  return true
}

/** Programmes a business-school dossier is actually about. An MBA applicant at
 *  Michigan wants the Ross brief; an MS Mechanical Engineering applicant at the
 *  same university does not. Mirrors the existing STEM regex in
 *  `App360/tabs.tsx` — same kind of programme classifier, same house style. */
const BUSINESS_PROGRAMME = /\bMBA\b|\bEMBA\b|Finance|Business|Management|Supply Chain|Accounting|Marketing/i

export function isBusinessProgramme(programme: string): boolean {
  return BUSINESS_PROGRAMME.test(programme)
}

/** Markers that a dossier key is a business school rather than a university. */
const BUSINESS_SCHOOL_MARKER = /business|management|mba/i

export type ResolutionMethod = 'exact' | 'token' | 'none'

export interface Resolution {
  intel?: UniversityIntel
  method: ResolutionMethod
  /** The dossier key matched, for the diagnostic column in `/__dev/agents`. */
  matchedKey?: string
}

/** Resolve an application to a dossier.
 *
 *  DETERMINISTIC: candidates are scored and the ties are broken on the dossier's
 *  own `university` string, so the same application always resolves to the same
 *  dossier regardless of corpus ordering. `/__dev/agents` diffs two runs. */
export function resolveIntel(
  university: string,
  universityShort: string,
  programme = '',
): Resolution {
  // 1. The corpus's own lookup wins. It already handles short-or-full,
  //    case-insensitively, and it is the researcher's intended key.
  const exact = intelFor(university) ?? intelFor(universityShort)
  if (exact) return { intel: exact, method: 'exact', matchedKey: exact.university }

  // 2. Token-subset match, in either direction.
  const appTokens = [...new Set([...tokens(university), ...tokens(universityShort)])]
  if (appTokens.length === 0) return { method: 'none' }

  const wantsBusiness = isBusinessProgramme(programme)
  const scored: { intel: UniversityIntel; score: number }[] = []

  for (const intel of UNIVERSITY_INTEL) {
    // Compare against BOTH of the dossier's keys — a researcher filing an MBA
    // school may put the benefactor in `university` and the parent university in
    // `name`, and either is a legitimate way to reach the application.
    for (const key of [intel.university, intel.name]) {
      const keyTokens = tokens(key)
      if (keyTokens.length === 0) continue
      if (!nameMatchesKey(appTokens.join(' '), key)) continue

      let score = keyTokens.length === appTokens.length ? 100 : keyTokens.length < appTokens.length ? 50 : 25
      // A business-school dossier is the better answer for a business programme,
      // and the worse one for anything else.
      if (BUSINESS_SCHOOL_MARKER.test(key)) score += wantsBusiness ? 30 : -30
      // Prefer the closest-sized key, so 'Ross' beats a broader parent entry.
      score -= Math.abs(keyTokens.length - appTokens.length)

      scored.push({ intel, score })
      break
    }
  }

  if (scored.length === 0) return { method: 'none' }
  scored.sort((a, b) => b.score - a.score || a.intel.university.localeCompare(b.intel.university))
  const winner = scored[0].intel
  return { intel: winner, method: 'token', matchedKey: winner.university }
}

/** Presentation order and sort rank. Lower sorts first — ordered by how much a
 *  credit officer cares: adverse coverage and policy changes move a decision, a
 *  ranking shift rarely does. */
export const CATEGORY_RANK: Record<IntelCategory, number> = {
  adverse: 0,
  policy: 1,
  funding: 2,
  leadership: 3,
  faculty: 4,
  ranking: 5,
}

export const CATEGORY_LABEL: Record<IntelCategory, string> = {
  adverse: 'Adverse coverage',
  policy: 'Campus / immigration policy',
  funding: 'Funding',
  leadership: 'Leadership change',
  faculty: 'Faculty move',
  ranking: 'Ranking shift',
}

/** How well the corpus covers a university. Three states, not two:
 *
 *  - `adequate` — researched, findings on file.
 *  - `thin`     — researched, and genuinely quiet. The corpus says so explicitly
 *                 and carries a `note` explaining what was looked for.
 *  - `absent`   — not in the corpus at all. NOT the same as quiet, and must not
 *                 be read as a clean bill. The bulk seed (APP-2601…2900) draws
 *                 university names from a wider list than the 14 the
 *                 pre-qualification screen can select, so this state is
 *                 reachable and has to render honestly. */
export type CoverageState = 'adequate' | 'thin' | 'absent'

export interface Coverage {
  state: CoverageState
  /** The corpus's own explanation, present when it marked a university thin. */
  note?: string
}

/** Resolve coverage for a file. `intelFor` already accepts either the short name
 *  ('UC Berkeley') or the full one, case-insensitively, so both of the seed's
 *  fields are tried and neither needs normalising here. */
export function coverageFor(
  university: string,
  universityShort: string,
  programme = '',
): Coverage {
  const { intel } = resolveIntel(university, universityShort, programme)
  if (!intel) return { state: 'absent' }
  if (intel.coverage === 'thin') return { state: 'thin', note: intel.note }
  return { state: 'adequate' }
}

/** Does this finding speak to this programme?
 *
 *  No tags means university-wide — always relevant. The corpus tags with exact
 *  programme strings ('MS Computer Science'), but matching is bidirectional and
 *  case-insensitive so a broader keyword tag would also work. */
export function matchesProgramme(finding: IntelFinding, programme: string): boolean {
  if (!finding.programmeTags || finding.programmeTags.length === 0) return true
  const p = programme.trim().toLowerCase()
  if (!p) return true
  return finding.programmeTags.some((tag) => {
    const t = tag.trim().toLowerCase()
    if (t.length === 0) return false
    // Short tags — 'MBA', 'LLM', 'MPH' — match on a WORD BOUNDARY, not as a
    // substring. Plain `includes` would let a three-letter tag land inside an
    // unrelated programme name, and an MBA finding on an MS file is exactly the
    // kind of wrong that reads as plausible.
    if (t.length <= 4) {
      return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(p)
    }
    return p.includes(t) || t.includes(p)
  })
}

/** The findings that belong on this file's brief, in a TOTAL and therefore
 *  deterministic order: category rank, then newest first, then headline, then the
 *  stable id. The last two tiebreaks exist so two findings published the same day
 *  in the same category can never swap places between runs — which is what
 *  `/__dev/agents` diffs for. */
export function selectFindings(
  university: string,
  universityShort: string,
  programme: string,
): IntelFinding[] {
  const { intel } = resolveIntel(university, universityShort, programme)
  if (!intel) return []
  return intel.findings
    .filter((f) => matchesProgramme(f, programme))
    .slice()
    .sort(
      (a, b) =>
        CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
        b.source.date.localeCompare(a.source.date) ||
        a.headline.localeCompare(b.headline) ||
        a.id.localeCompare(b.id),
    )
}

/** Every finding on file for a university, ignoring the programme filter. Used
 *  only to say how many were set aside as irrelevant to this course.
 *
 *  Takes the programme anyway, because RESOLUTION is programme-sensitive — a
 *  business programme may resolve to a different dossier than an engineering one
 *  at the same university, and "set aside" must be counted against whichever
 *  dossier the brief actually used. */
export function allFindings(
  university: string,
  universityShort: string,
  programme = '',
): IntelFinding[] {
  return resolveIntel(university, universityShort, programme).intel?.findings ?? []
}
