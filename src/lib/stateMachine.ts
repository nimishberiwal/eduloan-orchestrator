// ============================================================================
// State machine: roles, transition matrix (§5), verb permissions.
// ============================================================================
import type { Application, Department, Role, RoleId, Stage } from '@/types'

export const ROLES: Role[] = [
  { id: 'Sales', label: 'Sales', officer: 'P. Shah', department: 'Sales' },
  { id: 'Ops', label: 'Ops', officer: 'R. Iyer', department: 'Ops' },
  { id: 'Credit-Regional', label: 'Credit — Regional', officer: 'S. Kulkarni', department: 'Credit' },
  { id: 'Risk-Central', label: 'Risk — Central', officer: 'A. Menon', department: 'Risk' },
  { id: 'Compliance', label: 'Compliance', officer: 'N. Verma', department: 'Compliance' },
  { id: 'Admin', label: 'Admin', officer: 'Admin', department: 'Admin' },
]

export const ROLE_BY_ID: Record<RoleId, Role> = Object.fromEntries(
  ROLES.map((r) => [r.id, r]),
) as Record<RoleId, Role>

export function officerOf(role: RoleId): string {
  return ROLE_BY_ID[role].officer
}
export function deptOf(role: RoleId): Department {
  return ROLE_BY_ID[role].department
}

// ---- Verb catalogue --------------------------------------------------------
export type Verb =
  | 'create'
  | 'edit_capture'
  | 'request_docs'
  | 'nudge'
  | 'verify_doc'
  | 'complete_kyc'
  | 'move_forward'
  | 'send_back'
  | 'reassign'
  | 'hold'
  | 'release_hold'
  | 'raise_deviation'
  | 'approve_deviation'
  | 'stage_approve'
  | 'stage_reject'
  | 'final_decision'
  | 'clear_pep'
  | 'waive_validation'
  | 'bulk_reset'
  | 'clear_covenant'
  | 'retry_integration'
  | 'release_tranche'
  | 'countersign'
  | 'revalidate'

// Transition matrix (§5): which roles may attempt each verb (coarse gate).
// Finer conditions (stage ranges, band, dept) are enforced in the store.
const MATRIX: Record<Verb, RoleId[]> = {
  create: ['Sales', 'Admin'],
  edit_capture: ['Sales', 'Ops', 'Admin'],
  request_docs: ['Sales', 'Ops', 'Credit-Regional', 'Risk-Central', 'Admin'],
  nudge: ['Sales', 'Ops', 'Admin'],
  verify_doc: ['Ops', 'Credit-Regional'], // Credit only income/collateral
  complete_kyc: ['Ops'], // Compliance = oversight (no action button)
  move_forward: ['Ops', 'Credit-Regional', 'Risk-Central', 'Admin'],
  send_back: ['Ops', 'Credit-Regional', 'Risk-Central', 'Compliance', 'Admin'],
  reassign: ['Sales', 'Ops', 'Credit-Regional', 'Risk-Central', 'Admin'],
  hold: ['Ops', 'Credit-Regional', 'Risk-Central', 'Compliance', 'Admin'],
  release_hold: ['Ops', 'Credit-Regional', 'Risk-Central', 'Compliance', 'Admin'],
  raise_deviation: ['Ops', 'Credit-Regional', 'Risk-Central'],
  approve_deviation: ['Credit-Regional', 'Risk-Central', 'Admin'], // Band-1 Credit only; Admin countersign
  stage_approve: ['Ops', 'Credit-Regional', 'Risk-Central'],
  stage_reject: ['Ops', 'Credit-Regional', 'Risk-Central'],
  final_decision: ['Credit-Regional', 'Risk-Central', 'Admin'],
  clear_pep: ['Compliance'],
  waive_validation: ['Credit-Regional', 'Risk-Central'], // WARN only
  bulk_reset: ['Admin'],
  clear_covenant: ['Ops', 'Credit-Regional'],
  retry_integration: ['Ops', 'Credit-Regional', 'Risk-Central', 'Compliance', 'Admin'],
  release_tranche: ['Ops', 'Credit-Regional'], // Ops maker, Credit checker
  countersign: ['Credit-Regional', 'Risk-Central', 'Admin'],
  revalidate: ['Credit-Regional', 'Admin'],
}

export function roleCan(role: RoleId, verb: Verb): boolean {
  return MATRIX[verb]?.includes(role) ?? false
}

