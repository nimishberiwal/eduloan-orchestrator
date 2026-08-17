// ============================================================================
// Indicative eligibility (§6).
//
// Pure function, no store. EVERY number comes from data/policy.ts — nothing is
// hardcoded here, so the committee can tune the bands in one file and both
// surfaces move together.
//
// The offer is INDICATIVE and says so on screen, once, in body copy. And it
// never terminates a customer at pre-qualification on estimated inputs: a FOIR
// that would block still produces an offer the customer can proceed from, with
// an honest caveat.
// ============================================================================
import type { EligibilityInput, FoirVerdict, IndicativeOffer, OfferTier } from '@/types/journeys'
import { POLICY } from '@/data/policy'
import { nowIso } from '@/lib/clock'

let _offerSeq = 0
export function resetOfferSeq(): void {
  _offerSeq = 0
}

/** Tier from the ask, per POLICY.tierBands (§6 step 2). */
export function tierFor(askInr: number): OfferTier {
  if (askInr <= POLICY.tierBands.tier1CeilingInr) return 'tier1'
  if (askInr <= POLICY.tierBands.tier2CeilingInr) return 'tier2'
  return 'tier3'
}

export const TIER_LABEL: Record<OfferTier, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
}

/** Margin the customer must fund themselves, per tier (§6 step 5). */
export function marginPctFor(tier: OfferTier): number {
  // Tier-1 is nil-margin per the IBA model scheme; above that the product's
  // working figure applies (5–15% abroad, lender/country specific).
  return tier === 'tier1' ? 0 : POLICY.marginPct
}

/** Premier overlay from the institution's global rank (§6 step 3). The overlay
 *  RAISES the unsecured ceiling; it never raises the ticket above the cap. */
export function overlayFor(rank?: number): {
  overlay: 'top50' | 'top100' | null
  ceilingInr: number | null
} {
  if (rank === undefined || rank <= 0) return { overlay: null, ceilingInr: null }
  if (rank <= 50) {
    return {
      overlay: 'top50',
      ceilingInr: Number(POLICY.premierOverlayCeilings['Global-Rank-Top-50']),
    }
  }
  if (rank <= 100) {
    return {
      overlay: 'top100',
      ceilingInr: Number(POLICY.premierOverlayCeilings['Global-Rank-Top-100']),
    }
  }
  return { overlay: null, ceilingInr: null }
}

/** FOIR verdict from POLICY.foirPolicy (§6 step 6). */
export function foirVerdictFor(foirPct: number): FoirVerdict {
  if (foirPct <= POLICY.foirPolicy.postMoratoriumPassMax) return 'pass'
  if (foirPct <= POLICY.foirPolicy.postMoratoriumDeviationMax) return 'deviation'
  return 'block'
}

/** Interest accruing during the moratorium, as a monthly figure. Indicative
 *  only — the real EMI is set at sanction. */
function moratoriumMonthlyInterest(principalInr: number): number {
  // Reads POLICY, so the indicative maths and the sanction pack quote the SAME
  // rate. It was a bare 10.5 here, under a comment saying the sanction letter
  // carried the real band — and when the letter came to be written (Phase D)
  // there was no band for it to carry.
  return (principalInr * (POLICY.sanctionRoi.annualPct / 100)) / 12
}

