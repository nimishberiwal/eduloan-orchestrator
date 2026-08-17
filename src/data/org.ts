// ============================================================================
// Org model (§v2) — branch network + officer reporting hierarchy.
//
// CRITICAL: the six v1 officer names (P. Shah, R. Iyer, S. Kulkarni, A. Menon,
// N. Verma, Admin) appear here VERBATIM as their department's primary officer,
// so OFFICER_BY_NAME resolves for the 14 hand-written acceptance applications
// whose Owner carries only a name.
// ============================================================================
import type { Branch, Department, OfficerRef, Region, RoleId } from '@/types'

export const REGIONS: Region[] = ['West', 'North', 'South', 'East']

export const BRANCHES: Branch[] = [
  { id: 'BR-MUM-AND', name: 'Mumbai — Andheri', city: 'Mumbai', region: 'West' },
  { id: 'BR-MUM-BKC', name: 'Mumbai — BKC', city: 'Mumbai', region: 'West' },
  { id: 'BR-PUN-KLN', name: 'Pune — Kalyani Nagar', city: 'Pune', region: 'West' },
  { id: 'BR-DEL-CP', name: 'Delhi — Connaught Place', city: 'New Delhi', region: 'North' },
  { id: 'BR-GUR-CYB', name: 'Gurugram — Cyber City', city: 'Gurugram', region: 'North' },
  { id: 'BR-BLR-IND', name: 'Bengaluru — Indiranagar', city: 'Bengaluru', region: 'South' },
  { id: 'BR-HYD-GAC', name: 'Hyderabad — Gachibowli', city: 'Hyderabad', region: 'South' },
  { id: 'BR-CHE-NUN', name: 'Chennai — Nungambakkam', city: 'Chennai', region: 'East' },
]

export const BRANCH_BY_ID: Record<string, Branch> = Object.fromEntries(
  BRANCHES.map((b) => [b.id, b]),
)

export const CITIES: string[] = Array.from(new Set(BRANCHES.map((b) => b.city)))

/** Branch used for the 14 legacy applications (they predate the branch model). */
export const DEFAULT_BRANCH_ID = 'BR-MUM-BKC'

// ---- Officers --------------------------------------------------------------
// Three levels per department: Officer → Team Lead → Department Head, all
// ultimately rolling up to Admin.

const HEAD_ADMIN = 'OFF-ADM-01'

function mk(
  id: string,
  name: string,
  title: string,
  department: Department,
  role: RoleId,
  branchId: string,
  managerId: string | null,
): OfficerRef {
  return { id, name, title, department, role, branchId, managerId }
}