// Stage ranges for send-back per role (§5)
export function sendBackRange(role: RoleId): Stage[] {
  switch (role) {
    case 'Ops':
      return ['S04']
    case 'Credit-Regional':
      return ['S04', 'S05', 'S06', 'S07']
    case 'Risk-Central':
      return ['S05', 'S06', 'S07', 'S08']
    case 'Compliance':
      return ['S03'] // any → S03
    case 'Admin':
      return ['S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12']
    default:
      return []
  }
}

// Who may move a given app forward, considering the stage-band ownership (§5).
// Ops: S03→S06 ; Credit: S06→S08, S10→S12 ; Risk: S08→S10 ; Admin: any.
export function canMoveForward(role: RoleId, stage: Stage): boolean {
  if (role === 'Admin') return true
  const s = stage
  if (role === 'Ops') return ['S03', 'S04', 'S05'].includes(s)
  if (role === 'Credit-Regional') return ['S06', 'S07', 'S10', 'S11'].includes(s)
  if (role === 'Risk-Central') return ['S08', 'S09'].includes(s)
  return false
}

// Department that owns the queue for a stage's default routing.
export function defaultDeptForStage(stage: Stage): Department {
  const map: Record<string, Department> = {
    S01: 'Sales', S02: 'Sales', S03: 'Ops', S04: 'Ops', S05: 'Ops',
    S06: 'Credit', S07: 'Credit', S08: 'Risk', S09: 'Ops', S10: 'Credit',
    S11: 'Credit', S12: 'Ops', S13: 'Ops',
  }
  return map[stage] ?? 'Ops'
}

export function isTerminal(stage: Stage): boolean {
  return ['DISBURSED_ACTIVE', 'REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(stage)
}

// Maker-checker: checker must be same-or-higher authority in owning dept and
// must NOT equal the maker (by officer name).
const AUTHORITY_RANK: Record<RoleId, number> = {
  Sales: 1,
  Ops: 2,
  Compliance: 3,
  'Credit-Regional': 3,
  'Risk-Central': 4,
  Admin: 5,
}
export function canCountersign(checkerRole: RoleId, makerOfficer: string, makerRole: RoleId): boolean {
  if (officerOf(checkerRole) === makerOfficer) return false // must not equal maker
  return AUTHORITY_RANK[checkerRole] >= AUTHORITY_RANK[makerRole]
}

// Simple round-robin assignment on forward-move within a department.
const RR_STATE: Record<Department, number> = {
  Sales: 0, Ops: 0, Credit: 0, Risk: 0, Compliance: 0, Admin: 0,
}
const DEPT_OFFICERS: Record<Department, string[]> = {
  Sales: ['P. Shah'],
  Ops: ['R. Iyer'],
  Credit: ['S. Kulkarni'],
  Risk: ['A. Menon'],
  Compliance: ['N. Verma'],
  Admin: ['Admin'],
}
/** Clear the module-global rotation so `Reset demo data` is truly idempotent. */
export function resetRoundRobin(): void {
  for (const k of Object.keys(RR_STATE) as Department[]) RR_STATE[k] = 0
}

export function roundRobinOfficer(dept: Department): string {
  const officers = DEPT_OFFICERS[dept]
  const idx = RR_STATE[dept] % officers.length
  RR_STATE[dept] = (RR_STATE[dept] + 1) % officers.length
  return officers[idx]
}

// Whether a role's action bar should be able to override a gate for this stage.
// S03 KYC and S08 AML gates are non-overridable by ANY role.
export function gateOverridable(stage: Stage): boolean {
  return stage !== 'S03' && stage !== 'S08'
}

export function summaryNextAction(app: Application): string {
  switch (app.stage) {
    case 'S01': return 'Complete registration'
    case 'S02': return 'Capture application'
    case 'S03': return 'Complete KYC (both lanes)'
    case 'S04': return 'Collect pending documents'
    case 'S05': return 'Verify documents'
    case 'S06': return 'Pull bureau / analyse income'
    case 'S07': return 'Underwrite / slot tier'
    case 'S08': return 'Run risk & fraud screen'
    case 'S09': return 'Process collateral'
    case 'S10': return app.pendingChecker ? 'Countersign decision' : 'Record credit decision'
    case 'S11': return 'Issue sanction / customer acceptance'
    case 'S12': return 'Execute documentation'
    case 'S13': return 'Release tranche'
    default: return '—'
  }
}
