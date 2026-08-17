// ============================================================================
// Policy parameters (§2) — single config file. The committee may tweak these.
// ============================================================================

export const POLICY = {
  product: 'Education Loan — Abroad PG, USA only',
  productNote: 'Masters/PhD/PG-Diploma; borrower = student (no income); credit spine = parent co-applicant',
  maxTicketInr: 1_00_00_000, // ₹1,00,00,000 hard cap

  tierBands: {
    tier1CeilingInr: 4_00_000, // Tier-1 ≤ ₹4L — nil margin, no collateral
    tier2CeilingInr: 7_50_000, // Tier-2 ₹4–7.5L — 5% margin, CGFSEL-eligible, no tangible collateral
    // Tier-3 > ₹7.5L — 5% margin + tangible collateral mandatory
    tier1Note: 'Tier-1 ≤ ₹4L — no margin, no collateral',
    tier2Note: 'Tier-2 ₹4L–7.5L — 5% margin, CGFSEL-eligible, no tangible collateral',
    tier3Note: 'Tier-3 > ₹7.5L — 5% margin + tangible collateral mandatory',
    note: 'IBA model scheme (CGFSEL-aligned); at this product’s ticket sizes everything is Tier-3 unless the Premier-PG overlay applies',
  },

  premierOverlayCeilings: {
    'Global-Rank-Top-50': 75_00_000, // Premier-Global-Top-50 → ₹75L unsecured
    'Global-Rank-Top-100': 50_00_000, // Premier-Global-Top-100 → ₹50L unsecured
    note: 'Overlay basis: QS/THE/ARWU rank or programmatic-top (AACSB/ABET) or lender-curated',
  } as Record<string, number | string>,

  // Abroad margin is lender/country specific across a 5–15% band (BRD-21 §2);
  // 10% is the working figure for this build.
  marginPct: 10,
  marginNote: '5–15% abroad, lender/country specific — 10% applied here',

  foirPolicy: {
    postMoratoriumPassMax: 55, // ≤ 55% pass
    postMoratoriumDeviationMax: 65, // 55–65% = deviation DEV-01; > 65% block
    duringMoratoriumMax: 65, // interest-only ≤ 65%
    note: 'ASSUMPTION — editable',
  },

  ltvPolicy: {
    Immovable: 70, // 70%
    FD: 90, // 90%
    LIC: 85, // LIC surrender value 85%
    MF: 50, // MF 50%
    note: 'ASSUMPTION — editable',
  } as Record<string, number | string>,

  incomeConvergenceGapPct: 15, // ≤ 15% pass (4-way); external ITR match ± 5%
  itrMatchTolerancePct: 5,
  forexBandPct: 2, // ± 2% of RBI reference rate
  coaTolerancePct: 5, // COA ↔ I-20 ± 5%
  netAskGapPct: 2, // net-ask ↔ L1 gap ≤ 2%
  lrsCapUsd: 250_000, // USD 250,000 per FY per resident (student + parent aggregate)

  sanctionValidityDays: 180,
  sanctionAlertAmberDays: 30, // T-30 amber
  sanctionAlertRedDays: 7, // T-7 red

  agingRag: {
    greenMaxDays: 3, // Green < 3 days in stage
    amberMaxDays: 7, // Amber 3–7 · Red > 7
    note: 'Replaces SLA engine (out of scope)',
  },

  holdExpiryDays: 30, // Auto-expiry; nudges at T+7 / T+14 / T+21
  inactivityExpiryDays: 30, // when blocker = Customer at S02–S04

  // §v2 — task-assignment SLA driving the escalation matrix (req 10)
  assignmentSlaHours: 48, // an assignee must action the file within 48h
  assignmentDueSoonHours: 36, // amber warning before breach

  processingFee: {
    pct: 1, // 1% of sanctioned amount
    minInr: 10_000, // min ₹10,000 (display-only)
    note: 'ASSUMPTION',
  },

  // BRD-21 §2 / checklist §13: abroad PG programmes run 1–2 years, so EMI
  // commences 18–30 months from sanction.
  moratorium: 'Course duration + 6–12 months',
  moratoriumNote: 'EMI commences 18–30 months from sanction (1–2 yr PG programmes)',
  fxReference: 84.0, // ₹84.00 / USD fixed for prototype — ASSUMPTION

  // ==========================================================================
  // §v4 — Glib.money origination journeys (BUILD SPEC §4.1).
  // Appended here rather than in a second config file so the committee still
  // has ONE place to tweak every parameter.
  // ==========================================================================
  otpLength: 6,
  otpValidityMinutes: 10,
  otpMaxAttempts: 5,
  /** Cooldown ladder between resends, in seconds — 30 → 60 → 60. */
  otpResendCooldownSec: [30, 60, 60] as readonly number[],
  otpMaxResends: 3,
  otpLockMinutes: 15,

  /** An indicative offer is good for 15 days from the quote. */
  offerValidityDays: 15,
  /** A remote handoff link lives 24h; an in-branch handover only 30 minutes. */
  handoffValidityHours: 24,
  handoffInBranchValidityMinutes: 30,
  /** A co-applicant / collateral invite link lives 7 days. */
  coApplicantInviteDays: 7,
  /** Mirrors inactivityExpiryDays — an abandoned draft ages out the same way. */
  draftExpiryDays: 30,

  uploadMaxMb: 10,
  uploadAcceptedTypes: ['pdf', 'jpg', 'jpeg', 'png', 'heic'] as readonly string[],
  /** Above these the mock capture check demands a retake. */
  blurThreshold: 0.35,
  glareThreshold: 0.3,
  /** Matches data/classification.ts — below this a document goes to HITL. */
  lowConfidenceThreshold: 0.75,
} as const

// ---- DoA bands (§5) --------------------------------------------------------
export const DOA_BANDS = {
  band1CeilingInr: 50_00_000, // Band-1 < ₹50L → Regional Credit
  // Band-2 ₹50L – ₹1Cr → Central Risk
  approvers: {
    'Band-1': 'Regional Credit',
    'Band-2': 'Central Risk',
    Committee: 'Credit Committee (Central Risk decides + Admin countersigns)',
  } as Record<string, string>,
}

export function inrLakh(n: number): number {
  return n / 1_00_000
}
