// ============================================================================
// /__dev/tasks — the projection inspector (§P2).
//
// The build order is engine first, then screens: this exists so the projection
// can be proved correct across all 14 curated applications BEFORE a single task
// card is written. It also carries the acceptance-item-8 reconciliation —
// the CJ-15 header count against the dashboard's own sourcing mix — because a
// number that agrees only by eye does not agree.
//
// Dev surface: dense, unbranded, no customer copy rules. It is a workbench.
// ============================================================================
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Application, PartyRole } from '@/types'
import { useStore } from '@/store/appStore'
import { buildTasks, collectedHeadline } from '@/lib/customerTasks'
import { sourcingMix } from '@/lib/sourcing'
import { humanSeconds } from '@/journeys/common/glib'
import { JOURNEY_APP_FLOOR } from '@/journeys/newApplication'

const PARTIES: PartyRole[] = ['applicant', 'co_applicant', 'collateral_provider']

export function TaskInspector() {
  const apps = useStore((s) => s.applications)
  const [only, setOnly] = useState<'curated' | 'journey' | 'all'>('curated')

  const shown = useMemo(() => {
    if (only === 'all') return apps.slice(0, 60)
    if (only === 'journey') {
      // Journey files sit above everything the seed occupies.
      const seedMax = 2900
      return apps.filter((a) => Number(a.appId.slice(4)) > Math.max(seedMax, JOURNEY_APP_FLOOR - 1))
    }
    return apps.filter((a) => {
      const n = Number(a.appId.slice(4))
      return n >= 2601 && n <= 2614
    })
  }, [apps, only])

  const leaks = useMemo(() => shown.flatMap(findLeaks), [shown])

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-mono text-[12px] text-slate-800">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[15px] font-bold">customerTasks projection inspector</h1>
        <div className="flex gap-1">
          {(['curated', 'journey', 'all'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`rounded border px-2 py-1 ${
                only === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <Link to="/console" className="ml-auto text-blue-700 underline">
          console
        </Link>
      </header>

      <section
        className={`mb-4 rounded border p-3 ${
          leaks.length === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
        }`}
      >
        <p className="font-bold">
          Party isolation (acceptance item 7):{' '}
          {leaks.length === 0
            ? `clean across ${shown.length} application(s)`
            : `${leaks.length} LEAK(S)`}
        </p>
        {leaks.map((l) => (
          <p key={l} className="text-red-700">
            {l}
          </p>
        ))}
      </section>

      <table className="w-full border-collapse bg-white text-left">
        <thead className="sticky top-0 bg-slate-200">
          <tr>
            {[
              'app',
              'stage',
              'docs',
              'collected',
              'needs you',
              'mix: manual',
              'mix: consent',
              'redo',
              'agrees?',
              'student tasks',
              'parent tasks',
              'security tasks',
            ].map((h) => (
              <th key={h} className="border border-slate-300 px-2 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => {
            const h = collectedHeadline(a)
            const mix = sourcingMix(a)
            // Acceptance item 8: the header count and the dashboard's sourcing
            // mix are two views of ONE document list, so they must reconcile
            // exactly — total, and the customer-side outstanding split.
            const agrees =
              h.total === mix.total &&
              h.needsUpload === mix.outstandingManual &&
              h.needsConsent === mix.outstandingBlockedOnConsent
            return (
              <tr key={a.appId} className={agrees ? '' : 'bg-red-50'}>
                <td className="border border-slate-200 px-2 py-1">
                  <Link className="text-blue-700 underline" to={`/apply/${a.appId}/tasks`}>
                    {a.appId}
                  </Link>
                </td>
                <td className="border border-slate-200 px-2 py-1">{String(a.stage)}</td>
                <td className="border border-slate-200 px-2 py-1">{h.total}</td>
                <td className="border border-slate-200 px-2 py-1">{h.collected}</td>
                <td className="border border-slate-200 px-2 py-1 font-bold">{h.needsYou}</td>
                <td className="border border-slate-200 px-2 py-1">
                  {h.needsUpload} / {mix.outstandingManual}
                </td>
                <td className="border border-slate-200 px-2 py-1">
                  {h.needsConsent} / {mix.outstandingBlockedOnConsent}
                </td>
                <td className="border border-slate-200 px-2 py-1">{h.needsRedo}</td>
                <td
                  className={`border border-slate-200 px-2 py-1 font-bold ${
                    agrees ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {agrees ? 'yes' : 'NO'}
                </td>
                {PARTIES.map((p) => (
                  <td key={p} className="border border-slate-200 px-2 py-1 align-top">
                    <TaskCell app={a} party={p} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-4 max-w-[90ch] text-slate-600">
        “agrees?” compares the CJ-15 headline against{' '}
        <code>lib/sourcing.sourcingMix()</code> — the same analytic the
        dashboard&rsquo;s document-sourcing-mix card renders. Both are derived
        from one document list; a disagreement means the projection has grown its
        own accounting and must be fixed, not reconciled.
      </p>
    </div>
  )
}

function TaskCell({ app, party }: { app: Application; party: PartyRole }) {
  const tasks = buildTasks(app, party)
  if (tasks.length === 0) return <span className="text-slate-400">—</span>
  return (
    <ul className="space-y-0.5">
      {tasks.map((t) => (
        <li key={t.id} className="whitespace-nowrap">
          <span
            className={`mr-1 rounded px-1 ${
              t.origin === 'send_back'
                ? 'bg-orange-200'
                : t.origin === 'validation'
                  ? 'bg-amber-200'
                  : t.blocking
                    ? 'bg-blue-100'
                    : 'bg-slate-100'
            }`}
          >
            {t.kind}
          </span>
          {t.title}
          <span className="ml-1 text-slate-500">
            ({t.docIds?.length ?? 0} docs · {humanSeconds(t.estSeconds)})
          </span>
        </li>
      ))}
    </ul>
  )
}

/** §7.6 — the student must never see a co-applicant document and vice versa.
 *  Enforced in the projection, PROVED here. */
function findLeaks(app: Application): string[] {
  const sectionOf = new Map(app.buckets.map((b) => [b.id, b.section]))
  const docSection = (id: string) => {
    const d = app.documents.find((x) => x.id === id)
    return d ? sectionOf.get(d.bucketId) : undefined
  }
  const allowed: Record<PartyRole, string[]> = {
    applicant: ['applicant', 'loan'],
    co_applicant: ['co_applicant'],
    collateral_provider: ['collateral'],
  }
  const out: string[] = []
  for (const party of PARTIES) {
    for (const t of buildTasks(app, party)) {
      for (const id of t.docIds ?? []) {
        const sec = docSection(id)
        if (sec && !allowed[party].includes(sec)) {
          out.push(`${app.appId}: ${party} task "${t.title}" contains a ${sec} document (${id})`)
        }
      }
    }
  }
  return out
}
