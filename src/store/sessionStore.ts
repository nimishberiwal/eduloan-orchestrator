// ============================================================================
// Session store (§4, §7, §8, §9) — identity for the Glib.money journeys.
//
// Deliberately separate from appStore: an application is one thing, and the
// four authenticated parties looking at it are another. A co-applicant has
// their OWN session, not a form section inside the student's application —
// that is the whole reason the four consents they grant can be theirs.
//
// This store never mutates an Application. Journey surfaces emit
// JourneyEvents, which reduce through appStore's existing verbs (§16.3).
// ============================================================================
import { create } from 'zustand'
import type {
  Handoff,
  HandoffMode,
  HandoffReason,
  IndicativeOffer,
  Invite,
  InviteKind,
  IssuedLink,
  Lead,
  LeadSource,
  OtpChallenge,
  Session,
} from '@/types/journeys'
import type { PartyRole } from '@/types'
import { POLICY } from '@/data/policy'
import { addHoursIso, hoursSince, nowIso } from '@/lib/clock'
import { registerJourneyReset } from '@/journeys/resetRegistry'

// ---- Module-global counters (§18: resetDemo MUST clear these) --------------
let _sessionSeq = 0
let _otpSeq = 0
let _inviteSeq = 0
let _handoffSeq = 0
let _leadSeq = 0
let _linkSeq = 0

function resetSeqs(): void {
  _sessionSeq = 0
  _otpSeq = 0
  _inviteSeq = 0
  _handoffSeq = 0
  _leadSeq = 0
  _linkSeq = 0
}

// ---- Deterministic mock helpers -------------------------------------------

/** Deterministic 6-digit OTP derived from the destination + issue count.
 *  A demo must repeat exactly, so nothing here is random. */
function mockOtp(seed: string, n: number): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h = Math.abs(h ^ Math.imul(n + 1, 2654435761))
  return String(h % 10 ** POLICY.otpLength).padStart(POLICY.otpLength, '0')
}

