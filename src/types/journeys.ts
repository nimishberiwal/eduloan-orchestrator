// ============================================================================
// Glib.money origination journeys — domain additions (§4).
//
// EVERYTHING here is ADDITIVE. No existing type in `src/types.ts` changes shape,
// so the 14 seed literals (APP-2601…APP-2614) keep compiling untouched.
// ============================================================================
import type { PartyRole } from '@/types'

export type { PartyRole }

// ---- Identity & session ----------------------------------------------------
export type ActorKind = PartyRole | 'rm' | 'back_office' | 'system'

/** Which surface an event originated on. Used for audit attribution (§16.1). */
export type JourneySurface =
  | 'customer' | 'co_applicant' | 'collateral' | 'assisted' | 'handoff'

export interface Session {
  id: string
  partyRole: PartyRole | 'rm'
  mobile: string // +91XXXXXXXXXX
  email: string
  displayName?: string
  /** Applications this session can see. */
  appIds: string[]
  verifiedAt: string // ISO, from lib/clock
  lastSeenAt: string
  /** Assisted sessions only — resolves into data/org.ts. */
  officerId?: string
}

export type OtpStatus = 'pending' | 'verified' | 'expired' | 'locked'

export interface OtpChallenge {
  id: string
  sessionDraft: {
    mobile: string
    email: string
    partyRole: PartyRole | 'rm'
    displayName?: string
    officerId?: string
  }
  channel: 'sms' | 'email' | 'both'
  issuedAt: string
  expiresAt: string // issuedAt + policy.otpValidityMinutes
  attempts: number // max policy.otpMaxAttempts → lock policy.otpLockMinutes
  resendCount: number // max 3 — 30s cooldown then 60s
  status: OtpStatus
  /** The 6 digits the mock "sent". Shown in the dev tray, never in production. */
  code: string
  lockedUntil?: string
  /** Where to land after a successful verify. */
  returnTo?: string
}

// ---- Eligibility / pre-qualification ---------------------------------------
export interface EligibilityInput {
  country: 'US'
  universityName: string
  universityRank?: number // drives the premier overlay
  programme: string
  intake: string // 'Fall 2026'
  courseMonths: number
  coaUsd: number
  ownContributionInr: number
  askInr: number
  coApplicant: {
    incomeType: 'salaried' | 'self_employed'
    monthlyIncomeInr: number
    existingEmiInr: number
    isNri: boolean
  }
  securityOffered: 'none' | 'immovable' | 'fd' | 'lic' | 'mf' | 'gsec'
}

export type OfferTier = 'tier1' | 'tier2' | 'tier3'
export type FoirVerdict = 'pass' | 'deviation' | 'block'

export interface IndicativeOffer {
  id: string
  quotedAt: string
  tier: OfferTier
  maxEligibleInr: number
  askInr: number
  securityRequired: boolean
  premierOverlay?: 'top50' | 'top100' | null
  marginPct: number
  indicativeFoirPct: number
  foirVerdict: FoirVerdict
  moratoriumText: string
  /** Plain language only — never a rule code (§0.6). */
  caveats: string[]
  expiresAt: string // quotedAt + policy.offerValidityDays
}

// ---- The customer's view of work -------------------------------------------
export type TaskKind =
  | 'consent' | 'upload' | 'form' | 'review' | 'invite'
  | 'payment' | 'esign' | 'mandate' | 'acknowledge'

export type TaskOrigin = 'checklist' | 'send_back' | 'validation' | 'milestone'

export interface CustomerTask {
  id: string // stable: `${appId}:${kind}:${key}`
  appId: string
  forParty: PartyRole
  kind: TaskKind
  title: string // "Share your bank statements"
  why: string // one line, plain language
  detail?: string
  docIds?: string[] // the collapsed set this task satisfies
  consentId?: string // ConsentType when kind === 'consent'
  blocking: boolean // gates the current milestone
  origin: TaskOrigin
  raisedAt: string
  dueBy?: string
  estSeconds: number // rendered as "about 2 minutes"
  /** Where this task's detail screen lives, relative to the party's root. */
  route?: string
}

// ---- Capture ---------------------------------------------------------------
export interface CaptureQuality {
  blur: number // 0–1, > policy.blurThreshold → retake
  glare: number // 0–1, > policy.glareThreshold → retake
  edgesDetected: boolean
  resolutionOk: boolean
}

export interface CaptureResult {
  docId: string
  fileName: string
  sizeKb: number
  quality: CaptureQuality
  verdict: 'accept' | 'retake'
  retakeReason?: string // plain language, never a generic error
  classification?: { label: string; confidence: number; ambiguous: boolean }
  extracted?: Record<string, string | number>
}

// ---- Assisted --------------------------------------------------------------
export type LeadSource = 'walk_in' | 'referral' | 'campaign' | 'inbound_call' | 'partner'
export type LeadStatus =
  | 'new' | 'contacted' | 'qualified' | 'application_started'
  | 'dropped' | 'converted'

