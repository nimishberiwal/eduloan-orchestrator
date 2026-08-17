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
import type { Application } from '@/types'
import { useStore } from '@/store/appStore'
import { runDocumentSwarm } from '@/lib/agents/documents'
import { planRun, runDuration } from '@/lib/agents/runtime'
import { AGENT_BY_ID } from '@/lib/agents/registry'
import { runCapture } from '@/lib/capture'
import { AgentSwarm } from '@/journeys/common/AgentSwarm'
import type { AgentId, AgentResults } from '@/lib/agents/types'

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