/** Opaque-looking but deterministic token for invite / handoff links. */
function mkToken(prefix: string, n: number, salt: string): string {
  let h = 5381
  for (let i = 0; i < salt.length; i++) h = (h * 33) ^ salt.charCodeAt(i)
  return `${prefix}${String(n).padStart(3, '0')}${(Math.abs(h) % 46656).toString(36).padStart(3, '0')}`
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function minutesSince(iso: string, now = nowIso()): number {
  return (new Date(now).getTime() - new Date(iso).getTime()) / 60_000
}

// ---- State -----------------------------------------------------------------

export type PersonaKey = 'student' | 'parent' | 'collateral' | 'rm' | 'console'

/** The pre-qualification answers behind an indicative offer (§6).
 *
 *  These live HERE, not on the Application, for two reasons: they are estimates
 *  the customer typed before anything was evidenced, and the Application is the
 *  bank's record. Routing them through react-router state instead was the
 *  original approach and it was wrong — each navigation replaces history state,
 *  so CJ-07 silently recomputed the offer from defaults. */
export interface PreQual {
  coaUsd: number
  ownContributionInr: number
  monthlyIncomeInr: number
  existingEmiInr: number
  incomeType: 'salaried' | 'self_employed'
  isNri: boolean
  courseMonths: number
}

interface SessionState {
  sessions: Session[]
  otp: OtpChallenge[]
  invites: Invite[]
  handoffs: Handoff[]
  leads: Lead[]
  /** The dev "Links issued" tray — no real SMS / email / WhatsApp is built. */
  issuedLinks: IssuedLink[]
  /** Active session per party kind. The persona switch flips between these
   *  WITHOUT re-authenticating — it is the demo's spine (§2.2). */
  activeSessionId: Partial<Record<PartyRole | 'rm', string>>
  /** Which persona the demo is currently wearing. */
  persona: PersonaKey
  /** True once the operator has dismissed the dev tray this session. */
  trayOpen: boolean
  /** Pre-qualification answers per application (§6). */
  prequal: Record<string, PreQual>
  /** The last indicative offer quoted per application (§4). */
  offers: Record<string, IndicativeOffer>
}

interface SessionActions {
  // --- auth ---
  issueOtp: (i: {
    mobile: string
    email: string
    partyRole: PartyRole | 'rm'
    displayName?: string
    officerId?: string
    channel?: OtpChallenge['channel']
    returnTo?: string
  }) => OtpChallenge
  resendOtp: (challengeId: string) => { ok: boolean; message: string }
  verifyOtp: (
    challengeId: string,
    code: string,
    appIds?: string[],
  ) => { ok: boolean; message: string; session?: Session }
  /** Attach an application to an existing session (e.g. after starting one). */
  attachApp: (sessionId: string, appId: string) => void
  signOut: (partyRole: PartyRole | 'rm') => void
  setPersona: (p: PersonaKey) => void
  setTrayOpen: (v: boolean) => void

  // --- pre-qualification (§6) ---
  setPreQual: (appId: string, patch: Partial<PreQual>) => void
  setOffer: (appId: string, offer: IndicativeOffer) => void

  // --- invites (§7, §8) ---
  createInvite: (i: {
    kind: InviteKind
    appId: string
    name: string
    relationship: string
    mobile: string
    email: string
    channel?: IssuedLink['channel']
  }) => Invite
  openInvite: (token: string) => Invite | undefined
  markInviteJoined: (token: string, partyId?: string) => void

  // --- handoffs (§9) ---
  issueHandoff: (i: {
    appId: string
    forParty: PartyRole
    reason: HandoffReason
    mode: HandoffMode
    channel?: Handoff['channel']
    issuedBy: string
    returnTo: string
  }) => Handoff
  openHandoff: (token: string) => Handoff | undefined
  completeHandoff: (token: string) => void
  cancelHandoff: (id: string) => void

  // --- leads (§5.4) ---
  captureLead: (i: {
    studentName: string
    mobile: string
    email: string
    source: LeadSource
    indicativeAskInr?: number
    capturedBy: string
    branchId: string
  }) => { ok: boolean; lead?: Lead; message: string }
  setLeadStatus: (id: string, status: Lead['status'], dropReason?: string) => void
  convertLead: (id: string, appId: string) => void

  resetSessions: () => void
}

const EMPTY: SessionState = {
  sessions: [],
  otp: [],
  invites: [],
  handoffs: [],
  leads: [],
  issuedLinks: [],
  activeSessionId: {},
  persona: 'student',
  trayOpen: false,
  prequal: {},
  offers: {},
}

/** The opening assumptions a customer sees before they change anything. Stated
 *  once, here, rather than scattered as literals across four screens. */
export const PREQUAL_DEFAULTS: PreQual = {
  coaUsd: 62_400,
  ownContributionInr: 5_00_000,
  monthlyIncomeInr: 1_20_000,
  existingEmiInr: 18_000,
  incomeType: 'salaried',
  isNri: false,
  courseMonths: 24,
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  ...EMPTY,

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  issueOtp: (i) => {
    const now = nowIso()

    // A live lock belongs to the NUMBER, not to one challenge. Without this,
    // "change my number" → re-enter the same number would mint a fresh
    // challenge and the "this number is locked" copy would be a lie.
    const locked = get().otp.find(
      (c) =>
        c.sessionDraft.mobile === i.mobile &&
        c.sessionDraft.partyRole === i.partyRole &&
        c.status === 'locked' &&
        c.lockedUntil !== undefined &&
        new Date(now) < new Date(c.lockedUntil),
    )
    if (locked) {
      // Carry the new destination across so the customer still lands in the
      // right place once the lock lifts.
      const updated = { ...locked, returnTo: i.returnTo ?? locked.returnTo }
      set((s) => ({ otp: s.otp.map((x) => (x.id === locked.id ? updated : x)) }))
      return updated
    }

    _otpSeq += 1
    const challenge: OtpChallenge = {
      id: `OTP-${String(_otpSeq).padStart(4, '0')}`,
      sessionDraft: {
        mobile: i.mobile,
        email: i.email,
        partyRole: i.partyRole,
        displayName: i.displayName,
        officerId: i.officerId,
      },
      channel: i.channel ?? 'both',
      issuedAt: now,
      expiresAt: addMinutesIso(now, POLICY.otpValidityMinutes),
      attempts: 0,
      resendCount: 0,
      status: 'pending',
      code: mockOtp(i.mobile + i.partyRole, 0),
      returnTo: i.returnTo,
    }
    set((s) => ({ otp: [challenge, ...s.otp] }))
    return challenge
  },

  resendOtp: (challengeId) => {
    const c = get().otp.find((x) => x.id === challengeId)
    if (!c) return { ok: false, message: 'That code request has expired. Start again.' }
    if (c.status === 'locked') {
      return { ok: false, message: lockMessage(c) }
    }
    if (c.resendCount >= POLICY.otpMaxResends) {
      return {
        ok: false,
        message: `You have asked for a new code ${POLICY.otpMaxResends} times. Try again in a few minutes, or use a different number.`,
      }
    }
    // Cooldown ladder: 30s → 60s → 60s.
    const wait = POLICY.otpResendCooldownSec[Math.min(c.resendCount, POLICY.otpResendCooldownSec.length - 1)]
    const elapsedSec = minutesSince(c.issuedAt) * 60
    if (elapsedSec < wait) {
      return {
        ok: false,
        message: `You can ask for a new code in ${Math.ceil(wait - elapsedSec)} seconds.`,
      }
    }
    const now = nowIso()
    set((s) => ({
      otp: s.otp.map((x) =>
        x.id !== challengeId
          ? x
          : {
              ...x,
              resendCount: x.resendCount + 1,
              issuedAt: now,
              expiresAt: addMinutesIso(now, POLICY.otpValidityMinutes),
              attempts: 0,
              status: 'pending',
              code: mockOtp(x.sessionDraft.mobile + x.sessionDraft.partyRole, x.resendCount + 1),
            },
      ),
    }))
    return { ok: true, message: 'New code sent.' }
  },

  verifyOtp: (challengeId, code, appIds) => {
    const c = get().otp.find((x) => x.id === challengeId)
    if (!c) return { ok: false, message: 'That code request has expired. Start again.' }

    // A lock that has aged out reopens rather than dead-ending the customer.
    if (c.status === 'locked') {
      if (c.lockedUntil && new Date(nowIso()) < new Date(c.lockedUntil)) {
        return { ok: false, message: lockMessage(c) }
      }
      set((s) => ({
        otp: s.otp.map((x) =>
          x.id === challengeId ? { ...x, status: 'pending', attempts: 0, lockedUntil: undefined } : x,
        ),
      }))
    }

    if (minutesSince(c.issuedAt) > POLICY.otpValidityMinutes) {
      set((s) => ({
        otp: s.otp.map((x) => (x.id === challengeId ? { ...x, status: 'expired' } : x)),
      }))
      return { ok: false, message: 'That code has expired. Ask for a new one.' }
    }

    if (code !== c.code) {
      const attempts = c.attempts + 1
      const locked = attempts >= POLICY.otpMaxAttempts
      set((s) => ({
        otp: s.otp.map((x) =>
          x.id !== challengeId
            ? x
            : {
                ...x,
                attempts,
                status: locked ? 'locked' : 'pending',
                lockedUntil: locked ? addMinutesIso(nowIso(), POLICY.otpLockMinutes) : undefined,
              },
        ),
      }))
      if (locked) {
        return {
          ok: false,
          message: `That is ${POLICY.otpMaxAttempts} wrong codes. For your security this number is locked for ${POLICY.otpLockMinutes} minutes.`,
        }
      }
      const left = POLICY.otpMaxAttempts - attempts
      return {
        ok: false,
        message: `That code doesn't match. ${left} ${left === 1 ? 'try' : 'tries'} left before we lock this number for ${POLICY.otpLockMinutes} minutes.`,
      }
    }

    // Success. Re-entry with the same mobile + role returns the SAME session.
    const now = nowIso()
    const existing = get().sessions.find(
      (s) => s.mobile === c.sessionDraft.mobile && s.partyRole === c.sessionDraft.partyRole,
    )
    let session: Session
    if (existing) {
      session = {
        ...existing,
        lastSeenAt: now,
        appIds: Array.from(new Set([...existing.appIds, ...(appIds ?? [])])),
        displayName: c.sessionDraft.displayName ?? existing.displayName,
      }
      set((s) => ({ sessions: s.sessions.map((x) => (x.id === session.id ? session : x)) }))
    } else {
      _sessionSeq += 1
      session = {
        id: `SES-${String(_sessionSeq).padStart(4, '0')}`,
        partyRole: c.sessionDraft.partyRole,
        mobile: c.sessionDraft.mobile,
        email: c.sessionDraft.email,
        displayName: c.sessionDraft.displayName,
        officerId: c.sessionDraft.officerId,
        appIds: appIds ?? [],
        verifiedAt: now,
        lastSeenAt: now,
      }
      set((s) => ({ sessions: [...s.sessions, session] }))
    }
    set((s) => ({
      otp: s.otp.map((x) => (x.id === challengeId ? { ...x, status: 'verified' } : x)),
      activeSessionId: { ...s.activeSessionId, [session.partyRole]: session.id },
    }))
    return { ok: true, message: 'Verified.', session }
  },

  attachApp: (sessionId, appId) =>
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId && !x.appIds.includes(appId)
          ? { ...x, appIds: [...x.appIds, appId], lastSeenAt: nowIso() }
          : x,
      ),
    })),

  signOut: (partyRole) =>
    set((s) => {
      const next = { ...s.activeSessionId }
      delete next[partyRole]
      return { activeSessionId: next }
    }),

  setPersona: (persona) => set({ persona }),
  setTrayOpen: (trayOpen) => set({ trayOpen }),

  setPreQual: (appId, patch) =>
    set((s) => ({
      prequal: {
        ...s.prequal,
        [appId]: { ...PREQUAL_DEFAULTS, ...s.prequal[appId], ...patch },
      },
    })),

  setOffer: (appId, offer) => set((s) => ({ offers: { ...s.offers, [appId]: offer } })),

  // -------------------------------------------------------------------------
  // Invites (§7, §8)
  // -------------------------------------------------------------------------
  createInvite: (i) => {
    const now = nowIso()
    _inviteSeq += 1
    const token = mkToken('ci', _inviteSeq, i.appId + i.mobile)
    const expiresAt = new Date(
      new Date(now).getTime() + POLICY.coApplicantInviteDays * 86_400_000,
    ).toISOString()
    const invite: Invite = {
      id: `INV-${String(_inviteSeq).padStart(5, '0')}`,
      kind: i.kind,
      appId: i.appId,
      token,
      name: i.name,
      relationship: i.relationship,
      mobile: i.mobile,
      email: i.email,
      issuedAt: now,
      expiresAt,
      status: 'issued',
    }
    const path = i.kind === 'co_applicant' ? `/co/${token}` : `/security/${token}`
    _linkSeq += 1
    const link: IssuedLink = {
      id: `LNK-${String(_linkSeq).padStart(4, '0')}`,
      kind: 'invite',
      label: `${i.name} — ${i.kind === 'co_applicant' ? 'co-applicant' : 'security owner'} invite`,
      path,
      channel: i.channel ?? 'sms',
      issuedAt: now,
      expiresAt,
      appId: i.appId,
    }
    set((s) => ({
      invites: [invite, ...s.invites],
      issuedLinks: [link, ...s.issuedLinks],
      trayOpen: true,
    }))
    return invite
  },

  openInvite: (token) => {
    const inv = get().invites.find((x) => x.token === token)
    if (!inv) return undefined
    if (inv.status === 'issued') {
      set((s) => ({
        invites: s.invites.map((x) => (x.token === token ? { ...x, status: 'opened' } : x)),
      }))
      return { ...inv, status: 'opened' }
    }
    return inv
  },

  markInviteJoined: (token, partyId) =>
    set((s) => ({
      invites: s.invites.map((x) =>
        x.token === token ? { ...x, status: 'joined', joinedAt: nowIso(), partyId } : x,
      ),
    })),

  // -------------------------------------------------------------------------
  // Handoffs (§9) — the single most important piece of the assisted journey.
  // -------------------------------------------------------------------------
  issueHandoff: (i) => {
    const now = nowIso()
    _handoffSeq += 1
    const token = mkToken('ho', _handoffSeq, i.appId + i.reason)
    const expiresAt =
      i.mode === 'in_branch'
        ? addMinutesIso(now, POLICY.handoffInBranchValidityMinutes)
        : addHoursIso(now, POLICY.handoffValidityHours)
    const handoff: Handoff = {
      id: `HO-${String(_handoffSeq).padStart(5, '0')}`,
      appId: i.appId,
      forParty: i.forParty,
      reason: i.reason,
      mode: i.mode,
      channel: i.channel,
      token,
      issuedBy: i.issuedBy,
      issuedAt: now,
      expiresAt,
      status: 'issued',
      returnTo: i.returnTo,
    }
    _linkSeq += 1
    const link: IssuedLink = {
      id: `LNK-${String(_linkSeq).padStart(4, '0')}`,
      kind: 'handoff',
      label: `${HANDOFF_LABEL[i.reason]} — ${i.appId}`,
      path: `/handoff/${token}`,
      channel: i.mode === 'in_branch' ? 'in_branch' : (i.channel ?? 'sms'),
      issuedAt: now,
      expiresAt,
      appId: i.appId,
    }
    set((s) => ({
      handoffs: [handoff, ...s.handoffs],
      issuedLinks: [link, ...s.issuedLinks],
      trayOpen: i.mode === 'remote_link' ? true : s.trayOpen,
    }))
    return handoff
  },

  openHandoff: (token) => {
    const h = get().handoffs.find((x) => x.token === token)
    if (!h) return undefined
    if (h.status === 'issued' && !isHandoffExpired(h)) {
      set((s) => ({
        handoffs: s.handoffs.map((x) => (x.token === token ? { ...x, status: 'opened' } : x)),
      }))
      return { ...h, status: 'opened' }
    }
    if (isHandoffExpired(h) && (h.status === 'issued' || h.status === 'opened')) {
      set((s) => ({
        handoffs: s.handoffs.map((x) => (x.token === token ? { ...x, status: 'expired' } : x)),
      }))
      return { ...h, status: 'expired' }
    }
    return h
  },

  completeHandoff: (token) =>
    set((s) => ({
      handoffs: s.handoffs.map((x) =>
        x.token === token ? { ...x, status: 'completed', completedAt: nowIso() } : x,
      ),
    })),

  cancelHandoff: (id) =>
    set((s) => ({
      handoffs: s.handoffs.map((x) => (x.id === id ? { ...x, status: 'cancelled' } : x)),
    })),

  // -------------------------------------------------------------------------
  // Leads (§5.4)
  // -------------------------------------------------------------------------
  captureLead: (i) => {
    // Dedupe on mobile — a walk-in who called last week is not a new lead.
    const dupe = get().leads.find((l) => l.mobile === i.mobile && l.status !== 'dropped')
    if (dupe) {
      return {
        ok: false,
        message: `${dupe.studentName} is already a lead on this number (${dupe.id}, ${LEAD_STATUS_LABEL[dupe.status]}).`,
      }
    }
    _leadSeq += 1
    const lead: Lead = {
      id: `LEAD-${String(_leadSeq).padStart(5, '0')}`,
      capturedBy: i.capturedBy,
      branchId: i.branchId,
      capturedAt: nowIso(),
      studentName: i.studentName,
      mobile: i.mobile,
      email: i.email,
      source: i.source,
      intendedCountry: 'US',
      indicativeAskInr: i.indicativeAskInr,
      status: 'new',
    }
    set((s) => ({ leads: [lead, ...s.leads] }))
    return { ok: true, lead, message: `${lead.studentName} captured as ${lead.id}.` }
  },

  setLeadStatus: (id, status, dropReason) =>
    set((s) => ({
      leads: s.leads.map((l) => (l.id === id ? { ...l, status, dropReason } : l)),
    })),

  convertLead: (id, appId) =>
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === id ? { ...l, status: 'converted', appId } : l,
      ),
    })),

  // -------------------------------------------------------------------------
  resetSessions: () => {
    resetSeqs()
    set({ ...EMPTY })
  },
}))

