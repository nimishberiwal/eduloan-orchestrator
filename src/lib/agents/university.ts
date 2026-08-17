// ============================================================================
// The university swarm (§E) — one agent, `university_intel`.
//
// Mirrors `documents.ts`: a PURE function of the application, computed
// synchronously and completely up front. Nothing here waits, polls or fetches.
// The staggered lane timing lives in `runtime.planRun`; this module knows
// nothing about it. Run the same application through twice against the same
// clock and you get byte-identical output — `/__dev/agents` asserts exactly that.
//
// THE FETCH IS MODELLED, NOT LIVE. This codebase makes zero network calls by
// design and the standalone HTML build has to work offline, so "crawling" here
// means selecting from the hand-researched corpus in `src/data/universityIntel.ts`
// and stamping the prototype clock. The endpoint a real crawl would need is
// written down in `docs/API-CONTRACT.md §8`.
//
// THE CORPUS IS FIXED INPUT. It is read, never written and never added to. Its
// findings carry real publishers, URLs, dates and a researcher-assigned `level`,
// and all of those are carried through unaltered — this agent selects, orders
// and synthesises, it does not re-judge.
//
// AUDIENCE: every finding is `'bank'`. A brief weighs funding contraction,
// leadership churn and adverse coverage about the institution a customer is
// about to attend. None of that is the customer's to read here, and some of it
// would be alarming out of context. There is no customer-facing counterpart to
// this swarm, and `registry.ts` marks the agent `internal` so its lane cannot
// appear on a customer surface either.
// ============================================================================
import type { Application, UniversityBrief, UniversityBriefSource } from '@/types'
import type { IntelCategory, IntelFinding } from '@/data/universityIntel'
import type { AgentFinding, AgentResult } from './types'
import { finding, result } from './runtime'
import { hoursSince, nowIso } from '@/lib/clock'
import {
  CATEGORY_LABEL,
  allFindings,
  coverageFor,
  selectFindings,
} from './universityCorpus'

// ---- Staleness -------------------------------------------------------------
//
// Measured against the PROTOTYPE clock, never `Date.now()`. There is no
// `Date.now()` in prototype logic, and the whole point of the frozen clock is
// that an operator can advance it and watch a consequence — a 24-hour refresh
// tied to wall time would simply never fire during a demo.

export const BRIEF_TTL_HOURS = 24

/** Hours since this brief was stamped, on the prototype clock. */
export function briefAgeHours(brief: UniversityBrief, now: string = nowIso()): number {
  return hoursSince(brief.fetchedAt, now)
}

/** A missing brief is stale — it is the "never fetched" case, and it wants the
 *  same treatment: crawl it. */
export function briefIsStale(brief: UniversityBrief | undefined, now: string = nowIso()): boolean {
  if (!brief) return true
  return briefAgeHours(brief, now) >= BRIEF_TTL_HOURS
}

export interface BriefStaleness {
  /** No brief at all. */
  missing: boolean
  stale: boolean
  ageHours: number
  /** Hours until it goes stale. Negative once it already has. */
  dueInHours: number
}

export function briefStaleness(
  brief: UniversityBrief | undefined,
  now: string = nowIso(),
): BriefStaleness {
  if (!brief) return { missing: true, stale: true, ageHours: 0, dueInHours: 0 }
  const ageHours = briefAgeHours(brief, now)
  return {
    missing: false,
    stale: ageHours >= BRIEF_TTL_HOURS,
    ageHours,
    dueInHours: BRIEF_TTL_HOURS - ageHours,
  }
}

// ---- Synthesis -------------------------------------------------------------

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function toSource(f: IntelFinding): UniversityBriefSource {
  // Flattened, not referenced: a brief records what was said when it was
  // fetched. Revising the corpus must not rewrite briefs already on file.
  return {
    id: f.id,
    category: f.category,
    categoryLabel: CATEGORY_LABEL[f.category],
    headline: f.headline,
    detail: f.detail,
    level: f.level,
    publisher: f.source.publisher,
    publishedIso: f.source.date,
    url: f.source.url,
  }
}

/** Categories present, in the corpus's own rank order. `selectFindings` already
 *  returned that order, so first-seen order here is that same order —
 *  deterministic without a second sort. */
function categoryMix(sources: UniversityBriefSource[]): { category: IntelCategory; n: number }[] {
  const counts = new Map<IntelCategory, number>()
  const seen: IntelCategory[] = []
  for (const s of sources) {
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1)
    if (!seen.includes(s.category)) seen.push(s.category)
  }
  return seen.map((category) => ({ category, n: counts.get(category) ?? 0 }))
}

/** Build the brief. Pure: `(application, now) → brief`.
 *
 *  `revision` and `previousFetchedAt` come off the brief already on the
 *  application, which is why this still counts as a function of the application
 *  alone — the prior state is carried on the record, not held in a module. */
