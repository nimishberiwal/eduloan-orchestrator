// ============================================================================
// HITL (human-in-the-loop) review queue (§v3).
//
// From the BRD-21 pipeline `hitl` node and BRD §4 failure-routing logic. These
// are the cases automation deliberately refuses to decide: an accreditation
// claim it cannot bind, an overlay call on the edge of policy, a sponsor
// relationship that needs a human read.
//
// Distinct from a Deviation (a known policy exception, already catalogued) and
// from a Hold (the file is parked awaiting an external event). A HITL case is
// "a person must look at this before the file moves".
// ============================================================================
import type { HitlTrigger } from '@/types'

export interface HitlDef {
  trigger: HitlTrigger
  title: string
  /** What the reviewer is being asked to decide. */
  question: string
  /** Which department owns the review. */
  owner: 'Credit' | 'Risk' | 'Ops' | 'Compliance'
  severity: 'info' | 'warn' | 'critical'
  /** BRD provenance for traceability. */
  brdRef: string
}

export const HITL_DEFS: HitlDef[] = [
  {
    trigger: 'programmatic_accreditation_unlisted',
    title: 'Programmatic accreditation claimed but not listed',
    question:
      'The programme claims AACSB / ABET / ABA / LCME accreditation but is not on the accreditor’s published list. Confirm with the accreditor, or route to decline — a non-accredited professional programme (business / law / medical) is a REJ-04.',
    owner: 'Credit',
    severity: 'critical',
    brdRef: 'BRD-21 §4 · V-CRS-08',
  },
  {
    trigger: 'premier_overlay_borderline',
    title: 'Premier-PG overlay borderline',
    question:
      'The institution is on the Premier overlay list but the specific programme is not (or the ask sits at the ceiling). Decide whether the unsecured construct holds, or recompute as Tier-3 with collateral.',
    owner: 'Credit',
    severity: 'warn',
    brdRef: 'BRD-21 §4 · V-CRS-09',
  },
  {
    trigger: 'credential_eval_pending',
    title: 'Credential evaluation pending or borderline',
    question:
      'WES / ECE / IQAS evaluation is outstanding or returned "Equivalent-with-conditions". Decide between a covenant for completion before final disbursement, or treating it as a hard block.',
    owner: 'Credit',
    severity: 'warn',
    brdRef: 'BRD-21 §4 · V-CRS-12',
  },
  {
    trigger: 'sponsored_mba_verification',
    title: 'Sponsored MBA — sponsor verification',
    question:
      'Employer-sponsored programme. Verify the sponsor on MCA21, confirm the letter is on company letterhead, and assess relationship-employer risk. Ensure the sponsorship is deducted from the ask and not double-counted with company-paid components.',
    owner: 'Credit',
    severity: 'warn',
    brdRef: 'BRD-21 §4 · V-CRS-15 · V-EXT-23',
  },
  {
    trigger: 'test_optional_no_entrance',
    title: 'Test-optional admission with no entrance score',
    question:
      'The university admitted under a test-optional policy and no GRE / GMAT / LSAT score exists. Confirm the university’s test-optional policy and decide whether lender policy permits the waiver (DEV-05).',
    owner: 'Credit',
    severity: 'info',
    brdRef: 'BRD-21 §4 · V-CRS-05',
  },
  {
    trigger: 'existing_ug_el_exposure',
    title: 'Existing UG education loan — aggregate exposure',
    question:
      'The borrower already holds an education loan. Run the aggregate UG-EL + PG-EL exposure analysis and decide between a top-up and a fresh sanction.',
    owner: 'Risk',
    severity: 'warn',
    brdRef: 'BRD-21 §4 · V-CRS-25 · V-EXT-21',
  },
  {
    trigger: 'conditional_admit',
    title: 'Conditional admit — clauses to review',
    question:
      'Admission is conditional (UG final result / language top-up / fee-by-date / financial evidence). Capture the clauses at L1 and attach COV-01 for unconditional admission before final disbursement.',
    owner: 'Ops',
    severity: 'info',
    brdRef: 'BRD-21 §4 · V-CRS-11',
  },
]

export const HITL_BY_TRIGGER: Record<HitlTrigger, HitlDef> = Object.fromEntries(
  HITL_DEFS.map((d) => [d.trigger, d]),
) as Record<HitlTrigger, HitlDef>

export const HITL_STATUS_TONE: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'purple'> = {
  open: 'amber',
  in_review: 'blue',
  cleared: 'green',
  escalated: 'purple',
  declined: 'red',
}
