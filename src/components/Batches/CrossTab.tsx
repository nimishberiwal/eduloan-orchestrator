// ============================================================================
// Cross-tab: any group dimension against any other (e.g. branch × stage), with
// heat shading. This is what makes batch mode read as a real back-office tool.
// ============================================================================
import type { CrossTab as CrossTabData, GroupKey } from '@/lib/groupBy'
import { GROUP_KEYS } from '@/lib/groupBy'
import { inr } from '@/lib/format'

export function CrossTabView({
  tab, metric, rowKey, colKey,
}: {
  tab: CrossTabData
  metric: 'count' | 'value'
  rowKey: GroupKey
  colKey: GroupKey
}) {
  const fmt = (v: number) => (v === 0 ? '—' : metric === 'value' ? inr(v) : String(v))
  const peak = Math.max(1, ...tab.cells.flat())
  const label = (k: GroupKey) => GROUP_KEYS.find((g) => g.key === k)?.label ?? k

  return (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-card">
      <table className="w-full text-12">
        <thead>
          <tr className="border-b border-[var(--line)] bg-slate-50/80">
            <th className="sticky left-0 z-10 bg-slate-50/80 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {label(rowKey)} \ {label(colKey)}
            </th>
            {tab.cols.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {c.label.length > 18 ? c.label.slice(0, 17) + '…' : c.label}
              </th>
            ))}
            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">Total</th>
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((r, ri) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0">
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700">{r.label}</td>
              {tab.cells[ri].map((v, ci) => {
                const intensity = v === 0 ? 0 : Math.min(1, v / peak)
                return (
                  <td
                    key={ci}
                    className="px-2 py-1.5 text-right tnum"
                    style={{
                      backgroundColor: v === 0 ? undefined : `rgba(79, 70, 229, ${0.06 + intensity * 0.32})`,
                      color: intensity > 0.6 ? '#1e1b4b' : undefined,
                    }}
                  >
                    {fmt(v)}
                  </td>
                )
              })}
              <td className="px-3 py-1.5 text-right font-semibold tnum text-slate-700">{fmt(tab.rowTotals[ri])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--line)] bg-slate-50/80">
            <td className="sticky left-0 z-10 bg-slate-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Total
            </td>
            {tab.colTotals.map((v, i) => (
              <td key={i} className="px-2 py-2 text-right font-semibold tnum text-slate-700">{fmt(v)}</td>
            ))}
            <td className="px-3 py-2 text-right font-semibold tnum text-slate-900">{fmt(tab.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
