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
import type { IntelCategory, IntelFinding } from '@/data/universityIntel'
import { intelFor } from '@/data/universityIntel'

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
export function coverageFor(university: string, universityShort: string): Coverage {
  const intel = intelFor(university) ?? intelFor(universityShort)
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
    return t.length > 0 && (p.includes(t) || t.includes(p))
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
  const intel = intelFor(university) ?? intelFor(universityShort)
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
 *  only to say how many were set aside as irrelevant to this course. */
export function allFindings(university: string, universityShort: string): IntelFinding[] {
  return (intelFor(university) ?? intelFor(universityShort))?.findings ?? []
}
