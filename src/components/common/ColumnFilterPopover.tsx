// ============================================================================
// Per-stage column filter (§v2 req 9) — a stage column can hold hundreds of
// applications, so each one carries its own facet filter + sort.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Filter, X } from 'lucide-react'
import type { Application, FilterClause } from '@/types'
import { AMOUNT_BANDS } from '@/lib/groupBy'
import { BRANCHES } from '@/data/org'
import { useStore } from '@/store/appStore'

export type ColumnSort = 'aging_desc' | 'aging_asc' | 'value_desc' | 'value_asc' | 'name'

export const COLUMN_SORTS: { id: ColumnSort; label: string }[] = [
  { id: 'aging_desc', label: 'Oldest first' },
  { id: 'aging_asc', label: 'Newest first' },
  { id: 'value_desc', label: 'Largest value' },
  { id: 'value_asc', label: 'Smallest value' },
  { id: 'name', label: 'Student A–Z' },
]

const BLOCKERS = [
  { id: 'none', label: 'Not blocked' },
  { id: 'customer', label: 'Customer' },
  { id: 'bank', label: 'Bank' },
  { id: 'third_party', label: '3rd-party' },
]
const AGING = [
  { id: 'green', label: 'Green (<3d)' },
  { id: 'amber', label: 'Amber (3–7d)' },
  { id: 'red', label: 'Red (>7d)' },
]

/** Aging is expressed as a days range so it reuses the generic clause engine. */
const AGING_RANGE: Record<string, [number, number]> = {
  green: [0, 2],
  amber: [3, 7],
  red: [8, 9999],
}

export function ColumnFilterPopover({
  stage,
  sort,
  onSortChange,
}: {
  stage: string
  sort: ColumnSort
  onSortChange: (s: ColumnSort) => void
}) {
  const clauses = useStore((s) => s.columnFilters[stage] ?? [])
  const setColumnFilter = useStore((s) => s.setColumnFilter)
  const clearColumnFilter = useStore((s) => s.clearColumnFilter)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // The column header is `overflow-hidden` (it clips the rounded accent bar),
  // so an absolutely-positioned panel would be clipped. Portal it to the body
  // and position it from the trigger's viewport rect instead.
  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const PANEL_W = 256
    setPos({
      left: Math.min(r.left, window.innerWidth - PANEL_W - 12),
      top: r.bottom + 6,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', h)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', h)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const get = (field: string) => clauses.find((c) => c.field === field)
  const set = (c: FilterClause | null, field: string) => {
    const rest = clauses.filter((x) => x.field !== field)
    setColumnFilter(stage, c ? [...rest, c] : rest)
  }

  const activeCount = clauses.length
  const agingActive = (() => {
    const c = get('daysInStage')
    if (!c) return ''
    const v = c.value as [number, number]
    return Object.keys(AGING_RANGE).find(
      (k) => AGING_RANGE[k][0] === v[0] && AGING_RANGE[k][1] === v[1],
    ) ?? ''
  })()

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Filter this stage"
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
          activeCount > 0
            ? 'bg-brand-600 text-white'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        {activeCount > 0 ? (
          <span className="text-[10px] font-bold tnum">{activeCount}</span>
        ) : (
          <Filter size={13} />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: 256 }}
          className="z-[90] animate-fade-in rounded-xl border border-[var(--line)] bg-white p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-11 font-semibold uppercase tracking-wider text-slate-400">
              Filter {stage}
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          <Group label="Sort">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ColumnSort)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-12"
            >
              {COLUMN_SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Group>

          <Group label="Aging">
            <Pills
              options={AGING}
              active={agingActive}
              onPick={(id) =>
                set(
                  id
                    ? { id: `${stage}-aging`, field: 'daysInStage', op: 'between', value: AGING_RANGE[id] }
                    : null,
                  'daysInStage',
                )
              }
            />
          </Group>

          <Group label="Blocker">
            <Pills
              options={BLOCKERS}
              active={String(get('blocker')?.value ?? '')}
              onPick={(id) =>
                set(id ? { id: `${stage}-blk`, field: 'blocker', op: 'eq', value: id } : null, 'blocker')
              }
            />
          </Group>

          <Group label="Loan amount">
            <Pills
              options={AMOUNT_BANDS.map((b) => ({ id: b.id, label: b.label }))}
              active={String(get('amountBand')?.value ?? '')}
              onPick={(id) =>
                set(id ? { id: `${stage}-amt`, field: 'amountBand', op: 'eq', value: id } : null, 'amountBand')
              }
            />
          </Group>

          <Group label="Branch">
            <select
              value={String(get('branchId')?.value ?? '')}
              onChange={(e) =>
                set(
                  e.target.value
                    ? { id: `${stage}-br`, field: 'branchId', op: 'eq', value: e.target.value }
                    : null,
                  'branchId',
                )
              }
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-12"
            >
              <option value="">Any branch</option>
              {BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Group>

          {activeCount > 0 && (
            <button
              onClick={() => clearColumnFilter(stage)}
              className="mt-1 w-full rounded-lg border border-slate-200 py-1 text-12 font-medium text-slate-500 hover:bg-slate-50"
            >
              Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}

function Pills({
  options,
  active,
  onPick,
}: {
  options: { id: string; label: string }[]
  active: string
  onPick: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = active === o.id
        return (
          <button
            key={o.id}
            onClick={() => onPick(on ? '' : o.id)}
            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
              on
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Sort a column's cards. Kept here so the Kanban and any future list view agree. */
export function sortColumn(apps: Application[], sort: ColumnSort): Application[] {
  const out = [...apps]
  switch (sort) {
    case 'aging_desc': return out.sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt))
    case 'aging_asc': return out.sort((a, b) => b.stageEnteredAt.localeCompare(a.stageEnteredAt))
    case 'value_desc': return out.sort((a, b) => b.askInr - a.askInr)
    case 'value_asc': return out.sort((a, b) => a.askInr - b.askInr)
    case 'name': return out.sort((a, b) => a.studentName.localeCompare(b.studentName))
    default: return out
  }
}