// §18 — resetDemo() clears sessions, OTP challenges, leads, handoffs, invite
// tokens AND the module-global counters above.
registerJourneyReset(() => useSessionStore.getState().resetSessions())

// ---- Pure helpers ----------------------------------------------------------

function lockMessage(c: OtpChallenge): string {
  const left = c.lockedUntil ? Math.max(0, Math.ceil(-minutesSince(c.lockedUntil))) : POLICY.otpLockMinutes
  return `This number is locked for ${left} more ${left === 1 ? 'minute' : 'minutes'} after ${POLICY.otpMaxAttempts} wrong codes.`
}

export function isHandoffExpired(h: Handoff, now = nowIso()): boolean {
  return new Date(now) >= new Date(h.expiresAt)
}

export function isInviteExpired(i: Invite, now = nowIso()): boolean {
  return new Date(now) >= new Date(i.expiresAt)
}

export function hoursLeft(iso: string): number {
  return -hoursSince(iso)
}

/** Customer-facing names for the identity-bound acts (§9). Never a code. */
export const HANDOFF_LABEL: Record<HandoffReason, string> = {
  aadhaar_ekyc: 'Aadhaar verification',
  ckyc_consent: 'KYC records permission',
  digilocker_consent: 'DigiLocker permission',
  aa_consent: 'Bank statement permission',
  traces_consent: 'Income tax records permission',
  gstn_consent: 'GST returns permission',
  bureau_consent: 'Credit report permission',
  esign_agreement: 'Signing the loan agreement',
  nach_mandate: 'Setting up repayment',
  declaration_signature: 'Signing the declarations',
  selfie_liveness: 'Photo verification',
  sanction_acceptance: 'Accepting the offer',
}

