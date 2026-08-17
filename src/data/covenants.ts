// ============================================================================
// Covenant catalogue (§7) — verbatim; clearBy hard-blocks the named gate
// ============================================================================
import type { CovenantDef } from '@/types'

export const COV_DEFS: CovenantDef[] = [
  { id: 'COV-01', title: 'Unconditional admit before final disbursement', clearBy: 'final disbursement' },
  { id: 'COV-02', title: 'Credential evaluation (WES/ECE) = Equivalent before final disbursement', clearBy: 'final disbursement' },
  { id: 'COV-03', title: 'Form 60 → PAN before first disbursement', clearBy: 'first disbursement' },
  { id: 'COV-04', title: 'Mortgage perfection (C4) before first disbursement', clearBy: 'first disbursement' },
  { id: 'COV-05', title: 'Visa endorsement before Tranche-1', clearBy: 'Tranche-1' },
  { id: 'COV-06', title: 'Final degree certificate before Tranche-2 (provisional accepted at sanction)', clearBy: 'Tranche-2' },
  { id: 'COV-07', title: 'Backlog clearance certificate', clearBy: 'first disbursement' },
]

export const COV_LABEL: Record<string, string> = Object.fromEntries(
  COV_DEFS.map((c) => [c.id, c.title]),
)
export const COV_CLEARBY: Record<string, string> = Object.fromEntries(
  COV_DEFS.map((c) => [c.id, c.clearBy]),
)
