// ============================================================================
// Stage rule catalogue + escalation matrix (§v2 req 2, 10).
//
// Rules are declarative: WHEN a set of conditions holds, THEN run actions.
// Non-destructive actions auto-apply; destructive ones queue for approval.
// ============================================================================
import type { Department, EscalationRung, StageRule } from '@/types'
import { POLICY } from '@/data/policy'

// ---- Escalation matrix -----------------------------------------------------
export const ESCALATION_MATRIX: EscalationRung[] = [
  { level: 1, afterHours: 48, toTitle: 'Team Lead' },
  { level: 2, afterHours: 96, toTitle: 'Head' },
  { level: 3, afterHours: 168, toTitle: 'Business Head' },
]

/** Risk and Compliance run tighter clocks than the rest of the bank. */
export const ESCALATION_BY_DEPT: Partial<Record<Department, EscalationRung[]>> = {
  Risk: [
    { level: 1, afterHours: 24, toTitle: 'Head' },
    { level: 2, afterHours: 72, toTitle: 'Business Head' },
  ],
  Compliance: [
    { level: 1, afterHours: 24, toTitle: 'Head' },
    { level: 2, afterHours: 72, toTitle: 'Business Head' },
  ],
}

export function matrixFor(dept: Department): EscalationRung[] {
  return ESCALATION_BY_DEPT[dept] ?? ESCALATION_MATRIX
}