/** Why an RM cannot do it — shown inline next to the disabled control (§9.2). */
export const HANDOFF_WHY: Record<HandoffReason, string> = {
  aadhaar_ekyc: 'UIDAI sends the one-time code to the Aadhaar-linked mobile.',
  ckyc_consent: 'The registry needs the record holder’s own authorisation.',
  digilocker_consent: 'DigiLocker signs in as the document holder.',
  aa_consent: 'The Account Aggregator consent is bound to their mobile.',
  traces_consent: 'The tax portal needs the taxpayer’s own consent.',
  gstn_consent: 'GSTN needs the registered proprietor’s consent.',
  bureau_consent: 'The bureau needs the borrower’s own authorisation.',
  esign_agreement: 'An e-signature is legally bound to the signer.',
  nach_mandate: 'The mandate is authorised by the account holder.',
  declaration_signature: 'A declaration must be signed by the person making it.',
  selfie_liveness: 'A liveness check needs the person in front of the camera.',
  sanction_acceptance: 'Only the borrower can accept the offer.',
}

export const LEAD_STATUS_LABEL: Record<Lead['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  application_started: 'Application started',
  dropped: 'Dropped',
  converted: 'Converted',
}

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  referral: 'Referral',
  campaign: 'Campaign',
  inbound_call: 'Inbound call',
  partner: 'Partner',
}

/** The active session for a party kind, if any. */
export function activeSession(role: PartyRole | 'rm'): Session | undefined {
  const st = useSessionStore.getState()
  const id = st.activeSessionId[role]
  return id ? st.sessions.find((s) => s.id === id) : undefined
}
