// ============================================================================
// Stage rule catalogue — what fires, when, and what it does (§v2 req 2).
// ============================================================================
import { useMemo } from 'react'
import { AlertTriangle, Ban, Info } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { matchRules } from '@/lib/rules'
import { nowIso } from '@/lib/clock'
import { STAGE_NAME } from '@/data/stages'
import { Chip } from '@/components/common/ui'
import type { StageRule } from '@/types'

const SEVERITY = {
  info: { tone: 'blue' as const, icon: Info },
  warn: { tone: 'amber' as const, icon: AlertTriangle },
  critical: { tone: 'red' as const, icon: Ban },
}

const OP_LABEL: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=',
}
const FIELD_LABEL: Record<string, string> = {
  daysInStage: 'days in stage',
  hoursSinceAssigned: 'hours since assigned',
  daysSinceCustomerActivity: 'days since customer activity',
  askInr: 'loan amount',
  blockerKind: 'blocker',
  status: 'status',
  openDeviations: 'open deviations',
  docsRequested: 'documents requested',
  sanctionDaysLeft: 'sanction days left',
  nudgeCount: 'nudges sent',
  failedIntegrations: 'failed integrations',
}

export function RulesCatalogue() {
  const rules = useStore((s) => s.rules)
  const apps = useStore((s) => s.applications)
  const toggleRule = useStore((s) => s.toggleRule)
  const tick = useStore((s) => s.clockTick)

  // How many applications each rule matches *right now*.
  const matchCounts = useMemo(() => {
    const now = nowIso()
    const counts: Record<string, number> = {}
    for (const app of apps) {
      for (const r of matchRules(app, rules, now)) {
        counts[r.id] = (counts[r.id] ?? 0) + 1
      }
    }
    return counts
  }, [apps, rules, tick])

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {rules.map((r) => (
        <RuleCard key={r.id} rule={r} matches={matchCounts[r.id] ?? 0} onToggle={() => toggleRule(r.id)} />
      ))}
    </div>
  )
}

function RuleCard({ rule, matches, onToggle }: { rule: StageRule; matches: number; onToggle: () => void }) {
  const sev = SEVERITY[rule.severity]
  const Icon = sev.icon
  return (
    <div className={`rounded-xl border bg-white p-3.5 shadow-card transition-opacity ${rule.enabled ? 'border-[var(--line)]' : 'border-slate-200 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-11 font-semibold text-slate-500">{rule.id}</span>
            <Chip tone={sev.tone}><Icon size={10} /> {rule.severity}</Chip>
            <Chip tone="slate">
              {rule.stage === 'ANY' ? 'Any stage' : `${rule.stage} · ${STAGE_NAME[rule.stage] ?? ''}`}
            </Chip>
          </div>
          <h4 className="mt-1 text-13 font-semibold text-slate-800">{rule.name}</h4>
          <p className="mt-0.5 text-11 leading-snug text-slate-500">{rule.description}</p>
        </div>

        <label className="flex flex-shrink-0 cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={rule.enabled} onChange={onToggle} className="accent-brand-600" />
          <span className="text-11 text-slate-500">{rule.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {/* WHEN */}
      <div className="mt-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">When</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {rule.when.map((c, i) => (
            <span key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              {FIELD_LABEL[c.field] ?? c.field} {OP_LABEL[c.op] ?? c.op} {String(c.value)}
            </span>
          ))}
        </div>
      </div>

      {/* THEN */}
      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Then</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {rule.then.map((a, i) => (
            <Chip key={i} tone={a.destructive ? 'red' : 'green'}>
              {a.label}{a.destructive ? ' · needs approval' : ''}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-2.5 border-t border-slate-100 pt-2 text-11">
        {matches > 0 ? (
          <span className="font-medium text-brand-600">{matches} application{matches === 1 ? '' : 's'} match right now</span>
        ) : (
          <span className="text-slate-400">No current matches</span>
        )}
      </div>
    </div>
  )
}
