// ============================================================================
// Journey state machine stages (§4) + forward-gate table
// ============================================================================
import type { Department, StageId, TerminalId } from '@/types'

export interface StageDef {
  id: StageId
  name: string
  ownerDept: Department | 'per DoA'
  notes: string
}

export const STAGES: StageDef[] = [
  { id: 'S01', name: 'Registration', ownerDept: 'Sales', notes: 'Record created post mobile/email OTP; APP ID minted' },
  { id: 'S02', name: 'Application capture', ownerDept: 'Sales', notes: 'Personal, course, university, admit status, ask, intake, co-applicant added' },
  { id: 'S03', name: 'KYC', ownerDept: 'Ops', notes: 'Parallel per party: applicant lane + co-applicant lane (PAN, Aadhaar eKYC, CKYC, OTP, passport for applicant)' },
  { id: 'S04', name: 'Document collection', ownerDept: 'Ops', notes: 'Dynamic checklist (§8); blocker usually customer' },
  { id: 'S05', name: 'Document verification', ownerDept: 'Ops', notes: 'Per-doc QC + extraction placeholders; intra-doc validations' },
  { id: 'S06', name: 'Bureau & financial analysis', ownerDept: 'Credit', notes: 'CIBIL both parties, AA banking, 4-way income convergence, FOIR compute' },
  { id: 'S07', name: 'Underwriting', ownerDept: 'Credit', notes: 'Eligibility, tier slotting, overlay check, deviations raised' },
  { id: 'S08', name: 'Risk & fraud review', ownerDept: 'Risk', notes: 'PEP/sanctions, fraud screen; Compliance clears manual hits' },
  { id: 'S09', name: 'Collateral processing', ownerDept: 'Ops', notes: 'Conditional (Tier-3 only); legal ∥ technical valuation run in parallel; runs alongside S07–S08' },
  { id: 'S10', name: 'Credit decision', ownerDept: 'per DoA', notes: 'APPROVE / APPROVE-WITH-CONDITIONS / DECLINE / REFER; maker-checker' },
  { id: 'S11', name: 'Sanction & acceptance', ownerDept: 'Credit', notes: 'Sanction letter, validity clock starts, processing fee, customer acceptance' },
  { id: 'S12', name: 'Documentation', ownerDept: 'Ops', notes: 'Loan agreement e-sign, e-stamp, NACH mandate (penny-drop)' },
  { id: 'S13', name: 'Disbursement', ownerDept: 'Ops', notes: 'Repeating tranche sub-journey (§13.4); per-tranche gates' },
]

export const TERMINALS: Record<TerminalId, string> = {
  DISBURSED_ACTIVE: 'Disbursed — active (≥1 tranche out, schedule live)',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired (inactivity or lapsed sanction)',
}

export const STAGE_NAME: Record<string, string> = {
  ...Object.fromEntries(STAGES.map((s) => [s.id, s.name])),
  ...TERMINALS,
}

export function nextStage(id: StageId): StageId | null {
  const order: StageId[] = STAGES.map((s) => s.id)
  const idx = order.indexOf(id)
  if (idx < 0 || idx === order.length - 1) return null
  return order[idx + 1]
}

// ---- Forward-gate table (§4) -----------------------------------------------
// A stage cannot be exited forward unless its gate items resolve.
export interface GateSpec {
  exit: StageId
  description: string
  // validation ids that must be pass/waived to exit this stage
  requiredValidations: string[]
  // non-overridable compliance gates (S03/S08) — no override control any role
  nonOverridable: boolean
}

export const FORWARD_GATES: GateSpec[] = [
  {
    exit: 'S03',
    description: 'Both parties: INT-01..04 pass, EXT-01..04 + EXT-17 pass',
    requiredValidations: [
      'VAL-INT-01', 'VAL-INT-02', 'VAL-INT-03', 'VAL-INT-04',
      'VAL-EXT-01', 'VAL-EXT-02', 'VAL-EXT-03', 'VAL-EXT-04', 'VAL-EXT-17',
    ],
    nonOverridable: true,
  },
  {
    exit: 'S04',
    description: 'All buckets with required_by_stage = sanction at least uploaded',
    requiredValidations: [], // bucket-driven, evaluated in gating.ts
    nonOverridable: false,
  },
  {
    exit: 'S05',
    description: 'All sanction-gate docs verified or waived; INT-05..08, INT-10, CRS-01..03 resolved',
    requiredValidations: [
      'VAL-INT-05', 'VAL-INT-06', 'VAL-INT-07', 'VAL-INT-08', 'VAL-INT-10',
      'VAL-CRS-01', 'VAL-CRS-02', 'VAL-CRS-03',
    ],
    nonOverridable: false,
  },
  {
    exit: 'S06',
    description: 'P6 bureau pulled; EXT-10..12 pass; CRS-17, CRS-25, CRS-26, INT-12/13 resolved; FOIR computed',
    requiredValidations: [
      'VAL-EXT-10', 'VAL-EXT-11', 'VAL-EXT-12',
      'VAL-CRS-17', 'VAL-CRS-25', 'VAL-CRS-26',
      'VAL-INT-12', 'VAL-INT-13',
    ],
    nonOverridable: false,
  },
  {
    exit: 'S07',
    description: 'CRS-04..09, CRS-12..15, CRS-18, CRS-19, INT-09, INT-11, EXT-07..09, EXT-16 resolved or converted to Deviations/Covenants',
    requiredValidations: [
      'VAL-CRS-04', 'VAL-CRS-05', 'VAL-CRS-06', 'VAL-CRS-07', 'VAL-CRS-08', 'VAL-CRS-09',
      'VAL-CRS-12', 'VAL-CRS-13', 'VAL-CRS-14', 'VAL-CRS-15', 'VAL-CRS-18', 'VAL-CRS-19',
      'VAL-INT-09', 'VAL-INT-11', 'VAL-EXT-07', 'VAL-EXT-08', 'VAL-EXT-09', 'VAL-EXT-16',
    ],
    nonOverridable: false,
  },
  {
    exit: 'S08',
    description: 'EXT-14 clear or cleared-by-Compliance',
    requiredValidations: ['VAL-EXT-14'],
    nonOverridable: true,
  },
  {
    exit: 'S09',
    description: 'C1–C3 verified; INT-14, CRS-20, EXT-15 pass (C4 perfection may remain as COV-04)',
    requiredValidations: ['VAL-INT-14', 'VAL-CRS-20', 'VAL-EXT-15'],
    nonOverridable: false,
  },
  {
    exit: 'S10',
    description: 'Decision recorded + checker countersigned; DoA band satisfied (§5)',
    requiredValidations: [],
    nonOverridable: false,
  },
  {
    exit: 'S11',
    description: 'Customer acceptance + processing fee flagged paid; covenants registered; sanction clock started',
    requiredValidations: [],
    nonOverridable: false,
  },
  {
    exit: 'S12',
    description: 'E-sign + e-stamp done; EXT-13 penny-drop pass',
    requiredValidations: ['VAL-EXT-13'],
    nonOverridable: false,
  },
]

export function gateForExit(id: StageId): GateSpec | undefined {
  return FORWARD_GATES.find((g) => g.exit === id)
}
