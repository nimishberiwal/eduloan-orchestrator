// ============================================================================
// Analytics (§12.4) — computed live from in-memory state.
// §v2: every rollup now reports ₹ value alongside count (req 6), and a
// dedicated rejection/closure section answers "who, when and why" (req 8).
// ============================================================================
import { useMemo, useState } from 'react'
import { useStore } from '@/store/appStore'
import { applyFilters } from '@/lib/filters'
import { fmtDate, inr } from '@/lib/format'
import {
  agingRollup, blockerRollup, branchRollup, channelRollup, deviationRollup,
  doaRollup, expiringRollup, funnelRollup, portfolioSummary, slaRollup,
  stageValueRollup, tatRollup,
} from '@/lib/reports'
import { portfolioSourcingMix } from '@/lib/sourcing'
import { RejectionInsights } from './RejectionInsights'

type Metric = 'value' | 'count'

export function Analytics() {
  const all = useStore((s) => s.applications)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const clauses = useStore((s) => s.filterClauses)
  const role = useStore((s) => s.role)
  const [metric, setMetric] = useState<Metric>('value')
  const [section, setSection] = useState<'overview' | 'closures'>('overview')

  const apps = useMemo(
    () => applyFilters(all, search, filters, role, clauses),
    [all, search, filters, role, clauses],
  )

  const summary = useMemo(() => portfolioSummary(apps), [apps])
  const stages = useMemo(() => stageValueRollup(apps), [apps])
  const funnel = useMemo(() => funnelRollup(apps), [apps])
  const tat = useMemo(() => tatRollup(apps), [apps])
  const blockers = useMemo(() => blockerRollup(apps), [apps])
  const aging = useMemo(() => agingRollup(apps), [apps])
  const doa = useMemo(() => doaRollup(apps), [apps])
  const devs = useMemo(() => deviationRollup(apps), [apps])
  const expiring = useMemo(() => expiringRollup(apps), [apps])
  const channels = useMemo(() => channelRollup(apps), [apps])
  const branches = useMemo(() => branchRollup(apps), [apps])
  const sla = useMemo(() => slaRollup(apps), [apps])
  const sourcing = useMemo(() => portfolioSourcingMix(apps), [apps])

  const m = (c: number, v: number) => (metric === 'value' ? inr(v) : String(c))

  return (
    <div className="thin-scroll h-full overflow-auto p-4">
      {/* Section + measure toggles */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5 shadow-card">
          {([['overview', 'Overview'], ['closures', 'Rejections & closures']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`rounded-md px-3 py-1.5 text-13 font-medium transition-colors ${
                section === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5 shadow-card">
          {(['value', 'count'] as const).map((x) => (
            <button
              key={x}
              onClick={() => setMetric(x)}
              className={`rounded-md px-2.5 py-1 text-12 font-medium transition-colors ${
                metric === x ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {x === 'value' ? '₹ Value' : 'Count'}
            </button>
          ))}
        </div>
        <span className="text-11 text-slate-400">{apps.length} applications in scope</span>
      </div>

      {section === 'closures' ? (
        <RejectionInsights apps={apps} metric={metric} />
      ) : (
        <>
          {/* Headline */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Portfolio" value={inr(summary.total.valueInr)} sub={`${summary.total.count} applications`} />
            <Stat label="Open pipeline" value={inr(summary.open.valueInr)} sub={`${summary.open.count} in flight`} />
            <Stat label="Sanctioned+" value={inr(summary.sanctioned.valueInr)} sub={`${summary.sanctioned.count} files`} tone="emerald" />
            <Stat label="Closed" value={inr(summary.closed.valueInr)} sub={`${summary.closed.count} files`} tone="red" />
            <Stat label="Approval rate" value={`${summary.approvalRatePct}%`} sub="of decided files" tone="brand" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title={`Stage-wise exposure — ${metric === 'value' ? '₹ value' : 'count'}`} span2>
              <div className="space-y-1">
                {stages.map((s) => {
                  const measure = metric === 'value' ? s.valueInr : s.count
                  const peak = Math.max(...stages.map((x) => (metric === 'value' ? x.valueInr : x.count)), 1)
                  return (
                    <div key={s.stage} className="flex items-center gap-2 text-12">
                      <span className="w-9 font-mono text-slate-400">{s.stage}</span>
                      <span className="w-32 truncate text-slate-500">{s.name}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-brand-500" style={{ width: `${(measure / peak) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right font-semibold tnum text-slate-700">{inr(s.valueInr)}</span>
                      <span className="w-8 text-right tnum text-slate-400">{s.count}</span>
                      <span className="w-12 text-right tnum text-slate-400">{s.medianDays}d</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="Funnel — reach & drop-off">
              <div className="space-y-1">
                {funnel.map((f) => (
                  <div key={f.stage} className="flex items-center gap-1.5 text-11">
                    <span className="w-8 font-mono text-slate-400">{f.stage}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-brand-400" style={{ width: `${f.pctReached}%` }} />
                    </div>
                    <span className="w-16 text-right tnum text-slate-600">{inr(f.valueInr)}</span>
                    <span className="w-7 text-right tnum text-slate-400">{f.count}</span>
                    <span className="w-10 text-right tnum text-slate-400">
                      {f.dropOff != null ? `−${f.dropOff}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="TAT per stage (days)">
              <div className="space-y-1 text-12">
                {tat.map((t) => (
                  <div key={t.stage} className="flex items-center justify-between">
                    <span className="font-mono text-slate-400">{t.stage}</span>
                    <span className="text-slate-600">
                      med <b className="tnum">{t.median}</b>d · p90 <b className="tnum">{t.p90}</b>d
                      <span className="ml-1 text-slate-400">(n={t.n})</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Blocker split">
              <RowList
                rows={blockers.map((b) => ({
                  key: b.kind,
                  label: b.kind === 'third_party' ? 'Third-party' : b.kind[0].toUpperCase() + b.kind.slice(1),
                  count: b.count,
                  valueInr: b.valueInr,
                }))}
                metric={metric}
              />
            </Card>

            <Card title="SLA state (open files)">
              <RowList
                rows={sla.map((s) => ({
                  key: s.state,
                  label: s.state.replace('_', ' '),
                  count: s.count,
                  valueInr: s.valueInr,
                  tone: s.state === 'breached' ? 'red' : s.state === 'due_soon' ? 'amber' : undefined,
                }))}
                metric={metric}
              />
            </Card>

            <Card title="Aging RAG (open files)">
              <RowList
                rows={aging.map((a) => ({
                  key: a.rag,
                  label: a.rag === 'green' ? 'Green (<3d)' : a.rag === 'amber' ? 'Amber (3–7d)' : 'Red (>7d)',
                  count: a.count,
                  valueInr: a.valueInr,
                  tone: a.rag === 'red' ? 'red' : a.rag === 'amber' ? 'amber' : undefined,
                }))}
                metric={metric}
              />
            </Card>

            <Card title="DoA queue depth">
              <RowList
                rows={doa.map((d) => ({ key: d.band, label: d.band, count: d.count, valueInr: d.valueInr }))}
                metric={metric}
              />
            </Card>

            <Card title="Channel conversion">
              <div className="space-y-1.5 text-12">
                {channels.map((c) => (
                  <div key={c.channel}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-600">{c.channel}</span>
                      <span className="tnum text-slate-500">
                        {inr(c.valueInr)} · {c.count} · <b className="text-emerald-600">{c.conversionPct}%</b>
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${c.conversionPct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Deviations open by type">
              {devs.length === 0 ? (
                <Empty>No open deviations.</Empty>
              ) : (
                <RowList
                  rows={devs.map((d) => ({ key: d.type, label: d.type, count: d.count, valueInr: d.valueInr, tone: 'amber' }))}
                  metric={metric}
                />
              )}
            </Card>

            <Card title="Branch exposure" span2>
              <div className="thin-scroll max-h-64 overflow-y-auto">
                <table className="w-full text-12">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-1 text-left">Branch</th>
                      <th className="py-1 text-left">City</th>
                      <th className="py-1 text-right">Value</th>
                      <th className="py-1 text-right">Apps</th>
                      <th className="py-1 text-right">Open</th>
                      <th className="py-1 text-right">Closed</th>
                      <th className="py-1 text-right">Med d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr key={b.branchId} className="border-t border-slate-100">
                        <td className="py-1 font-medium text-slate-700">{b.branch}</td>
                        <td className="py-1 text-slate-500">{b.city}</td>
                        <td className="py-1 text-right font-semibold tnum text-slate-700">{inr(b.valueInr)}</td>
                        <td className="py-1 text-right tnum text-slate-500">{b.count}</td>
                        <td className="py-1 text-right tnum text-slate-500">{b.open}</td>
                        <td className="py-1 text-right tnum text-red-500">{b.closed}</td>
                        <td className="py-1 text-right tnum text-slate-500">{b.medianDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* §v3 — the automation-ROI metric the BRDs are ultimately arguing for */}
            <Card title="Document sourcing mix" span2>
              <p className="mb-2 text-11 text-slate-500">
                How the checklist is obtained across the portfolio. Auto-fetch and consent-fetch are
                digitally sourced; only manual upload requires the customer to send something.
              </p>
              <RowList
                rows={[
                  { key: 'auto', label: 'Auto-fetch (public registry)', count: sourcing.byMode.auto_fetch, valueInr: 0 },
                  { key: 'consent', label: 'Consent fetch', count: sourcing.byMode.consent_fetch, valueInr: 0 },
                  { key: 'manual', label: 'Manual upload', count: sourcing.byMode.manual_upload, valueInr: 0, tone: 'amber' },
                  { key: 'bank', label: 'Bank / panel vendor', count: sourcing.byMode.bank_generated, valueInr: 0 },
                  { key: 'internal', label: 'Internal policy table', count: sourcing.byMode.internal, valueInr: 0 },
                ]}
                metric="count"
                hideValue
              />
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 lg:grid-cols-4">
                <MiniStat label="Digitally sourceable" value={`${sourcing.automatablePct}%`} tone="emerald" />
                <MiniStat label="Outstanding items" value={String(sourcing.outstanding)} />
                <MiniStat label="Blocked on consent" value={String(sourcing.blocked)} sub={inr(sourcing.valueBlocked)} tone="red" />
                <MiniStat label="Awaiting upload" value={String(sourcing.manual)} sub={inr(sourcing.valueManual)} tone="amber" />
              </div>
            </Card>

            <Card title="Sanction-expiry risk (≤30 days)">
              {expiring.length === 0 ? (
                <Empty>None expiring within 30 days.</Empty>
              ) : (
                <div className="thin-scroll max-h-64 space-y-1 overflow-y-auto text-12">
                  {expiring.map((e) => (
                    <div key={e.appId} className="flex items-center justify-between">
                      <span className="font-mono text-11 tnum text-slate-500">{e.appId}</span>
                      <span className="tnum text-slate-500">{inr(e.askInr)}</span>
                      <span className={e.days <= 7 ? 'font-semibold text-red-600' : 'text-amber-600'}>
                        {e.days}d · {fmtDate(e.expiry)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ---- shared bits -----------------------------------------------------------
export function Card({ title, children, span2 }: { title: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`rounded-xl border border-[var(--line)] bg-white p-4 shadow-card ${span2 ? 'xl:col-span-2' : ''}`}>
      <h3 className="mb-3 text-13 font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-12 text-slate-400">{children}</div>
}

export function Stat({
  label, value, sub, tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'emerald' | 'red' | 'brand'
}) {
  const color =
    tone === 'emerald' ? 'text-emerald-600'
    : tone === 'red' ? 'text-red-600'
    : tone === 'brand' ? 'text-brand-600'
    : 'text-slate-800'
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="text-11 text-slate-400">{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-800'
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-14 font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="text-11 text-slate-400">{sub}</div>}
    </div>
  )
}

function RowList({
  rows, metric, hideValue,
}: {
  rows: { key: string; label: string; count: number; valueInr: number; tone?: string }[]
  metric: Metric
  hideValue?: boolean
}) {
  const peak = Math.max(...rows.map((r) => (metric === 'value' ? r.valueInr : r.count)), 1)
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const measure = metric === 'value' ? r.valueInr : r.count
        const bar = r.tone === 'red' ? 'bg-red-500' : r.tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500'
        return (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-12">
              <span className="capitalize text-slate-600">{r.label}</span>
              <span className="tnum text-slate-500">
                {hideValue ? r.count : <>{inr(r.valueInr)} <span className="text-slate-400">· {r.count}</span></>}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${bar}`} style={{ width: `${(measure / peak) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
