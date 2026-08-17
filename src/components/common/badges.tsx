// ============================================================================
// Application-specific badges: blocker, tier, DoA band, aging, expiry.
// ============================================================================
import { AlertTriangle, ClipboardList, Clock, Timer, User, Building2, Link2 } from 'lucide-react'
import type { Application } from '@/types'
import { Chip } from './ui'
import { agingRag, daysInStage, sanctionCountdown } from '@/lib/format'
import { effectiveBand } from '@/lib/doa'

export function BlockerBadge({ app }: { app: Application }) {
  const k = app.blocker.kind
  if (k === 'none') return null
  const map = {
    customer: { icon: <User size={11} />, tone: 'amber' as const, label: 'Customer' },
    bank: { icon: <Building2 size={11} />, tone: 'blue' as const, label: 'Bank' },
    third_party: { icon: <Link2 size={11} />, tone: 'purple' as const, label: '3rd-party' },
  }
  const m = map[k]
  return (
    <Chip tone={m.tone} title={app.blocker.detail}>
      {m.icon}
      {m.label}
    </Chip>
  )
}

export function TierChip({ app }: { app: Application }) {
  const tone = app.tier === 'Tier-3' ? 'orange' : app.tier === 'Premier-Overlay-Unsecured' ? 'teal' : 'slate'
  const label = app.tier === 'Premier-Overlay-Unsecured' ? 'Premier-Overlay' : app.tier
  return <Chip tone={tone} title={app.overlayBasis ? `Overlay basis: ${app.overlayBasis}` : undefined}>{label}</Chip>
}

export function DoABandChip({ app }: { app: Application }) {
  const band = effectiveBand(app)
  const tone = band === 'Band-1' ? 'blue' : band === 'Band-2' ? 'indigo' : 'purple'
  return <Chip tone={tone} title="Delegation of Authority band">{band}</Chip>
}

export function AgingDot({ app }: { app: Application }) {
  const days = daysInStage(app.stageEnteredAt)
  const rag = agingRag(days)
  const dot = rag === 'green' ? 'bg-emerald-500' : rag === 'amber' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" title={`${days}d in stage (${rag})`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {days}d
    </span>
  )
}

export function DeviationBadge({ app }: { app: Application }) {
  const n = app.deviations.filter((d) => d.status === 'open').length
  if (n === 0) return null
  return (
    <Chip tone="amber" title={`${n} open deviation(s)`}>
      <AlertTriangle size={11} />
      {n}
    </Chip>
  )
}

export function CovenantBadge({ app }: { app: Application }) {
  const n = app.covenants.filter((c) => c.status === 'open').length
  if (n === 0) return null
  return (
    <Chip tone="slate" title={`${n} open covenant(s)`}>
      <ClipboardList size={11} />
      {n}
    </Chip>
  )
}

export function CheckerBadge({ app }: { app: Application }) {
  if (!app.pendingChecker && app.status !== 'pending_checker') return null
  return (
    <Chip tone="indigo" title="Awaiting checker countersign">
      <Clock size={11} />
      Checker
    </Chip>
  )
}

export function SanctionExpiryChip({ app }: { app: Application }) {
  if (!app.sanctionExpiryDate) return null
  const { days, rag } = sanctionCountdown(app.sanctionExpiryDate)
  if (rag == null || isNaN(days)) return null
  const tone = rag === 'red' ? 'red' : rag === 'amber' ? 'amber' : 'green'
  return (
    <Chip tone={tone} title={`Sanction valid — ${days}d remaining`}>
      <Timer size={11} />
      {days}d
    </Chip>
  )
}
