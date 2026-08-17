// ============================================================================
// Consent artifacts (§v3) — the seven consent-gated digital sources named in the
// BRD-18-21 Document Checklist.
//
// A consent is the thing that unlocks a whole class of documents at once. This
// is the operational distinction the BRDs draw and the dashboard previously
// missed: a file can be "waiting on the customer" for two very different
// reasons — an upload they must perform, or a consent they must grant.
// ============================================================================
import type {
  ConsentArtifact, ConsentStatus, ConsentType, PartyRole, SourceSystem,
} from '@/types'

export interface ConsentDef {
  type: ConsentType
  label: string
  /** Which party is asked for this consent. */
  grantedBy: PartyRole
  /** Source systems this consent unlocks. */
  unlocks: SourceSystem[]
  /** How the consent is captured, in customer-facing terms. */
  mechanism: string
  /** Validity once granted (days) — AA consents in particular are time-bound. */
  validityDays: number
}

export const CONSENT_DEFS: ConsentDef[] = [
  {
    type: 'uidai_ekyc',
    label: 'Aadhaar eKYC (UIDAI)',
    grantedBy: 'applicant',
    unlocks: ['UIDAI'],
    mechanism: 'OTP on the Aadhaar-registered mobile, or an offline XML share',
    validityDays: 1,
  },
  {
    type: 'ckyc',
    label: 'Central KYC registry',
    grantedBy: 'applicant',
    unlocks: ['CKYC'],
    mechanism: 'Customer authorisation to download the existing CKYC record',
    validityDays: 30,
  },
  {
    type: 'digilocker',
    label: 'DigiLocker',
    grantedBy: 'applicant',
    unlocks: ['DigiLocker'],
    mechanism: 'Customer links DigiLocker and approves issuer-document sharing',
    validityDays: 90,
  },
  {
    type: 'account_aggregator',
    label: 'Account Aggregator — banking',
    grantedBy: 'co_applicant',
    unlocks: ['AccountAggregator'],
    mechanism: 'AA consent handle covering statement history for the stated period',
    validityDays: 180,
  },
  {
    type: 'itd_traces',
    label: 'Income Tax / TRACES',
    grantedBy: 'co_applicant',
    unlocks: ['ITD-TRACES'],
    mechanism: 'Taxpayer consent to pull ITR, Form 26AS and AIS',
    validityDays: 90,
  },
  {
    type: 'gstn',
    label: 'GSTN returns',
    grantedBy: 'co_applicant',
    unlocks: ['GSTN'],
    mechanism: 'GST-registered proprietor consent for return history',
    validityDays: 90,
  },
  {
    type: 'cic_bureau',
    label: 'Credit bureau (CIBIL / CIC)',
    grantedBy: 'co_applicant',
    unlocks: ['CIC-CIBIL', 'ForeignBureau'],
    mechanism: 'Borrower authorisation on the application form to pull the bureau report',
    validityDays: 30,
  },
]

export const CONSENT_BY_TYPE: Record<ConsentType, ConsentDef> = Object.fromEntries(
  CONSENT_DEFS.map((c) => [c.type, c]),
) as Record<ConsentType, ConsentDef>

export function consentLabel(type: ConsentType): string {
  return CONSENT_BY_TYPE[type]?.label ?? type
}

/** Which consent (if any) unlocks a given source system. */
export function consentForSource(system: SourceSystem): ConsentDef | undefined {
  return CONSENT_DEFS.find((c) => c.unlocks.includes(system))
}

/** Build the consent ledger for a seeded application.
 *  Identity consents (Aadhaar / CKYC / DigiLocker) are typically granted by the
 *  time KYC clears; the financial ones (AA / TRACES / GST / bureau) land at the
 *  credit-analysis stage. Lives here rather than in seed.ts to avoid a
 *  seed ⇄ seedBulk import cycle. */
export function buildConsents(
  appId: string,
  parties: { id: string; role: PartyRole; name: string }[],
  asOf: string,
  overrides?: Partial<Record<ConsentType, ConsentStatus>>,
  stageRank = 99,
): ConsentArtifact[] {
  return CONSENT_DEFS.map((def) => {
    const party = parties.find((p) => p.role === def.grantedBy) ?? parties[0]
    const status: ConsentStatus =
      overrides?.[def.type] ??
      (stageRank >= 6
        ? 'granted'
        : stageRank >= 3
          ? def.grantedBy === 'applicant' ? 'granted' : 'requested'
          : 'not_requested')
    const granted = status === 'granted'
    return {
      id: `${appId}-CN-${def.type}`,
      type: def.type,
      label: def.label,
      partyId: party?.id ?? `${appId}-A`,
      partyRole: def.grantedBy,
      partyName: party?.name ?? '—',
      status,
      requestedAt: status === 'not_requested' ? undefined : asOf,
      decidedAt: granted ? asOf : undefined,
      expiresAt: granted ? addDays(asOf, def.validityDays) : undefined,
      handle: granted ? `${def.type.toUpperCase().slice(0, 4)}-${appId.slice(-4)}` : undefined,
    }
  })
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export const CONSENT_STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'purple'> = {
  granted: 'green',
  requested: 'amber',
  not_requested: 'slate',
  declined: 'red',
  expired: 'purple',
  revoked: 'red',
}
