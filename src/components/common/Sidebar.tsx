// ============================================================================
// Primary navigation rail — dark navy console rail (second neutral layer).
// ============================================================================
import {
  BarChart3, FileSpreadsheet, KanbanSquare, Landmark, Layers, ListChecks, SquareStack, Workflow,
} from 'lucide-react'
import { useStore } from '@/store/appStore'
import type { TabId } from '@/types'

const NAV: { id: TabId; label: string; icon: typeof KanbanSquare; hint: string }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare, hint: 'Kanban by stage' },
  { id: 'queues', label: 'Queues', icon: ListChecks, hint: 'Department work-lists' },
  { id: 'batches', label: 'Batches', icon: Layers, hint: 'Portfolio by branch, city & value' },
  { id: 'app360', label: 'Application 360', icon: SquareStack, hint: 'Orchestration screen' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: 'Live funnel & TAT' },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet, hint: 'Standard reports & exports' },
  { id: 'automation', label: 'Automation', icon: Workflow, hint: 'Stage rules, SLA & escalations' },
]

export function Sidebar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const apps = useStore((s) => s.applications)
  const openCount = apps.filter((a) => !['REJECTED', 'WITHDRAWN', 'EXPIRED', 'DISBURSED_ACTIVE'].includes(a.stage)).length

  return (
    <aside className="flex w-[212px] flex-shrink-0 flex-col bg-ink-900 text-ink-300 shadow-rail">
      {/* Brand lockup */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-inset ring-1 ring-white/10">
          <Landmark size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-13 font-semibold tracking-tight text-white">Horizon Bank</div>
          <div className="text-11 text-ink-400">EduLoan Orchestrator</div>
        </div>
      </div>

      {/* Product tag */}
      <div className="mx-3 mb-3 rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
        <div className="text-11 font-medium text-ink-300">Abroad PG — USA</div>
        <div className="text-11 text-ink-400">Ticket up to ₹1 Cr</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5">
        <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Workspace</div>
        <ul className="space-y-0.5">
          {NAV.map((n) => {
            const active = tab === n.id
            const Icon = n.icon
            return (
              <li key={n.id}>
                <button
                  onClick={() => setTab(n.id)}
                  title={n.hint}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-13 font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-ink-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-white' : 'text-ink-400 group-hover:text-ink-300'} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.id === 'pipeline' && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tnum ${active ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-ink-400'}`}>
                      {openCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer — demo/prototype marker */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-2.5 py-2 ring-1 ring-amber-400/20">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
          <span className="text-11 leading-tight text-amber-200/80">Prototype · seeded demo data</span>
        </div>
      </div>
    </aside>
  )
}