export function buildBrief(app: Application, now: string = nowIso()): UniversityBrief {
  const relevant = selectFindings(app.university, app.universityShort, app.program)
  const sources = relevant.map(toSource)
  const coverage = coverageFor(app.university, app.universityShort)

  // How many findings are on file for this university but were set aside as
  // irrelevant to the programme. Said out loud below, because "we found nothing"
  // and "we found six things and none of them touch your course" are different
  // statements and an officer should be able to tell them apart.
  const setAside = Math.max(0, allFindings(app.university, app.universityShort).length - relevant.length)

  const attention = sources.filter((s) => s.level === 'attention').length
  const adverse = sources.filter((s) => s.category === 'adverse').length
  const policy = sources.filter((s) => s.category === 'policy').length
  const funding = sources.filter((s) => s.category === 'funding').length

  // -- headline
  let headline: string
  if (sources.length === 0) {
    headline =
      coverage.state === 'thin'
        ? `${app.university} — researched, and quiet`
        : coverage.state === 'absent'
          ? `${app.university} — not in the research corpus`
          : `${app.university} — nothing relevant to ${app.program}`
  } else {
    const mix = categoryMix(sources)
      .map((c) => `${c.n} ${CATEGORY_LABEL[c.category].toLowerCase()}`)
      .join(' · ')
    headline = `${app.university} — ${plural(sources.length, 'item', 'items')}: ${mix}`
  }

  // -- synthesis
  const synthesis: string[] = []

  if (sources.length === 0) {
    synthesis.push(
      coverage.state === 'thin'
        ? `The corpus covers ${app.university} and carries nothing recent worth putting in front of an officer.${
            coverage.note ? ` ${coverage.note}` : ''
          } That is a finding, not a gap.`
        : coverage.state === 'absent'
          ? `${app.university} is not in the research corpus, which covers the 14 universities the pre-qualification screen can select. Treat this brief as ABSENT, not as a clean result — nobody has looked.`
          : `${plural(setAside, 'item is', 'items are')} on file for ${app.university}, but none of them touch ${app.program}.`,
    )
  } else {
    synthesis.push(
      `Read against ${app.program}. ${plural(sources.length, 'item is', 'items are')} relevant to this file${
        setAside > 0
          ? `; ${plural(setAside, 'further item was', 'further items were')} on file for ${app.university} but do not touch this programme.`
          : '.'
      } ${plural(attention, 'is', 'are')} marked for attention by the researcher.`,
    )
  }

  if (adverse > 0) {
    synthesis.push(
      `${plural(adverse, 'item', 'items')} of adverse coverage. Read the sources before this file is sanctioned — this is the category that should change how the brief is weighed, not merely noted.`,
    )
  }
  if (policy > 0) {
    synthesis.push(
      `${plural(policy, 'campus or immigration policy item', 'campus or immigration policy items')}. These bear on whether the student actually arrives and enrols, which is the assumption the disbursement schedule rests on.`,
    )
  }
  if (funding > 0) {
    synthesis.push(
      `${plural(funding, 'funding item', 'funding items')}. Funding contraction bears on assistantships and internal aid — the sources a student might otherwise have drawn on to reduce the ask.`,
    )
  }
  if (sources.length > 0 && adverse === 0 && policy === 0 && funding === 0) {
    synthesis.push(
      'Nothing here bears on whether the student arrives or on the institution’s standing. Informational.',
    )
  }

  return {
    university: app.university,
    programme: app.program,
    fetchedAt: now,
    ...(app.universityBrief ? { previousFetchedAt: app.universityBrief.fetchedAt } : {}),
    revision: (app.universityBrief?.revision ?? 0) + 1,
    headline,
    synthesis,
    sources,
    coverage: coverage.state,
    ...(coverage.note ? { coverageNote: coverage.note } : {}),
  }
}

// ---- The agent -------------------------------------------------------------

export interface UniversityOutput {
  brief: UniversityBrief
}

export function runUniversityIntel(app: Application, now: string = nowIso()): AgentResult {
  const brief = buildBrief(app, now)
  const findings: AgentFinding[] = []

  for (const s of brief.sources) {
    findings.push(
      finding(
        'university_intel',
        // The RESEARCHER's level, carried straight through. Never 'block' — the
        // corpus guarantees it, and a file must not be held up by what a
        // newspaper printed.
        s.level,
        // Bank. Every one of them. See the header note.
        'bank',
        `${s.categoryLabel}: ${s.headline}`,
        `${s.detail} — ${s.publisher}, ${s.publishedIso}. Source: ${s.url}`,
        // No `ref`: `AgentFinding.ref` addresses documents, validations, fields
        // and parties. A news source is none of those, and widening that union
        // to carry a URL would let any finding smuggle a link into surfaces that
        // do not expect one. The URL travels on the brief, which is rendered by
        // a panel built to show it.
      ),
    )
  }

  if (brief.sources.length === 0) {
    findings.push(
      finding(
        'university_intel',
        'info',
        'bank',
        brief.coverage === 'absent'
          ? 'University not in the research corpus'
          : 'Nothing recent on this university',
        brief.coverage === 'absent'
          ? 'This university has no dossier. Absent, not clean — do not read this as a clear result.'
          : `The corpus covers this university and had nothing worth reporting.${
              brief.coverageNote ? ` ${brief.coverageNote}` : ''
            } Recorded so the absence is legible rather than looking like an unfinished crawl.`,
      ),
    )
  }

  const headline =
    brief.sources.length === 0
      ? brief.coverage === 'absent'
        ? 'Not in the corpus'
        : 'Nothing recent to report'
      : `${plural(brief.sources.length, 'source', 'sources')} · revision ${brief.revision}`

  return result('university_intel', headline, findings, { brief } satisfies UniversityOutput)
}

/** The whole swarm, in one call — the same shape `runDocumentSwarm` returns.
 *  One lane today; keyed by agent so a second university-side agent could join
 *  without changing a caller. */
export function runUniversitySwarm(app: Application): Record<string, AgentResult> {
  return {
    university_intel: runUniversityIntel(app),
  }
}

/** The brief out of a completed run, for the caller that persists it. */
export function briefFromRun(results: Record<string, AgentResult>): UniversityBrief | undefined {
  return (results.university_intel?.output as UniversityOutput | undefined)?.brief
}
