// ============================================================================
// /__dev/agents — the agent harness (§Phase A).
//
// Engine before screens, the same move `/__dev/tasks` made for the projection.
// This proves the two properties the whole design rests on, before a single
// customer screen depends on them:
//
//   1. DETERMINISM — running the same swarm against the same inputs twice
//      produces byte-identical findings. Asserted here, live, per row.
//   2. PARALLELISM — the lanes have genuinely different durations, so a swarm
//      reads as several things happening at once. Shown as the spread between
//      the fastest and slowest lane.
//
// Dense and unbranded on purpose. It is a workbench, not a product surface.
// ============================================================================
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Application, OnboardingVerdict, UniversityBrief } from '@/types'
import { useStore } from '@/store/appStore'
import { runDocumentSwarm } from '@/lib/agents/documents'
import { findingsFor, planRun, runDuration } from '@/lib/agents/runtime'
import { AGENT_BY_ID } from '@/lib/agents/registry'
import { runCapture } from '@/lib/capture'
import { AgentSwarm } from '@/journeys/common/AgentSwarm'
import type { AgentId, AgentResults } from '@/lib/agents/types'
import { BRIEF_TTL_HOURS, briefFromRun, briefIsStale, runUniversitySwarm } from '@/lib/agents/university'
import { addHoursIso } from '@/lib/clock'
import { tasksFor } from '@/lib/customerTasks'
import { customerFacingStatus } from '@/data/customerMirror'
import { UNIVERSITY_INTEL } from '@/data/universityIntel'
import { US_UNIVERSITIES } from '@/lib/eligibility'
import { allFindings, nameMatchesKey, resolveIntel } from '@/lib/agents/universityCorpus'
// §v5 — the two orchestrators. Imported for the anti-goal sections at the foot
// of this file, which are the only place either property is asserted live.
import {
  runDecisionSufficiency,
  runOnboardingSwarm,
  sufficiencyView,
  verdictFrom,
  type GuardrailOutput,
  type SufficiencyOutput,
} from '@/lib/agents/onboarding'
import {
  releasability,
  runDisbursementSwarm,
  trancheVerdicts,
  type DisbursementGuardrailOutput,
  type LrsOutput,
} from '@/lib/agents/disbursement'
import { POLICY } from '@/data/policy'
import {
  runCreditGuardrail,
  runCreditSwarm,
  type CreditGuardrailOutput,
  type PolicyFitOutput,
} from '@/lib/agents/credit'

const SAMPLE_FILE = 'marksheet-front.jpg'
const SAMPLE_KB = 620

