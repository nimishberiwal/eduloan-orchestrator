// ============================================================================
// Top bar — contextual title, global search, saved filters, role switcher, reset
// ============================================================================
import { ChevronDown, RotateCcw, Search, UserCircle2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store/appStore'
import { ROLES } from '@/lib/stateMachine'
import type { RoleId, TabId } from '@/types'

const TAB_TITLE: Record<TabId, { title: string; sub: string }> = {
  pipeline: { title: 'Pipeline', sub: 'Origination orchestration board' },
  queues: { title: 'Queues', sub: 'Department work-lists' },
  app360: { title: 'Application 360', sub: 'The orchestration screen' },
  analytics: { title: 'Analytics', sub: 'Live portfolio metrics' },
  batches: { title: 'Batches', sub: 'Portfolio by branch, city & value' },
  reports: { title: 'Reports', sub: 'Standard reports & exports' },
  automation: { title: 'Automation', sub: 'Stage rules, SLA & escalations' },
}

export function Header() {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const tab = useStore((s) => s.tab)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const savedFilters = useStore((s) => s.savedFilters)
  const activeFilters = useStore((s) => s.activeFilters)
  const toggleFilter = useStore((s) => s.toggleFilter)
  const clearFilters = useStore((s) => s.clearFilters)
  const resetDemo = useStore((s) => s.resetDemo)

  const meta = TAB_TITLE[tab]

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/95 backdrop-blur">
      <div className="flex items-center gap-4 px-5 py-2.5">
        <div className="min-w-0">
          <h1 className="text-15 font-semibold tracking-tight text-slate-900">{meta.title}</h1>
          <p className="text-11 text-slate-400">{meta.sub}</p>
        </div>

        <div className="relative ml-2 flex-1 max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search APP ID, student, university…"
            className="w-full rounded-lg border border-[var(--line)] bg-slate-50/80 py-2 pl-9 pr-3 text-13 text-slate-700 placeholder:text-slate-400 transition-colors focus:border-brand-300 focus:bg-white"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <RolePicker role={role} onChange={setRole} />
          <button
            onClick={resetDemo}
            title="Restore seed exactly"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-12 font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Saved-filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] bg-slate-50/60 px-5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Filters</span>
        {savedFilters.map((f) => {
          if (!f.predicate) return null // v2 clause-based saved filters render elsewhere
          const predicate = f.predicate
          const on = activeFilters.includes(predicate)
          return (
            <button
              key={f.id}
              onClick={() => toggleFilter(predicate)}
              className={`rounded-full border px-2.5 py-1 text-11 font-medium transition-all duration-150 ${
                on
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                  : 'border-[var(--line)] bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          )
        })}
        {activeFilters.length > 0 && (
          <button onClick={clearFilters} className="ml-1 text-11 font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline">
            Clear all
          </button>
        )}
      </div>
    </header>
  )
}

function RolePicker({ role, onChange }: { role: RoleId; onChange: (r: RoleId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ROLES.find((r) => r.id === role)!

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white py-1.5 pl-2 pr-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <UserCircle2 size={16} />
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] uppercase tracking-wide text-slate-400">View as</span>
          <span className="block text-12 font-semibold text-slate-700">{current.label}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 animate-fade-in overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-pop">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Switch role</div>
          {ROLES.map((r) => {
            const active = r.id === role
            return (
              <button
                key={r.id}
                onClick={() => { onChange(r.id); setOpen(false) }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-13 transition-colors ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-11 text-slate-400">{r.officer} · {r.department}</span>
                </span>
                {active && <span className="h-2 w-2 rounded-full bg-brand-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
