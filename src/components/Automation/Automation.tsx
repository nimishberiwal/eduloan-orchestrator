// ============================================================================
// Automation (§v2 req 2 + 10) — stage rules, the SLA escalation matrix, the
// triggered-event log and the approval queue for destructive actions.
// ============================================================================
import { useMemo, useState } from 'react'
import { Clock, Play, RotateCcw, ShieldAlert, Workflow } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { nowIso } from '@/lib/clock'
import { fmtDateTime } from '@/lib/format'
import { Btn } from '@/components/common/ui'
import { RulesCatalogue } from './RulesCatalogue'
import { EscalationMatrix } from './EscalationMatrix'
import { TriggeredEvents } from './TriggeredEvents'

type Section = 'rules' | 'escalations' | 'log'

export function Automation() {
  const runSweep = useStore((s) => s.runAutomationSweep)
  const advanceClock = useStore((s) => s.advanceClock)
  const resetClockOffset = useStore((s) => s.resetClockOffset)
  const offset = useStore((s) => s.clockOffsetHours)
  const tick = useStore((s) => s.clockTick) // subscribe so ageing re-derives
  const pending = useStore((s) => s.pendingAutomation)
  const log = useStore((s) => s.automationLog)
  const escalations = useStore((s) => s.escalations)
  const rules = useStore((s) => s.rules)

  const [section, setSection] = useState<Section>('rules')

  const now = useMemo(() => nowIso(), [tick])
  const enabled = rules.filter((r) => r.enabled).length

  const TABS: { id: Section; label: string; count?: number }[] = [
    { id: 'rules', label: 'Stage rules', count: enabled },
    { id: 'escalations', label: 'Escalation matrix', count: escalations.length },
    { id: 'log', label: 'Triggered events', count: log.length },
  ]

  return (
    <div className="thin-scroll h-full overflow-auto p-4">
      {/* Control strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 shadow-card">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Workflow size={16} />
          </span>
          <div className="leading-tight">
            <div className="text-13 font-semibold text-slate-800">Automation engine</div>
            <div className="text-11 text-slate-500">{enabled} of {rules.length} rules enabled</div>
          </div>
        </div>

        <Btn tone="primary" size="sm" onClick={runSweep}>
          <Play size={13} /> Run sweep now
        </Btn>

        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-12 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <ShieldAlert size={13} /> {pending.length} awaiting approval
          </span>
        )}

        {/* Clock control — the frozen prototype clock never ages on its own, so
            time has to be advanced deliberately to watch an SLA trip. */}
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-11 text-slate-500">
            <Clock size={13} />
            {fmtDateTime(now)}
            {offset > 0 && <span className="font-semibold text-brand-600">(+{offset}h)</span>}
          </span>
          <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5">
            <button onClick={() => advanceClock(24)} className="rounded-md px-2 py-1 text-12 font-medium text-slate-600 hover:bg-slate-100">+24h</button>
            <button onClick={() => advanceClock(48)} className="rounded-md px-2 py-1 text-12 font-medium text-slate-600 hover:bg-slate-100">+48h</button>
            {offset > 0 && (
              <button onClick={resetClockOffset} title="Reset clock" className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="mb-3 inline-flex rounded-xl border border-[var(--line)] bg-white p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`rounded-lg px-3 py-1.5 text-13 font-medium transition-colors ${
              section === t.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`ml-1.5 tnum ${section === t.id ? 'text-white/70' : 'text-slate-400'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {section === 'rules' && <RulesCatalogue />}
      {section === 'escalations' && <EscalationMatrix />}
      {section === 'log' && <TriggeredEvents />}
    </div>
  )
}
