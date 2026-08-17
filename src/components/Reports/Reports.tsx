// ============================================================================
// Reports (§v2 req 7) — pick a standard report, preview it, export CSV, or
// print to PDF. Reports respect whatever global filters are active.
// ============================================================================
import { useMemo, useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { applyFilters } from '@/lib/filters'
import { REPORT_BY_ID, REPORT_DEFS, REPORT_GROUPS } from '@/data/reports'
import { downloadCsv, stampedName, toCsv } from '@/lib/csv'
import { nowIso } from '@/lib/clock'
import { fmtDateTime } from '@/lib/format'
import { ReportTableView } from './ReportTable'

export function Reports() {
  const all = useStore((s) => s.applications)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.activeFilters)
  const clauses = useStore((s) => s.filterClauses)
  const role = useStore((s) => s.role)
  const pushToast = useStore((s) => s.pushToast)

  const [selectedId, setSelectedId] = useState<string>(REPORT_DEFS[0].id)

  const apps = useMemo(
    () => applyFilters(all, search, filters, role, clauses),
    [all, search, filters, role, clauses],
  )

  const def = REPORT_BY_ID[selectedId]
  const table = useMemo(() => def.build(apps), [def, apps])

  const filterSummary = [
    search ? `search "${search}"` : null,
    filters.length ? `${filters.length} saved filter${filters.length > 1 ? 's' : ''}` : null,
    clauses.length ? `${clauses.length} field filter${clauses.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ') || 'no filters — full portfolio'

  const exportCsv = () => {
    const csv = toCsv(table.columns, table.rows, table.totals)
    downloadCsv(stampedName(def.title, nowIso()), csv)
    pushToast('success', `${def.title} exported (${table.rows.length} rows).`)
  }

  return (
    <div className="thin-scroll h-full overflow-auto">
      <div className="flex min-h-full gap-4 p-4">
        {/* Catalogue */}
        <aside className="no-print w-60 flex-shrink-0">
          <div className="rounded-xl border border-[var(--line)] bg-white p-2 shadow-card">
            {REPORT_GROUPS.map((g) => {
              const defs = REPORT_DEFS.filter((d) => d.group === g)
              if (!defs.length) return null
              return (
                <div key={g} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g}</div>
                  {defs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-12 font-medium transition-colors ${
                        selectedId === d.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <FileText size={13} className={selectedId === d.id ? 'text-white' : 'text-slate-400'} />
                      <span className="flex-1 leading-tight">{d.title}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Report */}
        <section className="min-w-0 flex-1">
          <div className="mb-3 rounded-xl border border-[var(--line)] bg-white p-4 shadow-card print:border-0 print:shadow-none">
            {/* Print letterhead — hidden on screen, shown on paper */}
            <div className="hidden print:mb-3 print:block print:border-b print:border-slate-300 print:pb-2">
              <div className="text-14 font-bold">Horizon Bank · EduLoan Orchestrator</div>
              <div className="text-11">Education Loan — Abroad PG (USA) · prototype data</div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-15 font-semibold text-slate-900">{def.title}</h2>
                <p className="mt-0.5 max-w-2xl text-12 text-slate-500">{def.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-11 text-slate-400">
                  <span>Rows: <b className="tnum text-slate-600">{table.rows.length}</b></span>
                  {table.subtitle && <span>{table.subtitle}</span>}
                  <span>Scope: {filterSummary}</span>
                  <span>Generated {fmtDateTime(nowIso())}</span>
                </div>
              </div>
              <div className="no-print flex flex-shrink-0 gap-2">
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-3 py-1.5 text-13 font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-13 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Printer size={14} /> Print / PDF
                </button>
              </div>
            </div>
          </div>

          <ReportTableView table={table} />
        </section>
      </div>
    </div>
  )
}