export function AgentInspector() {
  const apps = useStore((s) => s.applications)
  const [fileName, setFileName] = useState(SAMPLE_FILE)

  const curated = useMemo(
    () => apps.filter((a) => {
      const n = Number(a.appId.slice(4))
      return n >= 2601 && n <= 2614
    }),
    [apps],
  )

  const rows = useMemo(
    () => curated.map((app) => probe(app, fileName)),
    [curated, fileName],
  )

  const nonDeterministic = rows.filter((r) => !r.deterministic)
  const noSpread = rows.filter((r) => r.spreadMs < 200)

  // A live run, so the timer itself can be watched rather than inferred from
  // the duration column. This is the only timer-driven code in the codebase.
  const [liveApp, setLiveApp] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-mono text-[12px] text-slate-800">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[15px] font-bold">agent runtime inspector</h1>
        <label className="flex items-center gap-2">
          filename
          <input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <span className="text-slate-500">
          (try <code>blurry.jpg</code>, <code>passport-scan.jpg</code>, <code>cropped-cut.jpg</code>)
        </span>
        <Link to="/__dev/tasks" className="ml-auto text-blue-700 underline">
          tasks
        </Link>
        <Link to="/console" className="text-blue-700 underline">
          console
        </Link>
      </header>

      <section
        className={`mb-4 rounded border p-3 ${
          nonDeterministic.length === 0
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="font-bold">
          Determinism:{' '}
          {nonDeterministic.length === 0
            ? `identical across two runs on all ${rows.length} application(s)`
            : `${nonDeterministic.length} NON-DETERMINISTIC`}
        </p>
        <p className={noSpread.length === 0 ? 'text-slate-600' : 'text-amber-700'}>
          Parallelism: {noSpread.length === 0
            ? 'every swarm has a visible spread between its fastest and slowest lane'
            : `${noSpread.length} swarm(s) finish within 200ms of each other — would read as one task`}
        </p>
      </section>

      <section className="mb-4 rounded border border-slate-300 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-bold">Live run</span>
          {curated.slice(0, 4).map((a) => (
            <button
              key={a.appId}
              onClick={() => setLiveApp(liveApp === a.appId ? null : a.appId)}
              className={`rounded border px-2 py-1 ${
                liveApp === a.appId
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300'
              }`}
            >
              {a.appId}
            </button>
          ))}
          <span className="text-slate-500">— watch the lanes finish at different moments</span>
        </div>
        {liveApp ? (
          <div className="glib max-w-[560px] rounded border border-slate-200 p-3">
            <LiveRun app={curated.find((a) => a.appId === liveApp)!} fileName={fileName} />
          </div>
        ) : null}
      </section>

      <table className="w-full border-collapse bg-white text-left">
        <thead className="sticky top-0 bg-slate-200">
          <tr>
            {['app', 'document', 'verdict', 'lane durations (ms)', 'spread', 'deterministic', 'customer sees', 'bank sees'].map(
              (h) => (
                <th key={h} className="border border-slate-300 px-2 py-1 font-semibold">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.appId} className={r.deterministic ? '' : 'bg-red-50'}>
              <td className="border border-slate-200 px-2 py-1">{r.appId}</td>
              <td className="border border-slate-200 px-2 py-1">{r.docLabel}</td>
              <td className="border border-slate-200 px-2 py-1">{r.verdict}</td>
              <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">
                {r.durations.map((d) => `${AGENT_BY_ID[d.agent]?.name.split(' ')[0]} ${d.ms}`).join(' · ')}
              </td>
              <td className="border border-slate-200 px-2 py-1">{r.spreadMs}</td>
              <td
                className={`border border-slate-200 px-2 py-1 font-bold ${
                  r.deterministic ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {r.deterministic ? 'yes' : 'NO'}
              </td>
              <td className="border border-slate-200 px-2 py-1 align-top">
                {r.customerFindings.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <ul>
                    {r.customerFindings.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="border border-slate-200 px-2 py-1 align-top">
                {r.bankFindings.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <ul>
                    {r.bankFindings.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 max-w-[100ch] text-slate-600">
        “customer sees” lists only findings whose <code>audience</code> is{' '}
        <code>customer</code>. A fraud finding appearing in that column is a
        defect — the customer is told <em>“someone will take a quick look”</em>{' '}
        and never what was flagged.
      </p>

      {/* §v5 — the orchestrators. Curated 14 for the per-row tables; the whole
          book is passed separately because the cohort agents learn from the
          population, not from the sample being displayed. */}
      <OrchestratorSection apps={curated} book={apps} />

      {/* Whole book — only ~15 files reach disbursement, and none of the
          curated 14 but APP-2612. */}
      <DisbursementSection book={apps} />

      <UniversitySection apps={curated} />
      {/* Fed from EVERY application, not the curated 14 — the point is to see
          every university name the system can produce, including the 30-name
          bulk pool where the business-school concatenations live. */}
      <ResolutionSection apps={apps} />
    </div>
  )
}

/** Mounts the real `AgentSwarm` against a real application, so the timer is
 *  watched rather than inferred. Re-keyed on the filename so changing it
 *  restarts the run. */
function LiveRun({ app, fileName }: { app: Application; fileName: string }) {
  const doc =
    app.documents.find((d) => /marksheet|transcript/i.test(d.label)) ?? app.documents[0]
  const capture = useMemo(() => runCapture(doc, fileName, SAMPLE_KB), [doc, fileName])
  const results = useMemo(
    () => runDocumentSwarm(app, doc, capture) as AgentResults,
    [app, doc, capture],
  )
  const plan = useMemo(
    () => planRun('document', app.appId, `${doc.id}|${fileName}|${SAMPLE_KB}|${Date.now()}`, { forCustomer: true }),
    [app.appId, doc.id, fileName],
  )

  return (
    <AgentSwarm
      plan={plan}
      results={results}
      title="Checking your document"
      intro="Three things happen at once."
      audience="customer"
    />
  )
}

// ============================================================================
// §E — the university swarm.
//
// Two properties, both asserted rather than asserted-about:
//
//   1. DETERMINISM — the swarm runs twice per application and the JSON is
//      diffed, exactly as the document swarm is. `fetchedAt` comes off the
//      PROTOTYPE clock, so two runs in the same clock state must produce the
//      same stamp; if someone ever swaps in `Date.now()` this column goes red.
//   2. NO CUSTOMER LEAK — a brief is bank work. Asserted three ways, because
//      each one catches a different mistake:
//        a. a customer-facing PLAN has zero lanes (the agent is `internal`), so
//           the lane cannot even appear on a customer screen;
//        b. no finding carries `audience: 'customer'`;
//        c. the brief's own strings appear nowhere in the customer projection —
//           `tasksFor()` plus `customerFacingStatus()`, which together are what
//           a customer route actually renders. This is the runtime equivalent of
//           the ad-hoc route scanner, and it is stronger for the brief
//           specifically: it runs against an application that HAS a brief
//           attached, which is the only state in which a leak is possible.
// ============================================================================

// ============================================================================
// §E — corpus RESOLUTION diagnostic.
//
// The corpus is being extended to the FT Top 50 US MBA schools. Three
// vocabularies name these institutions and none of them agree: the selectable
// list in `lib/eligibility.ts`, the 30-name pool in `data/seedBulk.ts`, and
// whatever key the researcher filed each dossier under. A business school is
// conventionally named for its benefactor — 'Ross', 'Tepper', 'Marshall' — not
// for its parent university.
//
// A resolution miss is SILENT: it looks exactly like `coverage: 'absent'`, which
// renders as a legitimate "nobody has looked" state. So the failure mode is a
// researched dossier sitting in the corpus, unreachable, while the panel says
// nobody researched it. This table is the thing that makes that visible: every
// distinct university across every live application, resolved twice — once for a
// business programme and once for an engineering one — with the dossier key and
// the match method shown.
//
// Read it after any corpus extension. Rows in the `unresolved` count are either
// genuinely un-researched or misfiled, and the two are worth telling apart.
// ============================================================================

const PROBE_BUSINESS = 'MBA'
const PROBE_STEM = 'MS Computer Science'

/** Name-matching guards, asserted against a FIXED table rather than against
 *  whatever dossiers happen to exist today.
 *
 *  The pairs that matter most are the ones that must NOT match — a wrong match
 *  attaches real, sourced findings about one institution to a different
 *  institution's credit file, which is worse than no brief at all. Those cannot
 *  be demonstrated from the live corpus, because the dangerous counterpart
 *  dossier ('Boston University' alongside 'Boston College') may not be in it. */
const MATCH_GUARDS: { app: string; key: string; expect: boolean; why: string }[] = [
  // --- must match: the cases the FT Top 50 MBA scope introduces ---
  { app: 'University of Michigan Ross', key: 'Michigan', expect: true, why: 'parent-university key reaches the concatenated seed name; leftover "ross" names a school, not an institution' },
  { app: 'University of Michigan Ross', key: 'Ross', expect: true, why: 'a benefactor key would also reach it' },
  { app: 'University of Michigan Ross', key: 'University of Michigan Ross School of Business', expect: true, why: 'full school name, stopwords dropped' },
  { app: 'Purdue University', key: 'Purdue', expect: true, why: '"University" is a stopword' },
  { app: 'NYU Stern', key: 'Stern', expect: true, why: 'benefactor key' },
  // --- must NOT match: the wrong-institution cases ---
  { app: 'University of Michigan', key: 'Ross', expect: false, why: 'no shared token — an engineering file must not pull the MBA brief' },
  { app: 'Michigan State University', key: 'Michigan', expect: false, why: 'leftover "state" defines a different institution' },
  { app: 'Penn State University', key: 'Penn', expect: false, why: 'FOUND LIVE — Penn State was resolving to the Penn/Wharton dossier before the institution-token rule was generalised' },
  { app: 'Illinois Institute of Technology IIT Chicago', key: 'Chicago', expect: false, why: 'place-only key refused — leftover names another institution entirely' },
  { app: 'Boston College', key: 'Boston University', expect: false, why: 'a place name alone cannot carry a match' },
  { app: 'Boston University', key: 'Boston College', expect: false, why: 'same guard, reversed' },
  { app: 'University of Washington', key: 'Washington University', expect: false, why: 'genuinely different institutions' },
  { app: 'NYU', key: 'Stern', expect: false, why: 'no shared token — the corpus must name the parent to reach this file' },
  { app: 'Georgia Tech', key: 'Georgia Institute of Technology', expect: false, why: 'KNOWN LIMIT — "Tech" and "Technology" are different tokens; the corpus correctly files this one as "Georgia Tech"' },
]

interface ResolutionRow {
  university: string
  short: string
  apps: number
  businessKey?: string
  businessMethod: 'exact' | 'token' | 'none'
  stemKey?: string
  stemMethod: 'exact' | 'token' | 'none'
}

function ResolutionSection({ apps }: { apps: Application[] }) {
  const rows = useMemo(() => {
    const byKey = new Map<string, ResolutionRow>()
    for (const a of apps) {
      const key = `${a.university}||${a.universityShort}`
      const existing = byKey.get(key)
      if (existing) {
        existing.apps += 1
        continue
      }
      const b = resolveIntel(a.university, a.universityShort, PROBE_BUSINESS)
      const s = resolveIntel(a.university, a.universityShort, PROBE_STEM)
      byKey.set(key, {
        university: a.university,
        short: a.universityShort,
        apps: 1,
        businessKey: b.matchedKey,
        businessMethod: b.method,
        stemKey: s.matchedKey,
        stemMethod: s.method,
      })
    }
    // Sorted for a stable read across runs.
    return [...byKey.values()].sort((x, y) => x.university.localeCompare(y.university))
  }, [apps])

  // Determinism of resolution itself — scoring plus tiebreaks must be a total
  // order, or the same file could resolve to a different dossier between runs.
  const resolutionDeterministic = useMemo(
    () =>
      rows.every((r) => {
        const a = resolveIntel(r.university, r.short, PROBE_BUSINESS)
        const b = resolveIntel(r.university, r.short, PROBE_BUSINESS)
        return a.matchedKey === b.matchedKey && a.method === b.method
      }),
    [rows],
  )

  const guardFailures = MATCH_GUARDS.filter((g) => nameMatchesKey(g.app, g.key) !== g.expect)
  const unresolved = rows.filter((r) => r.businessMethod === 'none' && r.stemMethod === 'none')
  const split = rows.filter((r) => r.businessKey !== r.stemKey)
  const appsCovered = rows
    .filter((r) => r.businessMethod !== 'none' || r.stemMethod !== 'none')
    .reduce((n, r) => n + r.apps, 0)
  const totalApps = rows.reduce((n, r) => n + r.apps, 0)

  return (
    <>
      <h2 className="mb-2 mt-6 text-[14px] font-bold">corpus resolution (§E — FT Top 50 MBA scope)</h2>

      {/* Name-matching guards. These run against a fixed table, so they hold
          whether or not the corpus has landed its MBA dossiers yet. */}
      <section
        className={`mb-3 rounded border p-3 ${
          guardFailures.length === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="font-bold">
          Name-matching guards:{' '}
          {guardFailures.length === 0
            ? `all ${MATCH_GUARDS.length} hold — business-school keys reach their files, and wrong-institution pairs are refused`
            : `${guardFailures.length} of ${MATCH_GUARDS.length} FAILED`}
        </p>
        <table className="mt-2 w-full border-collapse bg-white text-left">
          <tbody>
            {MATCH_GUARDS.map((g) => {
              const got = nameMatchesKey(g.app, g.key)
              const ok = got === g.expect
              return (
                <tr key={`${g.app}|${g.key}`} className={ok ? '' : 'bg-red-100'}>
                  <td className="border border-slate-200 px-2 py-0.5">{g.app}</td>
                  <td className="border border-slate-200 px-2 py-0.5 text-slate-400">vs</td>
                  <td className="border border-slate-200 px-2 py-0.5 font-medium">{g.key}</td>
                  <td
                    className={`border border-slate-200 px-2 py-0.5 font-bold ${
                      ok ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {got ? 'match' : 'no match'} {ok ? '✓' : `✗ expected ${g.expect ? 'match' : 'no match'}`}
                  </td>
                  <td className="border border-slate-200 px-2 py-0.5 text-slate-500">{g.why}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section
        className={`mb-3 rounded border p-3 ${
          resolutionDeterministic ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="font-bold">
          Resolution determinism:{' '}
          {resolutionDeterministic
            ? 'every university resolves to the same dossier on repeated runs'
            : 'NON-DETERMINISTIC — scoring ties are not totally ordered'}
        </p>
        <p className="text-slate-600">
          Corpus: <b>{UNIVERSITY_INTEL.length}</b> dossiers ·{' '}
          {UNIVERSITY_INTEL.reduce((n, u) => n + u.findings.length, 0)} findings. Applications:{' '}
          <b>{appsCovered}</b> of {totalApps} resolve to a dossier, across{' '}
          {rows.length - unresolved.length} of {rows.length} distinct university names.
        </p>
        <p className={unresolved.length === 0 ? 'text-slate-600' : 'text-amber-700'}>
          Unresolved: {unresolved.length === 0 ? 'none' : `${unresolved.length} name(s) — `}
          {unresolved.length > 0 && (
            <span className="font-medium">{unresolved.map((r) => r.university).join(' · ')}</span>
          )}
        </p>
        <p className="text-slate-600">
          Programme-sensitive splits (a business programme resolving to a different dossier than an
          engineering one at the same university):{' '}
          <b>{split.length}</b>
          {split.length > 0 && ` — ${split.map((r) => r.university).join(' · ')}`}
        </p>
      </section>

      <table className="w-full border-collapse bg-white text-left">
        <thead className="sticky top-0 bg-slate-200">
          <tr>
            {['university (as on the file)', 'short', 'apps', `dossier · ${PROBE_BUSINESS}`, `dossier · ${PROBE_STEM}`].map(
              (h) => (
                <th key={h} className="border border-slate-300 px-2 py-1 font-semibold">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const none = r.businessMethod === 'none' && r.stemMethod === 'none'
            const cell = (key: string | undefined, method: 'exact' | 'token' | 'none') =>
              method === 'none' ? (
                <span className="text-amber-700">—</span>
              ) : (
                <>
                  <span className="font-medium text-emerald-700">{key}</span>{' '}
                  <span className="text-slate-400">({method})</span>
                </>
              )
            return (
              <tr key={`${r.university}|${r.short}`} className={none ? 'bg-amber-50' : ''}>
                <td className="border border-slate-200 px-2 py-1">{r.university}</td>
                <td className="border border-slate-200 px-2 py-1 text-slate-500">{r.short}</td>
                <td className="border border-slate-200 px-2 py-1 tnum text-slate-500">{r.apps}</td>
                <td
                  className={`border border-slate-200 px-2 py-1 ${
                    r.businessKey !== r.stemKey ? 'bg-blue-50' : ''
                  }`}
                >
                  {cell(r.businessKey, r.businessMethod)}
                </td>
                <td
                  className={`border border-slate-200 px-2 py-1 ${
                    r.businessKey !== r.stemKey ? 'bg-blue-50' : ''
                  }`}
                >
                  {cell(r.stemKey, r.stemMethod)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-3 max-w-[100ch] text-slate-600">
        An unresolved row and a genuinely un-researched university render{' '}
        <em>identically</em> on the App-360 panel — both read <code>coverage: absent</code>. That is
        why this table exists separately: it distinguishes “no dossier was written” from “a dossier
        was written and we cannot reach it”. Blue cells are programme-sensitive splits, which is the
        business-school preference working as intended.{' '}
        <b>
          Resolution carries NO alias table on purpose
        </b>{' '}
        — writing out fifty benefactor-to-university pairs would be reproducing the FT Top 50 list,
        which is researched data and belongs in the corpus beside its source.
      </p>
    </>
  )
}

interface UniProbe {
  appId: string
  university: string
  programme: string
  sources: number
  revision: number
  fetchedAt: string
  coverage: 'adequate' | 'thin' | 'absent'
  /** Findings on file for the university that this PROGRAMME filtered out. */
  setAside: number
  /** The corpus guarantees no finding is 'block'. Asserted, not trusted. */
  blockLevels: number
  deterministic: boolean
  /** Lanes a CUSTOMER-facing plan would contain. Must be 0. */
  customerLanes: number
  /** Findings addressed to the customer. Must be 0. */
  customerFindings: number
  /** Brief strings found in the customer projection. Must be empty. */
  leaks: string[]
  /** The 24h boundary, probed either side of it. */
  staleAt25h: boolean
  freshAt23h: boolean
}

/** Every distinctive string the brief carries. Deliberately EXCLUDES the
 *  university and programme names: those are the customer's own facts and appear
 *  all over their screens legitimately. What must never appear is the research —
 *  publishers, source titles, links, the synthesis and the category labels. */
function briefNeedles(brief: UniversityBrief, app: Application): string[] {
  const out: string[] = [brief.headline, ...brief.synthesis]
  for (const s of brief.sources) {
    out.push(s.id, s.url, s.publisher, s.headline, s.detail, s.categoryLabel)
  }
  // The customer's OWN facts appear on their screens legitimately, so a needle
  // that is merely their university or programme name is not a leak.
  //
  // This is not hypothetical tidying: a university press office is a legitimate
  // source, and the corpus carries `publisher: 'Dartmouth'`. Without this the
  // detector reported a leak on every Dartmouth file — a false positive that,
  // left in, would have trained a reader to ignore a red "LEAKING" banner.
  //
  // Everything that actually matters survives: URLs, source headlines, details,
  // corpus ids, synthesis lines and category labels are none of them substrings
  // of a university name.
  const benign = `${app.university} ${app.universityShort} ${app.program}`.toLowerCase()
  return out
    .filter((s) => s.trim().length > 3)
    .filter((s) => !benign.includes(s.trim().toLowerCase()))
}

function probeUniversity(app: Application): UniProbe {
  const a = runUniversitySwarm(app)
  const b = runUniversitySwarm(app)

  const strip = (r: Record<string, import('@/lib/agents/types').AgentResult>) =>
    JSON.stringify(
      Object.values(r).map((x) => ({
        agent: x.agent,
        headline: x.headline,
        // Finding ids carry a module counter that is expected to advance between
        // two runs in one session — everything else must match byte for byte.
        findings: x.findings.map((f) => [f.agent, f.level, f.audience, f.title, f.detail]),
        output: x.output,
      })),
    )

  const brief = briefFromRun(a)!

  // (a) A customer-facing plan for this swarm must be empty.
  const customerLanes = planRun('university', app.appId, app.appId, { forCustomer: true }).tasks.length

  // (b) No finding may be addressed to the customer.
  const customerFindings = findingsFor(a as AgentResults, 'customer').length

  // (c) Attach the brief and serialise everything a customer route renders.
  const withBrief: Application = { ...app, universityBrief: brief }
  const customerSurface = JSON.stringify({
    tasks: tasksFor(withBrief),
    status: customerFacingStatus(withBrief),
  })
  const leaks = briefNeedles(brief, app).filter((n) => customerSurface.includes(n))

  return {
    appId: app.appId,
    university: app.university,
    programme: app.program,
    sources: brief.sources.length,
    revision: brief.revision,
    fetchedAt: brief.fetchedAt,
    coverage: brief.coverage,
    // Counted against whichever dossier the brief ACTUALLY resolved to, which
    // is programme-sensitive now that business schools are in scope.
    setAside: Math.max(
      0,
      allFindings(app.university, app.universityShort, app.program).length - brief.sources.length,
    ),
    // The corpus documents that `level` is never 'block'. Trust nothing: a brief
    // that could block would let a newspaper stop a customer's file.
    blockLevels: Object.values(a).flatMap((r) => r.findings).filter((f) => f.level === 'block').length,
    deterministic: strip(a) === strip(b),
    customerLanes,
    customerFindings,
    leaks,
    // The TTL boundary, probed from both sides against the brief's own stamp.
    // Pure — no clock mutation, so this assertion holds regardless of what
    // offset the operator has applied.
    staleAt25h: briefIsStale(brief, addHoursIso(brief.fetchedAt, 25)),
    freshAt23h: !briefIsStale(brief, addHoursIso(brief.fetchedAt, 23)),
  }
}

function UniversitySection({ apps }: { apps: Application[] }) {
  const advanceClock = useStore((s) => s.advanceClock)
  const resetClockOffset = useStore((s) => s.resetClockOffset)
  const offset = useStore((s) => s.clockOffsetHours)

  // TWO populations, because they exercise different halves of the corpus.
  //
  // The bulk seed (APP-2601…2614) names universities from a WIDER list than the
  // 14 the pre-qualification screen can select, so most of those rows land on
  // `coverage: 'absent'` — which is the state most likely to be got wrong, and
  // therefore worth looking at. The synthetic rows below pin one application per
  // SELECTABLE university, which is where the research actually lives and where
  // a journey-created file (APP-2901+) ends up.
  const synthetic = useMemo(() => {
    if (apps.length === 0) return []
    const perUniversity = US_UNIVERSITIES.map(
      (u): Application => ({
        ...apps[0],
        appId: `SYNTH-${u.short}`,
        university: u.name,
        universityShort: u.short,
      }),
    )
    // Programme NARROWING, made visible. Several corpus findings are tagged to
    // specific programmes — MIT's reduced graduate intake is tagged to the taught
    // MS/MEng courses, for instance. Holding the university fixed and varying
    // only the programme is what makes the "set aside" column move, and proves
    // the filter is doing something rather than passing everything through.
    const perProgramme = ['MBA', 'MPH', 'MS Data Science'].map(
      (program): Application => ({
        ...apps[0],
        appId: `SYNTH-MIT/${program}`,
        university: 'Massachusetts Institute of Technology',
        universityShort: 'MIT',
        program,
      }),
    )
    return [...perUniversity, ...perProgramme]
  }, [apps])

  const rows = useMemo(() => [...apps, ...synthetic].map(probeUniversity), [apps, synthetic, offset])

  const bad = rows.filter((r) => !r.deterministic)
  const leaking = rows.filter(
    (r) => r.leaks.length > 0 || r.customerFindings > 0 || r.customerLanes > 0,
  )
  const ttlWrong = rows.filter((r) => !r.staleAt25h || !r.freshAt23h)
  const blocking = rows.filter((r) => r.blockLevels > 0)
  const covered = rows.filter((r) => r.coverage === 'adequate').length

  return (
    <>
      <h2 className="mb-2 mt-6 text-[14px] font-bold">university swarm (§E)</h2>

      <section
        className={`mb-3 rounded border p-3 ${
          bad.length === 0 && leaking.length === 0 && ttlWrong.length === 0 && blocking.length === 0
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="font-bold">
          Determinism:{' '}
          {bad.length === 0
            ? `identical across two runs on all ${rows.length} application(s)`
            : `${bad.length} NON-DETERMINISTIC`}
        </p>
        <p className="font-bold">
          Customer leak:{' '}
          {leaking.length === 0
            ? 'the brief reaches no customer route — 0 customer lanes, 0 customer-audience findings, 0 brief strings in the customer projection'
            : `${leaking.length} LEAKING`}
        </p>
        <p className={ttlWrong.length === 0 ? 'text-slate-600' : 'font-bold text-red-700'}>
          {BRIEF_TTL_HOURS}h staleness:{' '}
          {ttlWrong.length === 0
            ? `fresh at +23h, stale at +25h, on every row (prototype clock — there is no Date.now() in this path)`
            : `${ttlWrong.length} row(s) get the boundary WRONG`}
        </p>
        <p className={blocking.length === 0 ? 'text-slate-600' : 'font-bold text-red-700'}>
          Never blocking:{' '}
          {blocking.length === 0
            ? 'no finding carries level "block" — university news informs a credit view, it cannot stop a file'
            : `${blocking.length} row(s) emit a BLOCKING finding`}
        </p>
        <p className="text-slate-600">
          Corpus: {UNIVERSITY_INTEL.length} universities ·{' '}
          {UNIVERSITY_INTEL.reduce((n, u) => n + u.findings.length, 0)} researched findings ·{' '}
          {UNIVERSITY_INTEL.filter((u) => u.coverage === 'thin').length} marked thin · {covered} of{' '}
          {rows.length} rows below resolve to a dossier
        </p>
      </section>

      {/* The live re-crawl. Advancing past 24h makes every brief on file stale;
          opening App-360 → University brief then re-runs the crawl, bumps the
          revision and writes an audit line stamped at the advanced time. */}
      <section className="mb-3 rounded border border-slate-300 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">Re-crawl</span>
          <span className="text-slate-500">prototype clock</span>
          <span className="font-semibold text-blue-700">+{offset}h</span>
          <button onClick={() => advanceClock(25)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
            +25h (trip the {BRIEF_TTL_HOURS}h TTL)
          </button>
          <button onClick={() => advanceClock(1)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
            +1h
          </button>
          {offset > 0 && (
            <button onClick={resetClockOffset} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
              reset
            </button>
          )}
          <span className="text-slate-500">
            — then open <code>/console</code> → an application → <b>University brief</b>: the
            revision increments, the previous stamp is printed beside the new one, and a fresh{' '}
            <code>UNIVERSITY BRIEF REFRESHED</code> line appears on the Audit tab.
          </span>
        </div>
      </section>

      <table className="w-full border-collapse bg-white text-left">
        <thead className="sticky top-0 bg-slate-200">
          <tr>
            {['app', 'university', 'programme', 'sources', 'set aside', 'coverage', 'rev', 'fetchedAt (proto clock)', 'deterministic', 'block', 'cust. lanes', 'cust. findings', 'leaks', '24h boundary'].map((h) => (
              <th key={h} className="border border-slate-300 px-2 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const clean =
              r.deterministic &&
              r.leaks.length === 0 &&
              r.customerFindings === 0 &&
              r.customerLanes === 0 &&
              r.blockLevels === 0 &&
              r.staleAt25h &&
              r.freshAt23h
            return (
              <tr key={r.appId} className={clean ? '' : 'bg-red-50'}>
                <td className="border border-slate-200 px-2 py-1">{r.appId}</td>
                <td className="border border-slate-200 px-2 py-1">{r.university}</td>
                <td className="border border-slate-200 px-2 py-1">{r.programme}</td>
                <td className="border border-slate-200 px-2 py-1 tnum">{r.sources}</td>
                <td className="border border-slate-200 px-2 py-1 tnum text-slate-500">
                  {r.setAside > 0 ? r.setAside : '—'}
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  <span
                    className={
                      r.coverage === 'adequate'
                        ? 'text-emerald-700'
                        : r.coverage === 'thin'
                          ? 'text-slate-500'
                          : 'font-semibold text-amber-700'
                    }
                  >
                    {r.coverage}
                  </span>
                </td>
                <td className="border border-slate-200 px-2 py-1 tnum">{r.revision}</td>
                <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{r.fetchedAt}</td>
                <td className={`border border-slate-200 px-2 py-1 font-bold ${r.deterministic ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.deterministic ? 'yes' : 'NO'}
                </td>
                <td className={`border border-slate-200 px-2 py-1 font-bold ${r.blockLevels === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.blockLevels}
                </td>
                <td className={`border border-slate-200 px-2 py-1 font-bold ${r.customerLanes === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.customerLanes}
                </td>
                <td className={`border border-slate-200 px-2 py-1 font-bold ${r.customerFindings === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.customerFindings}
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  {r.leaks.length === 0 ? (
                    <span className="font-bold text-emerald-700">none</span>
                  ) : (
                    <span className="font-bold text-red-700">{r.leaks.join(' | ')}</span>
                  )}
                </td>
                <td className={`border border-slate-200 px-2 py-1 ${r.staleAt25h && r.freshAt23h ? 'text-emerald-700' : 'font-bold text-red-700'}`}>
                  {r.freshAt23h ? '23h fresh' : '23h WRONG'} · {r.staleAt25h ? '25h stale' : '25h WRONG'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-3 max-w-[100ch] text-slate-600">
        “leaks” serialises <code>tasksFor()</code> and <code>customerFacingStatus()</code> — what a
        customer route actually renders — against an application that HAS a brief attached, and
        looks for any of the brief’s publishers, source titles, links, synthesis lines or category
        labels. The university and programme names are excluded on purpose: those are the
        customer’s own facts and belong on their screens. The research does not.
      </p>
    </>
  )
}

interface Probe {
  appId: string
  docLabel: string
  verdict: string
  durations: { agent: AgentId; ms: number }[]
  spreadMs: number
  deterministic: boolean
  customerFindings: string[]
  bankFindings: string[]
}

function probe(app: Application, fileName: string): Probe {
  const doc =
    app.documents.find((d) => /marksheet|transcript/i.test(d.label)) ?? app.documents[0]

  const capture = runCapture(doc, fileName, SAMPLE_KB)
  const a = runDocumentSwarm(app, doc, capture) as AgentResults
  const b = runDocumentSwarm(app, doc, capture) as AgentResults

  // Compare on everything except the finding ids, which carry a module counter
  // and are expected to differ between two runs in the same session.
  const strip = (r: AgentResults) =>
    JSON.stringify(
      Object.values(r).map((x) => ({
        agent: x?.agent,
        headline: x?.headline,
        findings: x?.findings.map((f) => [f.agent, f.level, f.audience, f.title, f.detail]),
        output: x?.output,
      })),
    )

  const plan = planRun('document', app.appId, `${doc.id}|${fileName}|${SAMPLE_KB}`)
  const ms = plan.tasks.map((t) => t.durationMs)

  const all = Object.values(a).filter(Boolean)
  return {
    appId: app.appId,
    docLabel: doc.label.slice(0, 34),
    verdict: capture.verdict,
    durations: plan.tasks.map((t) => ({ agent: t.agent, ms: t.durationMs })),
    spreadMs: ms.length ? Math.max(...ms) - Math.min(...ms) : 0,
    deterministic: strip(a) === strip(b),
    customerFindings: all
      .flatMap((r) => r!.findings)
      .filter((f) => f.audience === 'customer')
      .map((f) => `${f.agent}: ${f.title}`),
    bankFindings: all
      .flatMap((r) => r!.findings)
      .filter((f) => f.audience === 'bank')
      .map((f) => `${f.agent}: ${f.title}`),
  }
}

export { runDuration }

// ============================================================================
// The two orchestrators (§v5).
//
// The assisting swarms above are checked for determinism and for keeping bank
// findings away from the customer. The orchestrators need one thing more, and
// it is the reason they were built as an architecture change rather than five
// more swarm functions: each carries an ANTI-GOAL — a thing it must be unable
// to do — and an intention is not a property. These two sections run the
// anti-goal tests on every curated file and show the result per row.
//
//   Onboarding must measure whether a file is DECIDABLE, never whether it would
//   be APPROVED. Proven by forcing the decision to APPROVE and to DECLINE and
//   requiring all three sufficiency outputs to be byte-identical.
//
//   Credit must assess with no influence from what sales concluded. Proven by
//   running the assessment with and without the onboarding verdict attached and
//   requiring byte-identical output.
//
// A test that cannot fail proves nothing, and this codebase has already shipped
// one that could not (see `assessmentFingerprint`). So both sections carry a
// NEGATIVE CONTROL: a deliberately rigged input that the test MUST reject. If a
// control ever goes green, the test beside it has stopped meaning anything.
// ============================================================================

/** A synthetic verdict to attach to a file that has none. Seed applications
 *  carry no `onboardingVerdict`, so an independence test run on them compares
 *  two identical inputs — vacuously equal. Attaching one first is what gives
 *  the test something to actually be independent OF. */
const PROBE_VERDICT: OnboardingVerdict = {
  ready: false,
  blockingReasons: ['PROBE — 3 checks nobody has answered', 'PROBE — co-applicant income unevidenced'],
  headlines: [{ agent: 'minimum_data', headline: 'PROBE HEADLINE' }],
  assessedAt: '2026-07-20T10:00:00.000Z',
}

interface OnbProbe {
  appId: string
  ready: boolean
  decidable: boolean
  unanswered: number
  notApplicable: number
  deterministic: boolean
  sufficiencyIndependent: boolean
  noSpillover: boolean
  noCustomerAudience: boolean
  /** `planRun(..., { forCustomer: true })` must plan NO lanes — all four agents
   *  are `internal`, so the customer never watches onboarding run. */
  customerLanes: number
  customerFindings: number
  offences: string[]
}

function probeOnboarding(app: Application, book: Application[]): OnbProbe {
  const results = runOnboardingSwarm(app, book)
  const guard = results.onboarding_guardrail?.output as GuardrailOutput
  const suff = results.decision_sufficiency?.output as SufficiencyOutput
  const verdict = verdictFrom(results)
  return {
    appId: app.appId,
    ready: verdict.ready,
    decidable: suff.decidable,
    unanswered: suff.unanswered.length,
    notApplicable: suff.notApplicable.length,
    deterministic: guard.deterministic,
    sufficiencyIndependent: guard.sufficiencyIndependentOfOutcome,
    noSpillover: guard.noCreditSpillover,
    noCustomerAudience: guard.noCustomerAudience,
    customerLanes: planRun('onboarding', app.appId, app.appId, { forCustomer: true }).tasks.length,
    customerFindings: findingsFor(results, 'customer').length,
    offences: guard.offences,
  }
}

/** NEGATIVE CONTROL for "sufficiency is not approvability".
 *
 *  The real test compares sufficiency across a forced APPROVE / DECLINE. It can
 *  only mean something if those two inputs are genuinely distinguishable — if
 *  `sufficiencyView` stripped the decision AND the forcing never happened, the
 *  comparison would be two identical objects and would pass on anything.
 *
 *  So: assert the UNSTRIPPED application does differ under the same forcing.
 *  Green here means the mutation is real and the stripping is what neutralises
 *  it. Red means the test above is vacuous. */
function sufficiencyControlIsLive(app: Application): boolean {
  const base = JSON.stringify({ ...app, decision: 'APPROVE' })
  const other = JSON.stringify({ ...app, decision: 'DECLINE', rejectionCode: 'REJ-01' })
  const stripped = JSON.stringify(sufficiencyView({ ...app, decision: 'APPROVE' }))
  const strippedOther = JSON.stringify(
    sufficiencyView({ ...app, decision: 'DECLINE', rejectionCode: 'REJ-01' }),
  )
  // The raw records differ; the views handed to 1.3 do not. That is the whole
  // mechanism, asserted rather than assumed.
  return base !== other && stripped === strippedOther
}

interface CredProbe {
  appId: string
  position: string
  policyTests: number
  outsidePolicy: number
  /** Parameters the file does not carry a figure for. Absence is not
   *  compliance, so these are reported rather than counted as passes. */
  unassessable: number
  deterministic: boolean
  independent: boolean
  noWriteBack: boolean
  /** The verdict was attached before the guardrail ran, so the with/without
   *  comparison had a real difference to be blind to. */
  verdictWasAttached: boolean
  /** NEGATIVE CONTROL — a payload that DOES read the verdict must differ. */
  controlDetectsLeak: boolean
  offences: string[]
}

function probeCredit(app: Application, book: Application[]): CredProbe {
  // Attach a verdict first — see PROBE_VERDICT.
  const withVerdict: Application = { ...app, onboardingVerdict: PROBE_VERDICT }
  const guard = runCreditGuardrail(withVerdict, book).output as CreditGuardrailOutput
  const results = runCreditSwarm(withVerdict, book)
  const summary = results.fresh_assessment?.output as { position?: string } | undefined
  const policy = results.policy_fit?.output as PolicyFitOutput | undefined

  // The control: a fingerprint that deliberately INCLUDES the verdict must come
  // out different with and without it. If even that comes out equal, the two
  // inputs are indistinguishable and the independence test above is vacuous.
  const leaky = (a: Application) => JSON.stringify([a.onboardingVerdict ?? null])
  const controlDetectsLeak =
    leaky(withVerdict) !== leaky({ ...app, onboardingVerdict: undefined } as Application)

  return {
    appId: app.appId,
    position: summary?.position ?? '—',
    policyTests: policy?.tests.length ?? 0,
    outsidePolicy: policy?.outside ?? 0,
    unassessable: policy?.unassessable ?? 0,
    deterministic: guard.deterministic,
    independent: guard.independentOfOnboarding,
    noWriteBack: guard.noWriteBack,
    verdictWasAttached: withVerdict.onboardingVerdict !== undefined,
    controlDetectsLeak,
    offences: guard.offences,
  }
}

function Yn({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'text-emerald-700' : 'font-bold text-red-700'}>{ok ? 'yes' : 'NO'}</span>
  )
}

function Banner({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={ok ? 'text-slate-700' : 'font-bold text-red-700'}>
      {ok ? '✓ ' : '✗ '}
      {children}
    </p>
  )
}

function OrchestratorSection({ apps, book }: { apps: Application[]; book: Application[] }) {
  const onb = useMemo(() => apps.map((a) => probeOnboarding(a, book)), [apps, book])
  // Book-wide, because the curated 14 are `seed.ts` literals and carry no
  // waivers — the construct-derived ones live on the generated population. Only
  // 1.3 is run here, not the swarm: no cohort work, so 214 files stay cheap.
  const bookNa = useMemo(() => {
    let files = 0
    for (const a of book) {
      const o = runDecisionSufficiency(sufficiencyView(a)).output as SufficiencyOutput
      if (o.notApplicable.length > 0) files++
    }
    return files
  }, [book])
  const cred = useMemo(() => apps.map((a) => probeCredit(a, book)), [apps, book])
  const controls = useMemo(() => apps.map(sufficiencyControlIsLive), [apps])

  const onbBad = onb.filter(
    (r) =>
      !r.deterministic ||
      !r.sufficiencyIndependent ||
      !r.noSpillover ||
      !r.noCustomerAudience ||
      r.customerLanes > 0 ||
      r.customerFindings > 0,
  )
  const credBad = cred.filter((r) => !r.deterministic || !r.independent || !r.noWriteBack)
  const deadControls = controls.filter((c) => !c).length
  const deadCreditControls = cred.filter((r) => !r.controlDetectsLeak || !r.verdictWasAttached).length

  return (
    <>
      <h2 className="mb-2 mt-6 text-[14px] font-bold">onboarding orchestrator (§v5) — anti-goal: decidable, not approvable</h2>
      <section
        className={`mb-3 rounded border p-3 ${
          onbBad.length === 0 && deadControls === 0
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <Banner ok={onbBad.every((r) => r.sufficiencyIndependent) && onb.length > 0}>
          <strong>Sufficiency is not approvability</strong> — decision forced to APPROVE and to
          DECLINE, all three outputs byte-identical on{' '}
          {onb.filter((r) => r.sufficiencyIndependent).length}/{onb.length} file(s)
        </Banner>
        <Banner ok={deadControls === 0}>
          <strong>Negative control</strong> — the forcing does change the raw record, and only the{' '}
          <code>SufficiencyView</code> neutralises it, on {onb.length - deadControls}/{onb.length}.
          A red line here means the test above compares two identical objects and proves nothing.
        </Banner>
        <Banner ok={onb.every((r) => r.deterministic)}>
          <strong>Determinism</strong> — same file, same verdict
        </Banner>
        <Banner ok={onb.every((r) => r.noSpillover)}>
          <strong>No credit spillover</strong> — no finding carries a REJ-/DEV- code or an asserted
          eligibility amount
        </Banner>
        <Banner ok={onb.every((r) => r.noCustomerAudience && r.customerLanes === 0 && r.customerFindings === 0)}>
          <strong>No customer leak</strong> — every finding is <code>audience: 'bank'</code>, and{' '}
          <code>planRun(…, {'{'} forCustomer: true {'}'})</code> plans 0 lanes. The customer sees
          tasks, never a readiness score.
        </Banner>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-100">
            {['app', 'ready', 'decidable', 'unanswered', 'n/a', 'determ.', 'suff⊥outcome', 'control live', 'no spillover', 'bank-only', 'cust. lanes', 'offences'].map((h) => (
              <th key={h} className="border border-slate-200 px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {onb.map((r, i) => (
            <tr key={r.appId} className="odd:bg-white even:bg-slate-50">
              <td className="border border-slate-200 px-2 py-1">{r.appId}</td>
              <td className="border border-slate-200 px-2 py-1">{r.ready ? 'ready' : 'held'}</td>
              <td className="border border-slate-200 px-2 py-1">{r.decidable ? 'yes' : 'no'}</td>
              <td className="border border-slate-200 px-2 py-1">{r.unanswered}</td>
              <td className="border border-slate-200 px-2 py-1">{r.notApplicable}</td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.deterministic} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.sufficiencyIndependent} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={controls[i]} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.noSpillover} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.noCustomerAudience} /></td>
              <td className="border border-slate-200 px-2 py-1">{r.customerLanes}</td>
              <td className="border border-slate-200 px-2 py-1 text-red-700">
                {r.offences.length === 0 ? <span className="text-slate-400">—</span> : r.offences.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-[100ch] text-slate-600">
        <strong>“n/a” is the column that justifies agent 1.3.</strong>{' '}
        <code>evaluateGate</code> treats an <em>absent</em> validation as resolved, so the gate
        cannot tell “not applicable” from “never collected”. Sufficiency is the only thing in the
        codebase that separates them — a file can be fully <em>decidable</em> with checks it never
        ran, and undecidable with none outstanding.{' '}
        <strong>
          It reads 0 on all 14 rows above, and that is not the column failing.
        </strong>{' '}
        The curated 14 are <code>seed.ts</code> literals and carry no waived validation; the
        construct-derived waivers (VAL-INT-12 for a self-employed co-applicant, VAL-INT-13 for a
        salaried one) are generated onto the bulk population.{' '}
        <strong>{bookNa} of {book.length}</strong> files across the whole book carry a
        not-applicable — which is what makes the distinction demonstrable rather than declared.
      </p>

      <h2 className="mb-2 mt-6 text-[14px] font-bold">credit orchestrator (§v5) — anti-goal: no influence from sales</h2>
      <section
        className={`mb-3 rounded border p-3 ${
          credBad.length === 0 && deadCreditControls === 0
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <Banner ok={cred.every((r) => r.independent)}>
          <strong>Independent of the onboarding verdict</strong> — assessment byte-identical with
          and without it on {cred.filter((r) => r.independent).length}/{cred.length} file(s)
        </Banner>
        <Banner ok={deadCreditControls === 0}>
          <strong>Negative control</strong> — a verdict was actually attached before the test ran,
          and a payload that <em>does</em> read it comes out different, on{' '}
          {cred.length - deadCreditControls}/{cred.length}. Seed files carry no verdict; without
          attaching one the test would compare two identical inputs — the exact way this guardrail
          was broken once already.
        </Banner>
        <Banner ok={cred.every((r) => r.deterministic)}>
          <strong>Determinism</strong> — same file, same position
        </Banner>
        <Banner ok={cred.every((r) => r.noWriteBack)}>
          <strong>No write-back</strong> — no credit agent mutated the record it was reading
        </Banner>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-100">
            {['app', 'position', 'policy tests', 'outside', 'unassessable', 'determ.', 'independent', 'verdict attached', 'control detects leak', 'no write-back', 'offences'].map((h) => (
              <th key={h} className="border border-slate-200 px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cred.map((r) => (
            <tr key={r.appId} className="odd:bg-white even:bg-slate-50">
              <td className="border border-slate-200 px-2 py-1">{r.appId}</td>
              <td className="border border-slate-200 px-2 py-1">{r.position}</td>
              <td className="border border-slate-200 px-2 py-1">{r.policyTests}</td>
              <td className={`border border-slate-200 px-2 py-1 ${r.outsidePolicy > 0 ? 'font-bold text-amber-700' : ''}`}>{r.outsidePolicy}</td>
              <td className="border border-slate-200 px-2 py-1">{r.unassessable}</td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.deterministic} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.independent} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.verdictWasAttached} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.controlDetectsLeak} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.noWriteBack} /></td>
              <td className="border border-slate-200 px-2 py-1 text-red-700">
                {r.offences.length === 0 ? <span className="text-slate-400">—</span> : r.offences.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-[100ch] text-slate-600">
        Both orchestrators are <strong>bank-facing</strong>: all nine sub-agents are{' '}
        <code>internal</code>, which is why the “cust. lanes” column is 0 and why{' '}
        <code>AgentSwarm</code>’s <code>audience="bank"</code> branch exists at all.
      </p>
    </>
  )
}

// ============================================================================
// The disbursement gating orchestrator (§v5).
//
// Its anti-goal runs the OPPOSITE way to the other two. Onboarding and credit
// are each given LESS than the record — a stripped view — and the proof is that
// output does not move when the stripped thing changes. This one must be given
// MORE: the LRS ceiling is an annual aggregate, so a schedule that splits a
// breach across four instalments passes every per-tranche check ever written
// and breaches the cap.
//
// So the control here is a POSITIVE one: a file rigged with four tranches, each
// comfortably inside the cap, together 12% over it. `perTrancheLrsWouldPass`
// must say yes and `runLrsAggregate` must say no. The day those two agree, the
// aggregate view has stopped being load-bearing.
// ============================================================================

interface DisbProbe {
  appId: string
  tranches: number
  lrsHeadroomUsd: number
  lrsWithin: boolean
  blocked: number
  statutoryBlocks: string[]
  overridableBlocks: string[]
  deterministic: boolean
  noWriteBack: boolean
  cannotRelease: boolean
  aggregateBeatsPerTranche: boolean
  /** A forged override on a statutory gate must NOT clear it. */
  statutoryResistsOverride: boolean
  offences: string[]
}

function probeDisbursement(app: Application): DisbProbe {
  const results = runDisbursementSwarm(app)
  const guard = results.disbursement_guardrail?.output as DisbursementGuardrailOutput
  const lrs = results.lrs_aggregate?.output as LrsOutput
  const verdicts = trancheVerdicts(app)
  const failing = verdicts.flatMap((v) => v.gates.filter((g) => !g.passed))

  // Forge an override onto every failing STATUTORY gate and require that the
  // tranche is still held. The store refuses to write one; this asserts the
  // read path refuses to honour one, so the rule survives a record that was
  // tampered with rather than merely a UI that hides the button.
  const statutoryRefs = failing.filter((g) => g.severity === 'statutory')
  let statutoryResistsOverride = true
  if (statutoryRefs.length > 0) {
    const forged: Application = {
      ...app,
      disbursementVerdict: {
        tranches: [],
        lrsHeadroomUsd: 0,
        anyStatutoryBlock: true,
        headlines: [],
        assessedAt: '',
        overrides: verdicts.flatMap((v) =>
          v.gates
            .filter((g) => !g.passed && g.severity === 'statutory')
            .map((g) => ({ trancheId: v.trancheId, ref: g.ref, by: 'FORGED', reason: 'forged', at: '' })),
        ),
      },
    }
    statutoryResistsOverride = verdicts
      .filter((v) => v.statutoryBlocks.length > 0)
      .every((v) => !releasability(forged, v.trancheId).ok)
  }

  return {
    appId: app.appId,
    tranches: verdicts.length,
    lrsHeadroomUsd: lrs.headroomUsd,
    lrsWithin: lrs.within,
    blocked: verdicts.filter((v) => !v.releasable).length,
    statutoryBlocks: [...new Set(failing.filter((g) => g.severity === 'statutory').map((g) => g.ref))],
    overridableBlocks: [...new Set(failing.filter((g) => g.severity === 'overridable').map((g) => g.ref))],
    deterministic: guard.deterministic,
    noWriteBack: guard.noWriteBack,
    cannotRelease: guard.cannotRelease,
    aggregateBeatsPerTranche: guard.aggregateBeatsPerTranche,
    statutoryResistsOverride,
    offences: guard.offences,
  }
}

function DisbursementSection({ book }: { book: Application[] }) {
  // Every file that actually has a schedule, not the curated 14 — only one of
  // those reaches disbursement, and one row proves nothing about a per-tranche
  // orchestrator.
  const withTranches = useMemo(() => book.filter((a) => (a.tranches ?? []).length > 0), [book])
  const rows = useMemo(() => withTranches.map(probeDisbursement), [withTranches])
  // The guardrail runs on EVERY file, including the 199 with no schedule at
  // all — an agent that divides by zero on an empty tranche list would be a
  // defect the 15 rows above could never surface.
  const allClean = useMemo(
    () =>
      book.every(
        (a) => (runDisbursementSwarm(a).disbursement_guardrail?.output as DisbursementGuardrailOutput).offences.length === 0,
      ),
    [book],
  )

  const customerLanes = planRun('disbursement', 'PROBE', 'PROBE', { forCustomer: true }).tasks.length
  const customerFindings = useMemo(
    () => book.reduce((n, a) => n + findingsFor(runDisbursementSwarm(a), 'customer').length, 0),
    [book],
  )

  const ok = (f: (r: DisbProbe) => boolean) => rows.length > 0 && rows.every(f)

  return (
    <>
      <h2 className="mb-2 mt-6 text-[14px] font-bold">
        disbursement orchestrator (§v5) — anti-goal: the cap is an aggregate, not an instalment
      </h2>
      <section
        className={`mb-3 rounded border p-3 ${
          allClean && ok((r) => r.statutoryResistsOverride)
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-red-300 bg-red-50'
        }`}
      >
        <Banner ok={ok((r) => r.aggregateBeatsPerTranche)}>
          <strong>Positive control — the aggregate catches what per-tranche misses.</strong> On a
          file rigged with four tranches of USD 70,000, <code>perTrancheLrsWouldPass</code> returns
          true and <code>runLrsAggregate</code> blocks. Both must hold on{' '}
          {rows.filter((r) => r.aggregateBeatsPerTranche).length}/{rows.length}. If they ever agree,
          the aggregate view has stopped doing anything.
        </Banner>
        <Banner ok={ok((r) => r.statutoryResistsOverride)}>
          <strong>Statutory gates resist a forged override.</strong> An override is written onto
          every failing statutory gate and the tranche must still be held — the rule lives in the
          read path, not only in a hidden button.
        </Banner>
        <Banner ok={ok((r) => r.cannotRelease)}>
          <strong>Cannot release</strong> — no tranche status, gate array or A2 flag moved during a
          full assessment
        </Banner>
        <Banner ok={ok((r) => r.noWriteBack)}>
          <strong>No write-back</strong> — the record is byte-identical after the run
        </Banner>
        <Banner ok={allClean}>
          <strong>Determinism, on all {book.length} files</strong> — including the{' '}
          {book.length - rows.length} with no schedule at all, where an empty tranche list must not
          throw
        </Banner>
        <Banner ok={customerLanes === 0 && customerFindings === 0}>
          <strong>No customer leak</strong> — all five agents are <code>internal</code>, so{' '}
          <code>planRun('disbursement', …, {'{'} forCustomer: true {'}'})</code> plans{' '}
          {customerLanes} lanes and the swarm produces {customerFindings} customer-audience
          findings. Two of the four holds are statutory limits the customer cannot act on; the
          post-sanction screen still reads the seeded <code>gatesFor</code> and is unchanged.
        </Banner>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-100">
            {['app', 'tranches', 'LRS headroom (USD)', 'within cap', 'held', 'statutory', 'overridable', 'agg beats per-tranche', 'forged override refused', 'cannot release', 'offences'].map((h) => (
              <th key={h} className="border border-slate-200 px-2 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.appId} className="odd:bg-white even:bg-slate-50">
              <td className="border border-slate-200 px-2 py-1">{r.appId}</td>
              <td className="border border-slate-200 px-2 py-1">{r.tranches}</td>
              <td className="border border-slate-200 px-2 py-1">{r.lrsHeadroomUsd.toLocaleString('en-US')}</td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.lrsWithin} /></td>
              <td className={`border border-slate-200 px-2 py-1 ${r.blocked > 0 ? 'font-bold text-amber-700' : ''}`}>{r.blocked}</td>
              <td className="border border-slate-200 px-2 py-1 text-red-700">{r.statutoryBlocks.join(', ') || <span className="text-slate-400">—</span>}</td>
              <td className="border border-slate-200 px-2 py-1 text-amber-700">{r.overridableBlocks.join(', ') || <span className="text-slate-400">—</span>}</td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.aggregateBeatsPerTranche} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.statutoryResistsOverride} /></td>
              <td className="border border-slate-200 px-2 py-1"><Yn ok={r.cannotRelease} /></td>
              <td className="border border-slate-200 px-2 py-1 text-red-700">
                {r.offences.length === 0 ? <span className="text-slate-400">—</span> : r.offences.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-[100ch] text-slate-600">
        <strong>“within cap” is true on every row, and that is the honest result.</strong> This
        product is capped at ₹1 Cr, which at ₹{POLICY.fxReference}/USD is about USD{' '}
        {Math.round(10_000_000 / POLICY.fxReference).toLocaleString('en-US')} — a single file
        cannot reach a USD {POLICY.lrsCapUsd.toLocaleString('en-US')} ceiling on its own. The check
        is not decoration: it is the reason the schedule is added up at all, it binds the moment the
        product ceiling moves, and the LRS figure it reports is the applicant’s remaining headroom
        for the year. What it cannot see — remittances made through another bank in the same
        financial year — it says so rather than implying the cap is clear.
      </p>
    </>
  )
}
