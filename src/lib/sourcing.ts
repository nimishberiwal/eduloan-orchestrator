// ============================================================================
// Document sourcing helpers (§v3) — the operational consequences of the BRD's
// "Digital Source" column.
// ============================================================================
import type {
  Application, ConsentArtifact, ConsentType, DocumentItem, SourcingMode,
} from '@/types'
import { CONSENT_DEFS } from '@/data/consents'
import { SELF_SERVE_MODES } from '@/data/sources'

const OPEN_STATUSES: DocumentItem['status'][] = ['requested']

/** Is this document still outstanding (i.e. nothing has arrived yet)? */
export function isOutstanding(d: DocumentItem): boolean {
  return OPEN_STATUSES.includes(d.status)
}

export function consentFor(app: Application, type?: ConsentType): ConsentArtifact | undefined {
  if (!type) return undefined
  return app.consents.find((c) => c.type === type)
}

/** A consent-gated document whose consent has not been granted is blocked on
 *  CONSENT — a materially different customer ask than "please upload this". */
export function isBlockedOnConsent(app: Application, d: DocumentItem): boolean {
  if (d.sourcing !== 'consent_fetch' || !isOutstanding(d)) return false
  const c = consentFor(app, d.consentType)
  return !c || c.status !== 'granted'
}

/** Documents the bank could pull right now without touching the customer. */
export function isSelfServe(app: Application, d: DocumentItem): boolean {
  if (!isOutstanding(d)) return false
  if (SELF_SERVE_MODES.includes(d.sourcing)) return true
  // consent-gated but already consented ⇒ the bank can pull it
  return d.sourcing === 'consent_fetch' && !isBlockedOnConsent(app, d)
}

/** Every document a granted consent unlocks on this application. */
export function docsUnlockedBy(app: Application, type: ConsentType): DocumentItem[] {
  const def = CONSENT_DEFS.find((c) => c.type === type)
  if (!def) return []
  return app.documents.filter((d) => d.consentType === type || def.unlocks.includes(d.sourceSystem))
}

// ---- Roll-ups --------------------------------------------------------------
export interface SourcingMix {
  total: number
  byMode: Record<SourcingMode, number>
  /** Outstanding items only — what still has to happen. */
  outstanding: number
  outstandingSelfServe: number
  outstandingBlockedOnConsent: number
  outstandingManual: number
  /** Share of the whole checklist obtainable without a customer upload. */
  automatablePct: number
}

const EMPTY_MODES = (): Record<SourcingMode, number> => ({
  auto_fetch: 0, consent_fetch: 0, manual_upload: 0, bank_generated: 0, internal: 0,
})

export function sourcingMix(app: Application): SourcingMix {
  const byMode = EMPTY_MODES()
  let outstanding = 0
  let selfServe = 0
  let blocked = 0
  let manual = 0

  for (const d of app.documents) {
    byMode[d.sourcing] = (byMode[d.sourcing] ?? 0) + 1
    if (!isOutstanding(d)) continue
    outstanding++
    if (isBlockedOnConsent(app, d)) blocked++
    else if (isSelfServe(app, d)) selfServe++
    else manual++
  }

  const automatable = byMode.auto_fetch + byMode.consent_fetch + byMode.internal
  return {
    total: app.documents.length,
    byMode,
    outstanding,
    outstandingSelfServe: selfServe,
    outstandingBlockedOnConsent: blocked,
    outstandingManual: manual,
    automatablePct: app.documents.length
      ? Math.round((automatable / app.documents.length) * 100)
      : 0,
  }
}

/** Portfolio-level mix for the Analytics card and the sourcing report. */
export function portfolioSourcingMix(apps: Application[]) {
  const byMode = EMPTY_MODES()
  let total = 0
  let outstanding = 0
  let blocked = 0
  let manual = 0
  let selfServe = 0
  let valueBlocked = 0
  let valueManual = 0

  for (const app of apps) {
    const m = sourcingMix(app)
    total += m.total
    outstanding += m.outstanding
    blocked += m.outstandingBlockedOnConsent
    manual += m.outstandingManual
    selfServe += m.outstandingSelfServe
    if (m.outstandingBlockedOnConsent > 0) valueBlocked += app.askInr
    if (m.outstandingManual > 0) valueManual += app.askInr
    for (const k of Object.keys(byMode) as SourcingMode[]) byMode[k] += m.byMode[k]
  }

  const automatable = byMode.auto_fetch + byMode.consent_fetch + byMode.internal
  return {
    total, byMode, outstanding, blocked, manual, selfServe, valueBlocked, valueManual,
    automatablePct: total ? Math.round((automatable / total) * 100) : 0,
  }
}

/** Consent progress for an application — "2 of 7 granted". */
export function consentProgress(app: Application) {
  const relevant = app.consents
  const granted = relevant.filter((c) => c.status === 'granted').length
  const pending = relevant.filter((c) => c.status === 'requested' || c.status === 'not_requested').length
  const refused = relevant.filter((c) => c.status === 'declined' || c.status === 'revoked' || c.status === 'expired').length
  return { total: relevant.length, granted, pending, refused }
}
