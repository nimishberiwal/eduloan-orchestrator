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
import type { Application, UniversityBrief } from '@/types'
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

      <UniversitySection apps={curated} />
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
function briefNeedles(brief: UniversityBrief): string[] {
  const out: string[] = [brief.headline, ...brief.synthesis]
  for (const s of brief.sources) {
    out.push(s.id, s.url, s.publisher, s.headline, s.detail, s.categoryLabel)
  }
  return out.filter((s) => s.trim().length > 3)
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
  const leaks = briefNeedles(brief).filter((n) => customerSurface.includes(n))

  return {
    appId: app.appId,
    university: app.university,
    programme: app.program,
    sources: brief.sources.length,
    revision: brief.revision,
    fetchedAt: brief.fetchedAt,
    coverage: brief.coverage,
    setAside: Math.max(
      0,
      (UNIVERSITY_INTEL.find(
        (u) => u.university === app.universityShort || u.name === app.university,
      )?.findings.length ?? 0) - brief.sources.length,
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