export function quote(input: EligibilityInput, now: string = nowIso()): IndicativeOffer {
  // 1. Requested amount, capped at the product ceiling.
  const askInr = Math.min(Math.max(0, input.askInr), POLICY.maxTicketInr)

  // 2. Tier from the ask.
  const tier = tierFor(askInr)

  // 3. Premier overlay from the institution's rank.
  const { overlay, ceilingInr: overlayCeiling } = overlayFor(input.universityRank)

  // The unsecured ceiling: the overlay's, or the Tier-2 band if none applies.
  const unsecuredCeiling = overlayCeiling ?? POLICY.tierBands.tier2CeilingInr

  // 4. Security required = Tier-3 AND the ask exceeds the unsecured ceiling.
  const securityRequired = tier === 'tier3' && askInr > unsecuredCeiling

  // 5. Margin and net eligible.
  const marginPct = marginPctFor(tier)
  const coaInr = input.coaUsd * POLICY.fxReference
  const fundableNeed = Math.max(0, coaInr - Math.max(0, input.ownContributionInr))
  const ceiling = securityRequired
    ? POLICY.maxTicketInr // secured: the product cap is the binding limit
    : Math.min(unsecuredCeiling, POLICY.maxTicketInr)
  const maxEligibleInr = Math.max(
    0,
    Math.round(Math.min(ceiling, fundableNeed) * (1 - marginPct / 100)),
  )

  // 6. Indicative FOIR: existing obligations plus moratorium-period interest,
  //    against the co-applicant's monthly income.
  const income = Math.max(1, input.coApplicant.monthlyIncomeInr)
  const servicing = moratoriumMonthlyInterest(Math.min(askInr, maxEligibleInr || askInr))
  const indicativeFoirPct = Math.round(
    ((Math.max(0, input.coApplicant.existingEmiInr) + servicing) / income) * 100,
  )
  const foirVerdict = foirVerdictFor(indicativeFoirPct)

  // 7. Caveats — plain language only, never a rule code, never "blocked".
  const caveats: string[] = []

  if (askInr < input.askInr) {
    caveats.push(
      `The most this product lends is ${inr(POLICY.maxTicketInr)}, so we've shown you that figure rather than the ${inr(input.askInr)} you entered.`,
    )
  }
  if (securityRequired) {
    caveats.push(
      `Above ${inr(unsecuredCeiling)} the bank asks for property or a financial security behind the loan. Someone in your family can provide it — it doesn't have to be you.`,
    )
  } else if (overlay) {
    caveats.push(
      `${input.universityName} is in the global top ${overlay === 'top50' ? '50' : '100'}, so you can borrow up to ${inr(unsecuredCeiling)} without putting up security.`,
    )
  }
  if (marginPct > 0) {
    caveats.push(
      `You'll be expected to fund about ${marginPct}% of the cost yourself. That's already taken off the figure above.`,
    )
  }
  if (maxEligibleInr < askInr) {
    caveats.push(
      `You asked for ${inr(askInr)} and the numbers you've given support ${inr(maxEligibleInr)}. You can still apply for the full amount and the bank will look at it properly.`,
    )
  }
  if (foirVerdict === 'deviation') {
    caveats.push(
      'Your co-applicant’s existing commitments are on the high side for this amount. It can still be approved, but a senior credit officer will look at it.',
    )
  }
  if (foirVerdict === 'block') {
    // §6 step 7 — never terminate at pre-qual on estimated inputs.
    caveats.push(
      'Based on what you’ve told us, we’d need either a higher-income co-applicant or a smaller amount. You can still apply and we’ll review it properly.',
    )
  }
  if (input.coApplicant.isNri) {
    caveats.push(
      'Because your co-applicant lives abroad, we’ll ask for a few extra documents about their overseas income.',
    )
  }

  _offerSeq += 1
  return {
    id: `OFR-${String(_offerSeq).padStart(4, '0')}`,
    quotedAt: now,
    tier,
    maxEligibleInr,
    askInr,
    securityRequired,
    premierOverlay: overlay,
    marginPct,
    indicativeFoirPct,
    foirVerdict,
    moratoriumText: `${POLICY.moratorium}. ${POLICY.moratoriumNote}.`,
    caveats,
    expiresAt: new Date(
      new Date(now).getTime() + POLICY.offerValidityDays * 86_400_000,
    ).toISOString(),
  }
}

function inr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

// ---- A tiny university reference, so the demo can show the overlay --------
// The lender's real approved-university list is an internal policy table
// (data/sources.ts → InternalPolicy). This is only enough for the pre-qual
// screen to look up a rank the customer would not know offhand.

export interface UniversityRef {
  name: string
  short: string
  rank?: number
  stem: boolean
}

