// ============================================================================
// Digital-source registry (§v3) — from the BRD-18-21 Document Checklist
// "Digital Source" column.
//
// This is the single source of truth for HOW a document is obtained. A document
// template names only its SourceSystem; the sourcing mode and consent
// requirement are derived here, so the two can never drift apart.
//
// Three modes matter operationally:
//   auto_fetch    — public registry / verification lookup. The bank can pull it
//                   itself. Pending items are a BANK task, not a customer chase.
//   consent_fetch — digitally available, but only behind a customer consent
//                   artifact (DigiLocker, Account Aggregator, UIDAI, CKYC,
//                   ITD/TRACES, GSTN, CIC). Blocked on CONSENT, not on upload.
//   manual_upload — the customer must physically provide it.
// Plus bank_generated (panel vendors, lender LOS) and internal (policy tables).
// ============================================================================
import type { ConsentType, SourceSystem, SourcingMode } from '@/types'

export interface SourceDef {
  system: SourceSystem
  label: string
  mode: SourcingMode
  consentType?: ConsentType
  /** Short note on what the source actually returns — shown on hover. */
  note: string
}

export const SOURCES: SourceDef[] = [
  // ---- Identity & KYC ------------------------------------------------------
  { system: 'NSDL', label: 'NSDL / Protean', mode: 'auto_fetch', note: 'PAN validity & status verification (public verification API)' },
  { system: 'PassportSeva', label: 'Passport Seva', mode: 'auto_fetch', note: 'Passport / MRZ verification against the issuing record' },
  { system: 'UIDAI', label: 'UIDAI eKYC', mode: 'consent_fetch', consentType: 'uidai_ekyc', note: 'Aadhaar eKYC / offline XML — requires the holder’s OTP consent' },
  { system: 'DigiLocker', label: 'DigiLocker', mode: 'consent_fetch', consentType: 'digilocker', note: 'Issuer-signed documents (marksheets, OVDs) — requires account linking' },
  { system: 'CKYC', label: 'CKYCRR', mode: 'consent_fetch', consentType: 'ckyc', note: 'Central KYC registry download — requires customer authorisation' },

  // ---- Financial (all consent-gated) --------------------------------------
  { system: 'AccountAggregator', label: 'Account Aggregator', mode: 'consent_fetch', consentType: 'account_aggregator', note: 'Bank statements & salary credits under an AA consent handle' },
  { system: 'ITD-TRACES', label: 'ITD / TRACES', mode: 'consent_fetch', consentType: 'itd_traces', note: 'ITR, Form 26AS and AIS — requires taxpayer consent' },
  { system: 'GSTN', label: 'GSTN', mode: 'consent_fetch', consentType: 'gstn', note: 'GST returns for the self-employed branch' },
  { system: 'CIC-CIBIL', label: 'CIBIL / CIC', mode: 'consent_fetch', consentType: 'cic_bureau', note: 'Consumer bureau report — requires borrower authorisation' },
  { system: 'ForeignBureau', label: 'Foreign bureau', mode: 'consent_fetch', consentType: 'cic_bureau', note: 'NRI co-applicant bureau, where an API is enabled' },

  // ---- Test & credential bodies -------------------------------------------
  { system: 'ETS', label: 'ETS', mode: 'auto_fetch', note: 'GRE / TOEFL score verification against the conducting body' },
  { system: 'GMAC', label: 'GMAC', mode: 'auto_fetch', note: 'GMAT / GMAT-Focus / EA score verification' },
  { system: 'LSAC', label: 'LSAC', mode: 'auto_fetch', note: 'LSAT score verification' },
  { system: 'IDP-IELTS', label: 'IDP / IELTS', mode: 'auto_fetch', note: 'IELTS score verification (TRF number lookup)' },
  { system: 'Pearson', label: 'Pearson PTE', mode: 'auto_fetch', note: 'PTE-A score verification' },
  { system: 'WES-ECE', label: 'WES / ECE / IQAS', mode: 'auto_fetch', note: 'Credential-evaluation report verification at the NACES agency' },

  // ---- Institution & accreditation registries ------------------------------
  { system: 'SEVIS', label: 'SEVIS', mode: 'auto_fetch', note: 'SEVIS ID active + school SEVP-designated (US)' },
  { system: 'CHEA', label: 'CHEA', mode: 'auto_fetch', note: 'US regional accreditor database (HLC / MSCHE / NEASC / SACSCOC / WASC / NWCCU)' },
  { system: 'AACSB', label: 'AACSB / EFMD / AMBA', mode: 'auto_fetch', note: 'Business-school programmatic accreditation list' },
  { system: 'ABET', label: 'ABET', mode: 'auto_fetch', note: 'Engineering / computing programmatic accreditation database' },
  { system: 'ABA', label: 'ABA', mode: 'auto_fetch', note: 'US law-school accreditation list' },
  { system: 'LCME', label: 'LCME', mode: 'auto_fetch', note: 'US medical-school accreditation list' },
  { system: 'UniversityPortal', label: 'University portal', mode: 'manual_upload', note: 'I-20, COA, transcripts, wire details — student downloads and uploads' },

  // ---- Corporate / property / payment registries ---------------------------
  { system: 'MCA21', label: 'MCA21', mode: 'auto_fetch', note: 'Sponsor company verification (public corporate registry)' },
  { system: 'SRO-LandRecords', label: 'SRO / land records', mode: 'auto_fetch', note: 'Title, encumbrance and charge search (public registry)' },
  { system: 'MunicipalPortal', label: 'Municipal portal', mode: 'auto_fetch', note: 'Property tax, khata / mutation, sanction plan, OC / CC' },
  { system: 'NPCI', label: 'NPCI', mode: 'auto_fetch', note: 'NACH mandate registration & penny-drop name match' },
  { system: 'RBI', label: 'RBI reference', mode: 'auto_fetch', note: 'Reference rate for the forex band check' },

  // ---- People & panel vendors ---------------------------------------------
  { system: 'Employer', label: 'Employer / payroll', mode: 'manual_upload', note: 'Employment, relieving letters and payslips — customer obtains' },
  { system: 'Embassy', label: 'Embassy / consulate', mode: 'manual_upload', note: 'Visa appointment, fee receipts and the stamping page' },
  { system: 'PanelLawyer', label: 'Panel lawyer', mode: 'bank_generated', note: 'Legal opinion and 30-year title search commissioned by the lender' },
  { system: 'PanelValuer', label: 'Panel valuer', mode: 'bank_generated', note: 'Technical valuation and geo-tagged photographs' },

  // ---- Lender-side ---------------------------------------------------------
  { system: 'LenderLOS', label: 'Lender LOS', mode: 'bank_generated', note: 'Application form, sanction letter, tranche schedule, mandates' },
  { system: 'InternalPolicy', label: 'Internal policy table', mode: 'internal', note: 'Approved-university list, Premier overlay slots, country-cost reckoner' },
  { system: 'SelfDeclaration', label: 'Self-declaration', mode: 'manual_upload', note: 'LRS / FEMA / off-bureau / existing-loan declarations signed by the customer' },
  { system: 'Upload', label: 'Direct upload', mode: 'manual_upload', note: 'No digital source available — customer uploads a scan' },
]