export interface Lead {
  id: string // LEAD-#####
  capturedBy: string // officerId from data/org.ts
  branchId: string
  capturedAt: string
  studentName: string
  mobile: string
  email: string
  source: LeadSource
  intendedCountry: 'US'
  indicativeAskInr?: number
  status: LeadStatus
  dropReason?: string // from data/reasonCodes.ts
  appId?: string
  nextActionAt?: string
}

/** Acts bound to the customer's identity. An RM may never perform one (§9.1). */
export type HandoffReason =
  | 'aadhaar_ekyc' | 'ckyc_consent' | 'digilocker_consent'
  | 'aa_consent' | 'traces_consent' | 'gstn_consent' | 'bureau_consent'
  | 'esign_agreement' | 'nach_mandate' | 'declaration_signature'
  | 'selfie_liveness' | 'sanction_acceptance'

export type HandoffMode = 'in_branch' | 'remote_link'
export type HandoffStatus = 'issued' | 'opened' | 'completed' | 'expired' | 'cancelled'

export interface Handoff {
  id: string // HO-#####
  appId: string
  forParty: PartyRole
  reason: HandoffReason
  mode: HandoffMode
  channel?: 'sms' | 'email' | 'whatsapp'
  token: string // route param for /handoff/:token
  issuedBy: string // officerId
  issuedAt: string
  expiresAt: string // + policy.handoffValidityHours (in_branch: 30 min)
  status: HandoffStatus
  completedAt?: string
  returnTo: string // RM route to resume at
}

// ---- Invites (§7, §8) ------------------------------------------------------
export type InviteKind = 'co_applicant' | 'collateral_provider'
export type InviteStatus = 'issued' | 'opened' | 'joined' | 'expired' | 'cancelled'

export interface Invite {
  id: string // INV-#####
  kind: InviteKind
  appId: string
  token: string
  name: string
  relationship: string
  mobile: string
  email: string
  issuedAt: string
  expiresAt: string
  status: InviteStatus
  joinedAt?: string
  /** Which party record on the application this invite maps to once joined. */
  partyId?: string
}

/** One row of the dev "Links issued" tray — every link the prototype would have
 *  sent by SMS / email / WhatsApp (§22: no real messaging is built). */
export interface IssuedLink {
  id: string
  kind: 'invite' | 'handoff'
  label: string
  path: string
  channel: 'sms' | 'email' | 'whatsapp' | 'in_branch'
  issuedAt: string
  expiresAt: string
  appId: string
}

// ---- Event contract into the dashboard (§16) -------------------------------
export type JourneyEventType =
  // lifecycle
  | 'APPLICATION_STARTED' | 'ELIGIBILITY_QUOTED' | 'OFFER_ACCEPTED'
  | 'PROFILE_SUBMITTED' | 'ACADEMICS_SUBMITTED' | 'ADMISSION_SUBMITTED'
  | 'APPLICATION_SUBMITTED' | 'WITHDRAWAL_REQUESTED'
  // parties
  | 'COAPPLICANT_INVITED' | 'COAPPLICANT_JOINED'
  | 'COLLATERAL_INVITED' | 'COLLATERAL_JOINED'
  // consent
  | 'CONSENT_REQUESTED' | 'CONSENT_GRANTED' | 'CONSENT_DECLINED' | 'CONSENT_REVOKED'
  // documents
  | 'DOCUMENT_UPLOADED' | 'DOCUMENT_REPLACED' | 'DOCUMENT_CAPTURE_REJECTED'
  | 'EXTRACTION_CONFIRMED' | 'TASK_COMPLETED'
  // post-sanction
  | 'SANCTION_VIEWED' | 'SANCTION_ACCEPTED' | 'SANCTION_DECLINED'
  | 'FEE_PAID' | 'AGREEMENT_SIGNED' | 'MANDATE_REGISTERED' | 'TRANCHE_REQUESTED'
  // assisted
  | 'LEAD_CAPTURED' | 'LEAD_QUALIFIED' | 'LEAD_DROPPED' | 'LEAD_CONVERTED'
  | 'HANDOFF_ISSUED' | 'HANDOFF_OPENED' | 'HANDOFF_COMPLETED' | 'HANDOFF_EXPIRED'
  | 'ASSISTED_DATA_ENTERED'

export interface JourneyActor {
  kind: ActorKind
  partyRole?: PartyRole
  officerId?: string // assisted only
  onBehalfOf?: PartyRole // assisted only
  viaHandoff?: string // handoff id
  sessionId: string
  /** Display name flattened into the audit line (§16.4). */
  name?: string
}

export interface JourneyEvent<T = unknown> {
  id: string
  type: JourneyEventType
  appId: string
  actor: JourneyActor
  at: string // lib/clock
  surface: JourneySurface
  payload: T
  /** Replayed events (double-tap, back-nav, handoff retry) are no-ops (§16.3). */
  idempotencyKey: string // `${type}:${appId}:${stableKey}`
}