export const US_UNIVERSITIES: UniversityRef[] = [
  { name: 'Massachusetts Institute of Technology', short: 'MIT', rank: 1, stem: true },
  { name: 'Stanford University', short: 'Stanford', rank: 6, stem: true },
  { name: 'Harvard University', short: 'Harvard', rank: 4, stem: false },
  { name: 'Carnegie Mellon University', short: 'CMU', rank: 52, stem: true },
  { name: 'Columbia University', short: 'Columbia', rank: 23, stem: true },
  { name: 'University of California, Berkeley', short: 'UC Berkeley', rank: 12, stem: true },
  { name: 'Purdue University', short: 'Purdue', rank: 89, stem: true },
  { name: 'Northeastern University', short: 'Northeastern', rank: 431, stem: true },
  { name: 'Arizona State University', short: 'ASU', rank: 179, stem: true },
  { name: 'University of Texas at Dallas', short: 'UT Dallas', rank: 561, stem: true },
  { name: 'New York University', short: 'NYU', rank: 38, stem: false },
  { name: 'University of Southern California', short: 'USC', rank: 125, stem: true },
  { name: 'Stevens Institute of Technology', short: 'Stevens', rank: 671, stem: true },
  { name: 'Clark University', short: 'Clark', rank: 941, stem: false },

  // ---- FT Global MBA Ranking 2026 additions ------------------------------
  // The 31 US universities in that ranking not already listed above. Each has
  // a researched dossier in data/universityIntel.ts.
  //
  // WHY `rank` IS OMITTED ON ALL 31 — READ BEFORE FILLING IT IN.
  // `rank` is not display-only: overlayFor() turns it into the Premier overlay,
  // which RAISES the unsecured lending ceiling (<=50 → top50, <=100 → top100).
  // A wrong number here hands a borrower a larger unsecured facility.
  //
  // The 14 ranks above could not be tied to any single published edition —
  // QS 2025 puts Columbia at 34 and NYU at 43, not the 23 and 38 recorded
  // above — so they read as prototype values rather than a real ranking table.
  // Rather than guess an edition, mix two, or invent numbers that would move
  // credit outcomes, `rank` is left undefined here. Undefined is the SAFE
  // default: overlayFor() returns no overlay, so these universities get no
  // unsecured uplift until someone sets the ranks deliberately.
  //
  // To populate: pick the one ranking table the credit policy actually uses and
  // apply it to all 45 rows at once, so overlays stay comparable across them.
  //
  // ALREADY CONSIDERED AND REJECTED (2026-08-17): using the FT Global MBA
  // Ranking 2026 positions as the rank. Do not re-open this without new
  // information — the arithmetic was run and it fails on three counts.
  //   1. Six of the 45 are not in that ranking at all. Stanford withdrew from
  //      participation and Columbia missed the alumni-survey threshold, so
  //      both drop top50 -> NO overlay, and Purdue drops top100 -> none. A
  //      Stanford applicant would lose their unsecured uplift because a
  //      business school declined to return a questionnaire.
  //   2. `rank` is programme-agnostic — it sets the ceiling for MS, MPH and
  //      LLM files too — whereas the FT table ranks only the MBA. A Stanford
  //      MS Computer Science file would be marked down for the MBA
  //      programme's non-participation.
  //   3. US positions in that table span 1..89, so 23 schools land in the
  //      top50 band and 16 in top100: universities carrying any unsecured
  //      uplift would go from 8 to 39. That is a wholesale loosening of
  //      unsecured exposure, not a data fix.
  // The FT position is already carried per university as a `ranking` finding
  // in data/universityIntel.ts, which is where a newspaper's MBA ranking
  // belongs — informing a credit view, not setting a ceiling.
  //
  // `stem` drives only the post-study work duration shown on the file, not any
  // credit outcome. It is set true where the university runs a substantial
  // engineering or computing school, false otherwise.
  { name: 'University of Pennsylvania', short: 'Penn', stem: true },
  { name: 'Northwestern University', short: 'Northwestern', stem: true },
  { name: 'Cornell University', short: 'Cornell', stem: true },
  { name: 'Duke University', short: 'Duke', stem: true },
  { name: 'Yale University', short: 'Yale', stem: true },
  { name: 'University of Virginia', short: 'UVA', stem: true },
  { name: 'University of Chicago', short: 'Chicago', stem: true },
  { name: 'Dartmouth College', short: 'Dartmouth', stem: true },
  { name: 'University of California, Los Angeles', short: 'UCLA', stem: true },
  { name: 'University of Michigan', short: 'Michigan', stem: true },
  { name: 'Washington University in St. Louis', short: 'WashU', stem: true },
  { name: 'Rice University', short: 'Rice', stem: true },
  { name: 'University of North Carolina at Chapel Hill', short: 'UNC', stem: false },
  { name: 'University of Texas at Austin', short: 'UT Austin', stem: true },
  { name: 'Georgia Institute of Technology', short: 'Georgia Tech', stem: true },
  { name: 'University of Washington', short: 'UW', stem: true },
  { name: 'Georgetown University', short: 'Georgetown', stem: false },
  { name: 'Vanderbilt University', short: 'Vanderbilt', stem: true },
  { name: 'Emory University', short: 'Emory', stem: false },
  { name: 'University of Georgia', short: 'UGA', stem: true },
  { name: 'University of Notre Dame', short: 'Notre Dame', stem: true },
  { name: 'University of Rochester', short: 'Rochester', stem: true },
  { name: 'Boston University', short: 'BU', stem: true },
  { name: 'Michigan State University', short: 'Michigan State', stem: true },
  { name: 'University of Pittsburgh', short: 'Pittsburgh', stem: true },
  { name: 'Fordham University', short: 'Fordham', stem: false },
  { name: 'Brigham Young University', short: 'BYU', stem: true },
  { name: 'University of Miami', short: 'Miami', stem: true },
  { name: 'College of William & Mary', short: 'William & Mary', stem: false },
  { name: 'University of Wisconsin–Madison', short: 'Wisconsin', stem: true },
  { name: 'Hult International Business School', short: 'Hult', stem: false },
]

export function findUniversity(name: string): UniversityRef | undefined {
  const n = name.trim().toLowerCase()
  return US_UNIVERSITIES.find(
    (u) => u.name.toLowerCase() === n || u.short.toLowerCase() === n,
  )
}
