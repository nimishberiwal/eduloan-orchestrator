// ============================================================================
// The handoff primitive (§9) — the most important piece of the assisted journey.
//
// THE RULE: an RM may enter data, upload documents and progress a file. An RM
// may NOT perform any act bound to the customer's identity. Those acts are
// enumerated as HandoffReason, and attempting one produces a HANDOFF, not a
// form.
//
// This module holds the pure part: which acts are identity-bound, what a
// handoff is for, and whether a token is still good. Minting and status live in
// the session store, and the UI lives in journeys/assisted.
// ============================================================================
import type { ConsentType, PartyRole } from '@/types'
import type { Handoff, HandoffReason } from '@/types/journeys'
import { CONSENT_BY_TYPE } from '@/data/consents'
import { POLICY } from '@/data/policy'
import { nowIso } from '@/lib/clock'

// ---- Which consent maps to which identity-bound act ------------------------

export const CONSENT_HANDOFF: Record<ConsentType, HandoffReason> = {
  uidai_ekyc: 'aadhaar_ekyc',
  ckyc: 'ckyc_consent',
  digilocker: 'digilocker_consent',
  account_aggregator: 'aa_consent',
  itd_traces: 'traces_consent',
  gstn: 'gstn_consent',
  cic_bureau: 'bureau_consent',
}

export const HANDOFF_CONSENT: Partial<Record<HandoffReason, ConsentType>> = Object.fromEntries(
  Object.entries(CONSENT_HANDOFF).map(([c, h]) => [h, c as ConsentType]),
) as Partial<Record<HandoffReason, ConsentType>>

// EVERY HandoffReason is identity-bound — that is what the type IS. A consent
// is an assertion by a specific person, and there is no such thing as granting
// one on someone else's behalf. This is why the assisted journey needs a
// handoff primitive rather than a "fill on behalf" checkbox (§9.1).

/** Who must perform this act. */
export function partyFor(reason: HandoffReason): PartyRole {
  switch (reason) {
    case 'aa_consent':
    case 'traces_consent':
    case 'gstn_consent':
    case 'bureau_consent':
      return 'co_applicant'
    default:
      return 'applicant'
  }
}

/** Why this one needs the customer, in the words an officer would use to their
 *  face. The row already carries the act's NAME, so this is only the reason —
 *  repeating the name here made every row say the same thing three times. */
export function handoffPrompt(reason: HandoffReason, customerName: string): string {
  const first = customerName.split(' ')[0]
  const map: Record<HandoffReason, string> = {
    aadhaar_ekyc: `This needs ${first} to be present.`,
    ckyc_consent: `Only ${first} can authorise the registry to release their record.`,
    digilocker_consent: `DigiLocker signs in as ${first}.`,
    aa_consent: `The approval goes to ${first}'s own mobile.`,
    traces_consent: `Only ${first} can authorise the tax portal.`,
    gstn_consent: `Only the registered proprietor can authorise GSTN.`,
    bureau_consent: `Only ${first} can authorise a bureau enquiry.`,
    esign_agreement: `An e-signature is legally ${first}'s.`,
    nach_mandate: `The account holder authorises the mandate.`,
    declaration_signature: `A declaration is signed by the person making it.`,
    selfie_liveness: `${first} has to be in front of the camera.`,
    sanction_acceptance: `Only ${first} can accept the offer.`,
  }
  return map[reason]
}

// ---- Token lifetime --------------------------------------------------------

export function handoffExpiryFor(mode: Handoff['mode'], issuedAt: string): string {
  const base = new Date(issuedAt).getTime()
  const ms =
    mode === 'in_branch'
      ? POLICY.handoffInBranchValidityMinutes * 60_000
      : POLICY.handoffValidityHours * 3_600_000
  return new Date(base + ms).toISOString()
}

export type HandoffVerdict =
  | { ok: true; handoff: Handoff }
  | { ok: false; why: 'not_found' | 'expired' | 'completed' | 'cancelled'; message: string }

/** §9.4 — verify the token, check expiry, and dead-end CLEANLY when it fails.
 *  Never alarming: a stale link is an ordinary thing, not an incident. */
export function verifyHandoff(h: Handoff | undefined, now: string = nowIso()): HandoffVerdict {
  if (!h) {
    return {
      ok: false,
      why: 'not_found',
      message: 'This link isn’t one we recognise. It may have been mistyped, or replaced by a newer one.',
    }
  }
  if (h.status === 'completed') {
    return {
      ok: false,
      why: 'completed',
      message: 'This one is already done. There’s nothing left to do here.',
    }
  }
  if (h.status === 'cancelled') {
    return {
      ok: false,
      why: 'cancelled',
      message: 'This link was cancelled. Your officer can send a fresh one.',
    }
  }
  if (new Date(now) >= new Date(h.expiresAt)) {
    return {
      ok: false,
      why: 'expired',
      message:
        h.mode === 'in_branch'
          ? `In-branch links last ${POLICY.handoffInBranchValidityMinutes} minutes. Ask your officer to start it again.`
          : `Links last ${POLICY.handoffValidityHours} hours. Ask your officer for a new one — it takes a moment.`,
    }
  }
  return { ok: true, handoff: h }
}

/** Which consent (if any) a handoff completes, so the landing can render the
 *  exact same ConsentFlow the customer would have seen in their own session. */
export function consentForHandoff(reason: HandoffReason): ConsentType | undefined {
  return HANDOFF_CONSENT[reason]
}

export function handoffConsentLabel(reason: HandoffReason): string | undefined {
  const c = consentForHandoff(reason)
  return c ? CONSENT_BY_TYPE[c].label : undefined
}
