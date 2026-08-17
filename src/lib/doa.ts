// ============================================================================
// Delegation of Authority (§5) — band derivation + final-decision approver path
// ============================================================================
import { DOA_BANDS } from '@/data/policy'
import type { Application, DoABand } from '@/types'

// Base band from ask size (before deviation escalation).
export function baseBand(askInr: number): 'Band-1' | 'Band-2' {
  return askInr < DOA_BANDS.band1CeilingInr ? 'Band-1' : 'Band-2'
}

export function hasOpenDeviation(app: Application): boolean {
  return app.deviations.some((d) => d.status === 'open')
}

// Effective DoA band after escalation (+1 level when ≥1 open deviation):
//   Band-1 + deviation → Central Risk (i.e. Band-2)
//   Band-2 + deviation → Credit Committee (Central Risk decides + Admin countersigns)
export function effectiveBand(app: Application): DoABand {
  const base = baseBand(app.askInr)
  const dev = hasOpenDeviation(app)
  if (!dev) return base
  if (base === 'Band-1') return 'Band-2'
  return 'Committee'
}

export function bandApprover(band: DoABand): string {
  return DOA_BANDS.approvers[band]
}

// The role that records the final decision at S10 for an effective band.
export function decisionRole(band: DoABand): 'Credit-Regional' | 'Risk-Central' {
  // Band-1 → Regional Credit; Band-2 & Committee → Central Risk decides.
  return band === 'Band-1' ? 'Credit-Regional' : 'Risk-Central'
}

// Deviation approval level = base DoA + 1 (used when raising a deviation).
export function deviationApprovalLevel(askInr: number): string {
  const base = baseBand(askInr)
  return base === 'Band-1' ? 'Central Risk' : 'Credit Committee (Central Risk + Admin countersign)'
}
