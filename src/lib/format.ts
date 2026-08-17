// ============================================================================
// Formatting + derived-clock helpers (§15, §2)
// ============================================================================
import { POLICY } from '@/data/policy'
import { BASE_NOW_ISO, nowIso } from '@/lib/clock'

// INR: ₹45.0L (lakh < 1Cr), ₹1.00Cr (crore ≥ 1Cr)
export function inr(amount: number): string {
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`
  }
  return `₹${(amount / 1_00_000).toFixed(1)}L`
}

// Full grouped INR e.g. ₹75,00,000
export function inrFull(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN')
}

export function usd(amount: number): string {
  return '$' + amount.toLocaleString('en-US')
}

// DD-MMM-YYYY
export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

// Whole days between two ISO dates (a - b), floored, never negative for aging.
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.floor((a - b) / 86_400_000)
}

// The prototype "now" is owned by lib/clock.ts (frozen base + operator offset).
// NOW_ISO stays exported as the un-offset base for seed construction and audit
// stamps written at build time; anything that AGES must call nowIso() instead.
export const NOW_ISO = BASE_NOW_ISO

export function daysInStage(stageEnteredAt: string): number {
  return Math.max(0, daysBetween(nowIso(), stageEnteredAt))
}

export type Rag = 'green' | 'amber' | 'red'
export function agingRag(days: number): Rag {
  if (days < POLICY.agingRag.greenMaxDays) return 'green'
  if (days <= POLICY.agingRag.amberMaxDays) return 'amber'
  return 'red'
}

// Sanction expiry countdown — days remaining, and its RAG.
export function sanctionCountdown(expiryIso?: string): { days: number; rag: Rag | null } {
  if (!expiryIso) return { days: NaN, rag: null }
  const days = daysBetween(expiryIso, nowIso())
  let rag: Rag = 'green'
  if (days <= POLICY.sanctionAlertRedDays) rag = 'red'
  else if (days <= POLICY.sanctionAlertAmberDays) rag = 'amber'
  return { days, rag }
}

export function holdCountdown(holdSetIso?: string): number {
  if (!holdSetIso) return NaN
  const elapsed = daysBetween(nowIso(), holdSetIso)
  return POLICY.holdExpiryDays - elapsed
}

export const RAG_DOT: Record<Rag, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}
export const RAG_TEXT: Record<Rag, string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
}