export const SOURCE_BY_SYSTEM: Record<SourceSystem, SourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.system, s]),
) as Record<SourceSystem, SourceDef>

export function modeOf(system: SourceSystem): SourcingMode {
  return SOURCE_BY_SYSTEM[system]?.mode ?? 'manual_upload'
}
export function consentTypeOf(system: SourceSystem): ConsentType | undefined {
  return SOURCE_BY_SYSTEM[system]?.consentType
}
export function sourceLabel(system: SourceSystem): string {
  return SOURCE_BY_SYSTEM[system]?.label ?? system
}

// ---- Presentation ----------------------------------------------------------
export const MODE_LABEL: Record<SourcingMode, string> = {
  auto_fetch: 'Auto-fetch',
  consent_fetch: 'Consent fetch',
  manual_upload: 'Manual upload',
  bank_generated: 'Bank / panel',
  internal: 'Internal',
}

export const MODE_TONE: Record<SourcingMode, 'green' | 'blue' | 'amber' | 'purple' | 'slate'> = {
  auto_fetch: 'green',
  consent_fetch: 'blue',
  manual_upload: 'amber',
  bank_generated: 'purple',
  internal: 'slate',
}

/** Modes the bank can satisfy without chasing the customer. */
export const SELF_SERVE_MODES: SourcingMode[] = ['auto_fetch', 'bank_generated', 'internal']