// ---- Rule catalogue --------------------------------------------------------
export const RULE_CATALOGUE: StageRule[] = [
  // --- the two rules named verbatim in the feedback ---
  {
    id: 'R-S01-01',
    stage: 'S01',
    name: 'Registration stalled beyond 5 days',
    description: 'A registered file that has not been picked up within 5 days is reassigned to the Sales team lead.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 5 }],
    then: [
      { kind: 'reassign', destructive: false, label: 'Reassign to Sales Team Lead', toDepartment: 'Sales', toTitle: 'Team Lead' },
    ],
    enabled: true,
  },
  {
    id: 'R-S02-01',
    stage: 'S02',
    name: 'Capture abandoned beyond 18 days',
    description: 'Application capture untouched for 18 days: send a final reminder, then close the file.',
    severity: 'critical',
    when: [{ field: 'daysInStage', op: 'gt', value: 18 }],
    then: [
      { kind: 'comm', destructive: false, label: 'Send final reminder', channel: 'WhatsApp', templateId: 'inactivity_warning' },
      { kind: 'close', destructive: true, label: 'Close as inactive', closureCode: 'EXP-01' },
    ],
    enabled: true,
  },

  // --- KYC / documents ---
  {
    id: 'R-S03-01',
    stage: 'S03',
    name: 'KYC stalled on the customer',
    description: 'KYC pending on the customer for over 4 days — nudge them.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 4 }, { field: 'blockerKind', op: 'eq', value: 'customer' }],
    then: [{ kind: 'nudge', destructive: false, label: 'Nudge for KYC completion', channel: 'SMS', templateId: 'nudge' }],
    enabled: true,
  },
  {
    id: 'R-S04-01',
    stage: 'S04',
    name: 'Document collection nudge cycle',
    description: 'Documents outstanding for more than 5 days — send the document reminder.',
    severity: 'info',
    when: [{ field: 'daysInStage', op: 'gt', value: 5 }, { field: 'docsRequested', op: 'gt', value: 0 }],
    then: [{ kind: 'comm', destructive: false, label: 'Send document reminder', channel: 'WhatsApp', templateId: 'doc_request' }],
    enabled: true,
  },
  {
    id: 'R-S04-02',
    stage: 'S04',
    name: 'Inactivity auto-expiry',
    description: `No customer activity for ${POLICY.inactivityExpiryDays} days at document collection — expire after the full nudge cycle.`,
    severity: 'critical',
    when: [{ field: 'daysSinceCustomerActivity', op: 'gte', value: POLICY.inactivityExpiryDays }],
    then: [{ kind: 'close', destructive: true, label: 'Expire for inactivity', closureCode: 'EXP-01' }],
    enabled: true,
  },
  {
    id: 'R-S05-01',
    stage: 'S05',
    name: 'Verification bottleneck',
    description: 'Documents sitting in verification for over 6 days with the bank as blocker — escalate.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 6 }, { field: 'blockerKind', op: 'eq', value: 'bank' }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate to Ops Team Lead', escalateLevels: 1 }],
    enabled: true,
  },

  // --- credit / risk ---
  {
    id: 'R-S06-01',
    stage: 'S06',
    name: 'External check failing',
    description: 'A bureau or Account Aggregator call has failed — flag for manual intervention.',
    severity: 'warn',
    when: [{ field: 'failedIntegrations', op: 'gt', value: 0 }],
    then: [{ kind: 'flag', destructive: false, label: 'Flag as bank-blocked', blockerKind: 'bank' }],
    enabled: true,
  },
  {
    id: 'R-S07-01',
    stage: 'S07',
    name: 'Underwriting held with open deviations',
    description: 'Open deviations sitting in underwriting for over 5 days need a decision-maker.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 5 }, { field: 'openDeviations', op: 'gt', value: 0 }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate to Credit Head', escalateLevels: 1 }],
    enabled: true,
  },
  {
    id: 'R-S08-01',
    stage: 'S08',
    name: 'AML review ageing',
    description: 'A risk/AML review open beyond 3 days is escalated to Compliance leadership.',
    severity: 'critical',
    when: [{ field: 'daysInStage', op: 'gt', value: 3 }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate AML review', escalateLevels: 1 }],
    enabled: true,
  },
  {
    id: 'R-S09-01',
    stage: 'S09',
    name: 'Third-party valuation chase',
    description: 'Collateral valuation awaited from a panel vendor for over 7 days.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 7 }, { field: 'blockerKind', op: 'eq', value: 'third_party' }],
    then: [{ kind: 'flag', destructive: false, label: 'Flag for vendor follow-up', blockerKind: 'third_party' }],
    enabled: true,
  },
  {
    id: 'R-S10-01',
    stage: 'S10',
    name: 'Decision awaiting countersign',
    description: 'A maker decision waiting on a checker for more than 2 days.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 2 }, { field: 'status', op: 'eq', value: 'pending_checker' }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate to checker’s manager', escalateLevels: 1 }],
    enabled: true,
  },

  // --- sanction / disbursal ---
  {
    id: 'R-S11-01',
    stage: 'S11',
    name: 'Sanction expiring',
    description: 'Sanction validity inside 30 days without customer acceptance — send the expiry warning.',
    severity: 'critical',
    when: [{ field: 'sanctionDaysLeft', op: 'lte', value: 30 }],
    then: [{ kind: 'comm', destructive: false, label: 'Send sanction-expiry warning', channel: 'Email', templateId: 'sanction_expiry' }],
    enabled: true,
  },
  {
    id: 'R-S12-01',
    stage: 'S12',
    name: 'Documentation stalled',
    description: 'E-sign / NACH outstanding for more than 5 days — call the customer.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 5 }],
    then: [{ kind: 'comm', destructive: false, label: 'Send e-sign reminder', channel: 'SMS', templateId: 'acceptance_reminder' }],
    enabled: true,
  },
  {
    id: 'R-S13-01',
    stage: 'S13',
    name: 'Tranche gated too long',
    description: 'A disbursement gated on the customer for over 7 days.',
    severity: 'warn',
    when: [{ field: 'daysInStage', op: 'gt', value: 7 }, { field: 'blockerKind', op: 'eq', value: 'customer' }],
    then: [{ kind: 'nudge', destructive: false, label: 'Nudge for disbursement pre-requisites', channel: 'WhatsApp', templateId: 'nudge' }],
    enabled: true,
  },

  // --- cross-stage ---
  {
    id: 'R-ANY-01',
    stage: 'ANY',
    name: `Hold beyond ${POLICY.holdExpiryDays} days`,
    description: `A file on hold longer than the ${POLICY.holdExpiryDays}-day policy window must be revisited.`,
    severity: 'warn',
    when: [{ field: 'status', op: 'eq', value: 'on_hold' }, { field: 'daysInStage', op: 'gt', value: POLICY.holdExpiryDays }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate expired hold', escalateLevels: 1 }],
    enabled: true,
  },
  {
    id: 'R-ANY-02',
    stage: 'ANY',
    name: 'High-value file ageing',
    description: 'Any file above ₹75L sitting in one stage for more than 10 days.',
    severity: 'critical',
    when: [{ field: 'askInr', op: 'gt', value: 75_00_000 }, { field: 'daysInStage', op: 'gt', value: 10 }],
    then: [{ kind: 'escalate', destructive: false, label: 'Escalate high-value ageing', escalateLevels: 1 }],
    enabled: true,
  },
  {
    id: 'R-ANY-03',
    stage: 'ANY',
    name: 'Customer silent for 14 days',
    description: 'No customer activity for a fortnight while the file waits on them.',
    severity: 'warn',
    when: [
      { field: 'daysSinceCustomerActivity', op: 'gte', value: 14 },
      { field: 'blockerKind', op: 'eq', value: 'customer' },
    ],
    then: [{ kind: 'comm', destructive: false, label: 'Send inactivity warning', channel: 'WhatsApp', templateId: 'inactivity_warning' }],
    enabled: true,
  },
]

export const RULE_BY_ID: Record<string, StageRule> = Object.fromEntries(
  RULE_CATALOGUE.map((r) => [r.id, r]),
)
