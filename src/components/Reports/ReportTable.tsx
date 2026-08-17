// ============================================================================
// Report preview table — dense on screen, paginates cleanly when printed.
// ============================================================================
import { useState } from 'react'
import type { ReportTable } from '@/data/reports'
import { inr } from '@/lib/format'

const PAGE = 100

export function ReportTableView({ table }: { table: ReportTable }) {
  const [limit, setLimit] = useState(PAGE)
  const rows = table.rows.slice(0, limit)
  const more = table.rows.length - rows.length

  if (table.rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white py-12 text-center text-13 text-slate-400 shadow-card">
        No rows for the current scope.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-card print:border-0 print:shadow-none">
      <div className="thin-scroll overflow-x-auto print:overflow-visible">
        <table className="w-full text-12">
          <thead className="border-b border-[var(--line)] bg-slate-50/80 print:table-header-group">
            <tr>
              {table.columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 print:break-inside-avoid">
                {table.columns.map((c) => {
                  const v = c.get(r)
                  return (
                    <td
                      key={c.key}
                      className={`px-2.5 py-1.5 ${c.align === 'right' ? 'text-right tnum' : 'text-left'} ${
                        c.key === 'appId' ? 'font-mono text-11 text-slate-500' : 'text-slate-700'
                      }`}
                    >
                      {String(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {table.totals && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                {table.columns.map((c) => {
                  const t = table.totals![c.key]
                  const isMoney = /value|ask/i.test(c.key) && typeof t === 'number'
                  return (
                    <td
                      key={c.key}
                      className={`px-2.5 py-2 font-semibold text-slate-800 ${
                        c.align === 'right' ? 'text-right tnum' : 'text-left'
                      }`}
                    >
                      {t === undefined ? '' : isMoney ? inr(t as number) : String(t)}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {more > 0 && (
        <div className="no-print border-t border-[var(--line)] px-3 py-2 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE * 5)}
            className="text-12 font-medium text-brand-600 hover:underline"
          >
            Show more — {more} additional row{more > 1 ? 's' : ''} (all {table.rows.length} are exported)
          </button>
        </div>
      )}
    </div>
  )
}
