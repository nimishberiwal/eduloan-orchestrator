// ============================================================================
// Reason codes, deviation & covenant catalogues (§7) — verbatim text
// ============================================================================
import type { DeviationDef } from '@/types'

export interface CodeDef {
  id: string
  label: string
  target?: string // routing target where the spec names one
}

// ---- Rejection codes (REJ) -------------------------------------------------
export const REJ_CODES: CodeDef[] = [
  { id: 'REJ-01', label: 'Co-applicant income insufficient / FOIR breach unresolvable' },
  { id: 'REJ-02', label: 'Adverse bureau (DPD 90+ / suit-filed / wilful default)' },
  { id: 'REJ-03', label: 'University/program not on lender approved list' },
  { id: 'REJ-04', label: 'Professional program not accredited (AACSB/ABET/ABA/LCME absent)' },
  { id: 'REJ-05', label: 'Collateral shortfall / legal not clear' },
  { id: 'REJ-06', label: 'Fraud / sanctions-PEP confirmed hit' },
  { id: 'REJ-07', label: 'Documents not provided or expired after full nudge cycle' },
  { id: 'REJ-08', label: 'Visa rejected, no appeal succeeded' },
  { id: 'REJ-09', label: 'Undisclosed existing education loan (anti-double-financing)' },
  { id: 'REJ-10', label: 'Customer withdrew' },
]

// ---- Send-back codes (SB) --------------------------------------------------
export const SB_CODES: CodeDef[] = [
  { id: 'SB-01', label: 'Document illegible/incomplete', target: 'S04' },
  { id: 'SB-02', label: 'Extraction mismatch, re-verification', target: 'S05' },
  { id: 'SB-03', label: 'Additional income proof required', target: 'S04' },
  { id: 'SB-04', label: 'Collateral legal query', target: 'S09' },
  { id: 'SB-05', label: 'Eligibility recompute / tier flip', target: 'S07' },
  { id: 'SB-06', label: 'Incorrect routing or assignment' },
]

// ---- Withdrawal codes (WD) — §v2 closure forensics -------------------------
export const WD_CODES: CodeDef[] = [
  { id: 'WD-01', label: 'Customer chose another lender' },
  { id: 'WD-02', label: 'Intake deferred to a later term' },
  { id: 'WD-03', label: 'Self-funded / no longer needs the loan' },
  { id: 'WD-04', label: 'Study plan dropped — visa not pursued' },
  { id: 'WD-05', label: 'Admit revoked or declined by the university' },
]

// ---- Expiry codes (EXP) — §v2 closure forensics ----------------------------
export const EXP_CODES: CodeDef[] = [
  { id: 'EXP-01', label: 'Inactivity 30 days at document stage' },
  { id: 'EXP-02', label: 'Sanction lapsed — validity not revalidated' },
  { id: 'EXP-03', label: 'Documents not provided after full nudge cycle' },
]

// ---- Hold codes (HLD) ------------------------------------------------------
export const HLD_CODES: CodeDef[] = [
  { id: 'HLD-01', label: 'Awaiting revised/unconditional I-20' },
  { id: 'HLD-02', label: 'Awaiting visa outcome' },
  { id: 'HLD-03', label: 'Customer-requested pause' },
  { id: 'HLD-04', label: 'Policy clarification pending' },
]

// ---- Deviation catalogue (DEV) ---------------------------------------------
export const DEV_DEFS: DeviationDef[] = [
  { id: 'DEV-01', title: 'FOIR 55–65% (over band)' },
  { id: 'DEV-02', title: 'University Tier-B/C slot but strong programmatic case' },
  { id: 'DEV-03', title: 'LTV above policy' },
  { id: 'DEV-04', title: 'Margin shortfall vs 10%' },
  { id: 'DEV-05', title: 'Test-optional admission accepted (entrance waiver)' },
  { id: 'DEV-06', title: 'Provisional UG degree accepted with covenant' },
  { id: 'DEV-07', title: 'Income 4-way gap 15–20%' },
  { id: 'DEV-08', title: 'Conditional admit carried to sanction' },
  // §v2 — in-application level deviations (req 3)
  { id: 'DEV-09', title: 'Document waived at application level' },
  { id: 'DEV-10', title: 'Co-applicant added post-capture' },
]

export const CODE_LABEL: Record<string, string> = Object.fromEntries(
  [...REJ_CODES, ...SB_CODES, ...HLD_CODES, ...WD_CODES, ...EXP_CODES].map((c) => [c.id, c.label]),
)

/** Closure codes grouped by the terminal they produce (§v2 req 8). */
export const CLOSURE_CODES = {
  rejected: REJ_CODES,
  withdrawn: WD_CODES,
  expired: EXP_CODES,
} as const
export const DEV_LABEL: Record<string, string> = Object.fromEntries(
  DEV_DEFS.map((d) => [d.id, d.title]),
)