export const OFFICERS: OfficerRef[] = [
  // --- Admin (apex) ---
  mk(HEAD_ADMIN, 'Admin', 'Business Head', 'Admin', 'Admin', 'BR-MUM-BKC', null),

  // --- Sales ---
  mk('OFF-SAL-HEAD', 'V. Raghavan', 'Head — Sales', 'Sales', 'Sales', 'BR-MUM-BKC', HEAD_ADMIN),
  mk('OFF-SAL-TL-W', 'M. Fernandes', 'Sales Team Lead — West', 'Sales', 'Sales', 'BR-MUM-AND', 'OFF-SAL-HEAD'),
  mk('OFF-SAL-TL-N', 'H. Grewal', 'Sales Team Lead — North', 'Sales', 'Sales', 'BR-DEL-CP', 'OFF-SAL-HEAD'),
  mk('OFF-SAL-TL-S', 'K. Subramanian', 'Sales Team Lead — South', 'Sales', 'Sales', 'BR-BLR-IND', 'OFF-SAL-HEAD'),
  mk('OFF-SAL-01', 'P. Shah', 'Sales Officer', 'Sales', 'Sales', 'BR-MUM-BKC', 'OFF-SAL-TL-W'), // legacy
  mk('OFF-SAL-02', 'T. Bhatia', 'Sales Officer', 'Sales', 'Sales', 'BR-MUM-AND', 'OFF-SAL-TL-W'),
  mk('OFF-SAL-03', 'R. Chawla', 'Sales Officer', 'Sales', 'Sales', 'BR-DEL-CP', 'OFF-SAL-TL-N'),
  mk('OFF-SAL-04', 'S. Pillai', 'Sales Officer', 'Sales', 'Sales', 'BR-BLR-IND', 'OFF-SAL-TL-S'),
  mk('OFF-SAL-05', 'A. Deshpande', 'Sales Officer', 'Sales', 'Sales', 'BR-PUN-KLN', 'OFF-SAL-TL-W'),

  // --- Ops ---
  mk('OFF-OPS-HEAD', 'L. Nambiar', 'Head — Operations', 'Ops', 'Ops', 'BR-MUM-BKC', HEAD_ADMIN),
  mk('OFF-OPS-TL-1', 'G. Kulkarni', 'Ops Team Lead', 'Ops', 'Ops', 'BR-MUM-BKC', 'OFF-OPS-HEAD'),
  mk('OFF-OPS-TL-2', 'D. Sengupta', 'Ops Team Lead', 'Ops', 'Ops', 'BR-HYD-GAC', 'OFF-OPS-HEAD'),
  mk('OFF-OPS-01', 'R. Iyer', 'Ops Officer', 'Ops', 'Ops', 'BR-MUM-BKC', 'OFF-OPS-TL-1'), // legacy
  mk('OFF-OPS-02', 'N. Rane', 'Ops Officer', 'Ops', 'Ops', 'BR-MUM-AND', 'OFF-OPS-TL-1'),
  mk('OFF-OPS-03', 'J. Thomas', 'Ops Officer', 'Ops', 'Ops', 'BR-CHE-NUN', 'OFF-OPS-TL-2'),
  mk('OFF-OPS-04', 'B. Saxena', 'Ops Officer', 'Ops', 'Ops', 'BR-GUR-CYB', 'OFF-OPS-TL-2'),
  mk('OFF-OPS-05', 'F. Qureshi', 'Ops Officer', 'Ops', 'Ops', 'BR-HYD-GAC', 'OFF-OPS-TL-2'),

  // --- Credit ---
  mk('OFF-CRD-HEAD', 'P. Venkatesh', 'Head — Credit', 'Credit', 'Credit-Regional', 'BR-MUM-BKC', HEAD_ADMIN),
  mk('OFF-CRD-TL-1', 'S. Bose', 'Credit Team Lead', 'Credit', 'Credit-Regional', 'BR-MUM-BKC', 'OFF-CRD-HEAD'),
  mk('OFF-CRD-TL-2', 'I. Kapadia', 'Credit Team Lead', 'Credit', 'Credit-Regional', 'BR-BLR-IND', 'OFF-CRD-HEAD'),
  mk('OFF-CRD-01', 'S. Kulkarni', 'Credit Manager — Regional', 'Credit', 'Credit-Regional', 'BR-MUM-BKC', 'OFF-CRD-TL-1'), // legacy
  mk('OFF-CRD-02', 'A. Krishnan', 'Credit Analyst', 'Credit', 'Credit-Regional', 'BR-BLR-IND', 'OFF-CRD-TL-2'),
  mk('OFF-CRD-03', 'M. Dutta', 'Credit Analyst', 'Credit', 'Credit-Regional', 'BR-DEL-CP', 'OFF-CRD-TL-1'),
  mk('OFF-CRD-04', 'Y. Shetty', 'Credit Analyst', 'Credit', 'Credit-Regional', 'BR-PUN-KLN', 'OFF-CRD-TL-2'),

  // --- Risk ---
  mk('OFF-RSK-HEAD', 'C. Balakrishnan', 'Head — Risk', 'Risk', 'Risk-Central', 'BR-MUM-BKC', HEAD_ADMIN),
  mk('OFF-RSK-01', 'A. Menon', 'Risk Manager — Central', 'Risk', 'Risk-Central', 'BR-MUM-BKC', 'OFF-RSK-HEAD'), // legacy
  mk('OFF-RSK-02', 'U. Joshi', 'Risk Analyst', 'Risk', 'Risk-Central', 'BR-MUM-BKC', 'OFF-RSK-HEAD'),

  // --- Compliance ---
  mk('OFF-CMP-HEAD', 'E. Dsouza', 'Head — Compliance', 'Compliance', 'Compliance', 'BR-MUM-BKC', HEAD_ADMIN),
  mk('OFF-CMP-01', 'N. Verma', 'Compliance Officer', 'Compliance', 'Compliance', 'BR-MUM-BKC', 'OFF-CMP-HEAD'), // legacy
  mk('OFF-CMP-02', 'Z. Ahmed', 'Compliance Officer', 'Compliance', 'Compliance', 'BR-DEL-CP', 'OFF-CMP-HEAD'),
]

export const OFFICER_BY_ID: Record<string, OfficerRef> = Object.fromEntries(
  OFFICERS.map((o) => [o.id, o]),
)
export const OFFICER_BY_NAME: Record<string, OfficerRef> = Object.fromEntries(
  OFFICERS.map((o) => [o.name, o]),
)

/** The primary (v1 legacy) officer for a department — the one moveForward assigns. */
export const PRIMARY_OFFICER: Record<Department, OfficerRef> = {
  Sales: OFFICER_BY_NAME['P. Shah'],
  Ops: OFFICER_BY_NAME['R. Iyer'],
  Credit: OFFICER_BY_NAME['S. Kulkarni'],
  Risk: OFFICER_BY_NAME['A. Menon'],
  Compliance: OFFICER_BY_NAME['N. Verma'],
  Admin: OFFICER_BY_NAME['Admin'],
}

export function officersOf(dept: Department): OfficerRef[] {
  return OFFICERS.filter((o) => o.department === dept)
}

/** Resolve an Owner to an officer — by id when present, else by name. */
export function resolveOfficer(owner: { officer: string; officerId?: string }): OfficerRef | null {
  if (owner.officerId && OFFICER_BY_ID[owner.officerId]) return OFFICER_BY_ID[owner.officerId]
  return OFFICER_BY_NAME[owner.officer] ?? null
}

export function managerOf(officerId: string): OfficerRef | null {
  const o = OFFICER_BY_ID[officerId]
  if (!o || !o.managerId) return null
  return OFFICER_BY_ID[o.managerId] ?? null
}

/** Full upward chain from an officer to the apex, nearest manager first. */
export function escalationChain(officerId: string): OfficerRef[] {
  const chain: OfficerRef[] = []
  let cur = OFFICER_BY_ID[officerId]
  const guard = new Set<string>()
  while (cur?.managerId && !guard.has(cur.managerId)) {
    guard.add(cur.managerId)
    const mgr = OFFICER_BY_ID[cur.managerId]
    if (!mgr) break
    chain.push(mgr)
    cur = mgr
  }
  return chain
}

export function branchOf(app: { branchId: string }): Branch | null {
  return BRANCH_BY_ID[app.branchId] ?? null
}

export function branchLabel(branchId: string): string {
  return BRANCH_BY_ID[branchId]?.name ?? branchId
}
