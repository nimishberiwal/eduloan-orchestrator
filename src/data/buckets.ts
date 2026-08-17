// ============================================================================
// Document engine catalogue (§8.2) — US-only Abroad-PG.
// Buckets + document templates. Checklist is generated per application profile
// (§8.1) from three switches: income branch, NRI overlay, security construct.
// ============================================================================
import type {
  DocMandate,
  DocumentBucket,
  DocumentItem,
  PartySection,
  RequiredByStage,
  SourceSystem,
} from '@/types'
import { consentTypeOf, modeOf } from '@/data/sources'
import { classifyDoc } from '@/data/classification'

export interface BucketTemplate {
  code: string
  title: string
  section: PartySection
  requiredByStage: RequiredByStage
  conditional?: boolean
  // profile predicate: which switch turns this bucket ON (undefined = always)
  onlyIf?: 'salaried' | 'self_employed' | 'nri' | 'secured'
  note?: string
  docs: DocTemplate[]
}

export interface DocTemplate {
  label: string
  mandate: DocMandate
  vintageNote?: string
  /** §v3 — the BRD checklist's "Digital Source". The sourcing MODE and consent
   *  requirement are derived from this via data/sources.ts, so the two can
   *  never drift apart. */
  src: SourceSystem
}

// ---- APPLICANT (Student) ---------------------------------------------------
const APPLICANT_BUCKETS: BucketTemplate[] = [
  {
    code: 'E1', title: 'Identity', section: 'applicant', requiredByStage: 'kyc',
    docs: [
      { label: 'PAN', mandate: 'M', src: 'NSDL' },
      { label: 'Form 60 (where first PAN is pending)', mandate: 'C', vintageNote: 'must convert to PAN before first disbursement — COV-03', src: 'SelfDeclaration' },
      { label: 'Aadhaar masked/XML', mandate: 'M', src: 'UIDAI' },
      { label: 'Alternate OVD — Voter/DL', mandate: 'M', src: 'DigiLocker' },
      { label: 'Passport, ≥6 mo validity beyond course start', mandate: 'M', vintageNote: '≥6 mo validity beyond course start', src: 'PassportSeva' },
    ],
  },
  {
    code: 'E2', title: 'Address', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'Address proof — Permanent (India)', mandate: 'M', src: 'DigiLocker' },
      { label: 'Address proof — Present (post-admission / hostel allotment)', mandate: 'C', src: 'Upload' },
      { label: 'Foreign-on-arrival address — university housing offer / off-campus', mandate: 'M', vintageNote: 'updatable on arrival', src: 'UniversityPortal' },
    ],
  },
  {
    code: 'E3', title: 'Academic — UG completion', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'UG marksheets all semesters', mandate: 'M', src: 'DigiLocker' },
      { label: 'UG degree final/provisional — provisional needs COV', mandate: 'M', src: 'DigiLocker' },
      { label: 'UG transcripts — university-sealed / attested / digital-signed', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Credential evaluation report (WES / ECE / IQAS / NACES)', mandate: 'C', vintageNote: 'US admits; outcome must be Equivalent', src: 'WES-ECE' },
      { label: 'UG migration/passing certificate', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Backlog clearance', mandate: 'C', src: 'UniversityPortal' },
      { label: 'Class 10 marksheet + passing certificate', mandate: 'C', vintageNote: 'PG variants — often re-pulled for completeness', src: 'DigiLocker' },
      { label: 'Class 12 / Diploma marksheet + passing certificate', mandate: 'C', vintageNote: 'PG variants — often re-pulled for completeness', src: 'DigiLocker' },
      { label: 'School / pre-university transcripts (attested format)', mandate: 'C', vintageNote: 'foreign universities require attested format', src: 'Upload' },
      { label: 'Migration / transfer certificate (Class 12 institution)', mandate: 'C', src: 'Upload' },
      { label: 'Gap-year explanation', mandate: 'C', vintageNote: 'gap > 1 yr', src: 'SelfDeclaration' },
    ],
  },
  {
    code: 'E4', title: 'Entrance & language', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'GRE General', mandate: 'C', vintageNote: 'MS/MA/PhD; ≤5 yr at admission', src: 'ETS' },
      { label: 'GRE Subject', mandate: 'C', src: 'ETS' },
      { label: 'GMAT/GMAT-Focus/EA', mandate: 'C', vintageNote: 'MBA/MSc-Mgmt; ≤5 yr at admission', src: 'GMAC' },
      { label: 'LSAT', mandate: 'C', vintageNote: 'JD', src: 'LSAC' },
      { label: 'IELTS/TOEFL-iBT', mandate: 'M', vintageNote: '≤24 mo at course start', src: 'IDP-IELTS' },
      { label: 'Portfolio', mandate: 'C', vintageNote: 'design/arch', src: 'Upload' },
      { label: 'CASPer', mandate: 'C', vintageNote: 'health', src: 'Upload' },
      { label: 'SOP + LORs', mandate: 'O', vintageNote: 'informational', src: 'Upload' },
    ],
  },
  {
    code: 'E5', title: 'Admission — I-20', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'I-20 (USA F-1) with SEVIS ID', mandate: 'M', src: 'UniversityPortal' },
      { label: 'SEVIS fee receipt', mandate: 'M', src: 'SEVIS' },
      { label: 'Conditional admission with covenant for unconditional', mandate: 'C', src: 'UniversityPortal' },
      { label: 'Deferred-admission letter', mandate: 'C', src: 'UniversityPortal' },
      { label: 'Course registration receipt / fee-acceptance acknowledgment', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Institution ID card', mandate: 'O', vintageNote: 'where issued at admission', src: 'Upload' },
    ],
  },
  {
    code: 'E6', title: 'Cost of Attendance', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'University COA per academic year', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Tuition + fees', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Hostel / room-and-board charges', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Health insurance premium (university-required)', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Books / supplies / personal / transportation estimate', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Exam / library / lab / one-time charges', mandate: 'C', src: 'UniversityPortal' },
      { label: 'PG-specific one-time — cohort / alumni / placement-support / equipment', mandate: 'C', src: 'UniversityPortal' },
      { label: 'Scholarship / fee-waiver / financial-aid letter', mandate: 'C', src: 'UniversityPortal' },
      { label: 'Sponsorship letter', mandate: 'C', src: 'Upload' },
      { label: "Lender's living-cost reckoner / country-cost-table reference", mandate: 'M', src: 'InternalPolicy' },
    ],
  },
  {
    code: 'E7', title: 'Accreditation & tier', section: 'applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'USA regional accreditor (CHEA-recognised) — HLC/MSCHE/NEASC/SACSCOC/WASC/NWCCU', mandate: 'M', src: 'CHEA' },
      // The BRD checklist lists each programmatic accreditor as its own row —
      // they are different bodies, different lists and different lookups.
      { label: 'AACSB / EQUIS / AMBA programmatic accreditation (business)', mandate: 'C', vintageNote: 'Triple-Crown signal — abroad PG MBA', src: 'AACSB' },
      { label: 'ABET programmatic accreditation (engineering / CS)', mandate: 'C', src: 'ABET' },
      { label: 'ABA accreditation (US law)', mandate: 'C', src: 'ABA' },
      { label: 'LCME accreditation (US medical)', mandate: 'C', src: 'LCME' },
      { label: 'Other programmatic — RIBA/NAAB architecture · CSWE social work · ACPE pharmacy', mandate: 'C', src: 'Upload' },
      { label: 'Lender internal global-approved-university list (Premier / A / B / C / Not-Approved)', mandate: 'M', src: 'InternalPolicy' },
      { label: 'Premier-PG overlay applicability documentation', mandate: 'C', vintageNote: 'where institution + program on the overlay list', src: 'InternalPolicy' },
    ],
  },
  {
    code: 'E8', title: 'Work experience', section: 'applicant', requiredByStage: 'sanction', conditional: true,
    note: 'Conditional bucket — only if work-ex claimed (common for MBA)',
    docs: [
      { label: 'Employment letter', mandate: 'C', src: 'Employer' },
      { label: 'Relieving letter', mandate: 'C', src: 'Employer' },
      { label: 'Last 3 payslips', mandate: 'C', src: 'Employer' },
      { label: 'Form 16 last FY', mandate: 'C', src: 'ITD-TRACES' },
      { label: 'Bank salary credits 3 mo', mandate: 'C', src: 'AccountAggregator' },
    ],
  },
  {
    code: 'E9', title: 'Visa', section: 'applicant', requiredByStage: 'disbursement_t1',
    docs: [
      { label: 'Visa application form (DS-160 / equivalent)', mandate: 'M', src: 'Embassy' },
      { label: 'Visa appointment / interview confirmation', mandate: 'M', src: 'Embassy' },
      { label: 'Visa fee receipt', mandate: 'M', src: 'Embassy' },
      { label: 'SEVIS fee receipt', mandate: 'M', src: 'SEVIS' },
      { label: 'Visa endorsement / stamping page (post-issuance)', mandate: 'M', vintageNote: 'before first major disbursement', src: 'Embassy' },
      { label: 'Visa rejection / appeal documentation', mandate: 'C', src: 'Embassy' },
    ],
  },
  {
    code: 'E10', title: 'Foreign banking', section: 'applicant', requiredByStage: 'disbursement_living',
    docs: [
      { label: 'Foreign bank account opening confirmation', mandate: 'C', vintageNote: 'either this or a forex card', src: 'Upload' },
      { label: 'Forex card / multi-currency card issued by an Indian bank (LRS route)', mandate: 'C', vintageNote: 'alternative to a foreign account', src: 'Upload' },
      { label: 'University wire details — SWIFT / BIC / account / IBAN', mandate: 'M', src: 'UniversityPortal' },
    ],
  },
]

// ---- CO-APPLICANT (Parent/Guardian) ----------------------------------------
const COAPPLICANT_BUCKETS: BucketTemplate[] = [
  {
    code: 'P1', title: 'Identity & relationship', section: 'co_applicant', requiredByStage: 'kyc',
    docs: [
      { label: 'PAN', mandate: 'M', src: 'NSDL' },
      { label: 'Aadhaar / alternate OVD', mandate: 'M', src: 'UIDAI' },
      { label: 'Relationship proof (birth certificate / family records / passport listing)', mandate: 'M', src: 'DigiLocker' },
      { label: 'Marriage / guardianship certificate (step-parent / guardian)', mandate: 'C', src: 'Upload' },
      { label: 'NRI passport + foreign-residency proof', mandate: 'C', src: 'Upload' },
    ],
  },
  {
    code: 'P2', title: 'Income — salaried branch', section: 'co_applicant', requiredByStage: 'sanction', onlyIf: 'salaried',
    docs: [
      { label: '3 payslips', mandate: 'M', src: 'Employer' },
      { label: 'Form 16 — 2 FY', mandate: 'M', src: 'ITD-TRACES' },
      { label: 'ITR-1/2 — 2 AY + 26AS/AIS', mandate: 'M', src: 'ITD-TRACES' },
      { label: 'Salary account 6 mo', mandate: 'M', src: 'AccountAggregator' },
      { label: 'Employment letter (+ appointment letter if vintage < 2 yr)', mandate: 'M', src: 'Employer' },
    ],
  },
  {
    code: 'P3', title: 'Income — self-employed branch', section: 'co_applicant', requiredByStage: 'sanction', onlyIf: 'self_employed',
    docs: [
      { label: 'Audited/CA-certified P&L + BS — 3 FY with UDIN', mandate: 'M', src: 'Upload' },
      { label: 'ITR-3/4 — 3 AY + 26AS', mandate: 'M', src: 'ITD-TRACES' },
      { label: 'GST returns 12 mo', mandate: 'C', vintageNote: 'if registered', src: 'GSTN' },
      { label: 'Business + current account 12 mo', mandate: 'M', src: 'AccountAggregator' },
      { label: 'Business proof — Udyam / GST RC', mandate: 'M', src: 'GSTN' },
    ],
  },
  {
    code: 'P4', title: 'NRI/OCI overlay', section: 'co_applicant', requiredByStage: 'sanction', onlyIf: 'nri', conditional: true,
    note: 'Whole bucket conditional on NRI parent',
    docs: [
      { label: 'Foreign employment letter + 3 payslips', mandate: 'C', src: 'Employer' },
      { label: 'Foreign tax returns 2 yr', mandate: 'C', src: 'Upload' },
      { label: 'NRE/NRO statements', mandate: 'C', src: 'AccountAggregator' },
      { label: 'Foreign bank statements', mandate: 'C', src: 'Upload' },
      { label: 'FEMA residency status declaration (parent NRI / OCI)', mandate: 'C', src: 'SelfDeclaration' },
    ],
  },
  {
    code: 'P5', title: 'Banking', section: 'co_applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'Primary savings/current 6–12 mo', mandate: 'M', src: 'AccountAggregator' },
      { label: 'Cancelled cheque — NACH always on Indian INR account', mandate: 'M', src: 'Upload' },
      { label: 'Existing-loan statements', mandate: 'C', src: 'AccountAggregator' },
    ],
  },
  {
    code: 'P6', title: 'Bureau & obligations', section: 'co_applicant', requiredByStage: 'sanction',
    docs: [
      { label: 'CIBIL Consumer report', mandate: 'M', src: 'CIC-CIBIL' },
      { label: 'Secondary bureau', mandate: 'O', src: 'CIC-CIBIL' },
      { label: 'Foreign bureau (NRI, where API enabled)', mandate: 'O', vintageNote: 'NRI co-applicant only', src: 'ForeignBureau' },
      { label: 'Off-bureau obligations self-declaration', mandate: 'M', src: 'SelfDeclaration' },
    ],
  },
]

// ---- COLLATERAL PROVIDER (conditional — Tier-3 only) -----------------------
const COLLATERAL_BUCKETS: BucketTemplate[] = [
  {
    code: 'C1', title: 'KYC & net worth', section: 'collateral', requiredByStage: 'sanction', onlyIf: 'secured', conditional: true,
    docs: [
      { label: 'PAN + Aadhaar + OVD', mandate: 'M', src: 'NSDL' },
      { label: 'Relationship to student if not parent', mandate: 'C', src: 'Upload' },
      { label: 'Net-worth statement (CA-certified)', mandate: 'M', src: 'Upload' },
    ],
  },
  {
    code: 'C2', title: 'Title / asset', section: 'collateral', requiredByStage: 'sanction', onlyIf: 'secured', conditional: true,
    docs: [
      { label: 'Sale deed / title deed (chain of title) — immovable', mandate: 'M', src: 'SRO-LandRecords' },
      { label: 'Property tax receipts (current)', mandate: 'M', src: 'MunicipalPortal' },
      { label: 'Encumbrance certificate (13–30 years per state)', mandate: 'M', src: 'SRO-LandRecords' },
      { label: 'Khata / mutation extract', mandate: 'M', src: 'MunicipalPortal' },
      { label: 'Approved / sanction plan (BBMP / DDA / equivalent)', mandate: 'C', src: 'MunicipalPortal' },
      { label: 'Occupancy / completion certificate (OC / CC)', mandate: 'C', src: 'MunicipalPortal' },
      { label: 'Latest electricity / water bill (property)', mandate: 'M', src: 'Upload' },
      { label: 'Property photographs (geo-tagged)', mandate: 'M', src: 'PanelValuer' },
      // Financial-securities alternatives — the BRD lists each instrument
      // separately because each has its own issuer, lien mechanism and portal.
      { label: 'Fixed-deposit certificate with lien-marking', mandate: 'C', vintageNote: 'any one instrument replaces the immovable set', src: 'Upload' },
      { label: 'LIC policy with assignment to lender', mandate: 'C', src: 'Upload' },
      { label: 'Mutual-fund statement with lien-marking', mandate: 'C', src: 'Upload' },
      { label: 'Government securities / bond holding statement (lien)', mandate: 'C', src: 'Upload' },
    ],
  },
  {
    code: 'C3', title: 'Legal & valuation', section: 'collateral', requiredByStage: 'sanction', onlyIf: 'secured', conditional: true,
    note: 'Legal ∥ valuation run in parallel',
    docs: [
      { label: 'Legal opinion — panel lawyer (immovable)', mandate: 'M', src: 'PanelLawyer' },
      { label: 'Title search — 30 years (immovable)', mandate: 'M', src: 'PanelLawyer' },
      { label: 'Technical valuation report — panel valuer', mandate: 'M', src: 'PanelValuer' },
    ],
  },
  {
    code: 'C4', title: 'Charge creation', section: 'collateral', requiredByStage: 'disbursement_t1', onlyIf: 'secured', conditional: true,
    docs: [
      { label: 'Equitable/registered mortgage memorandum', mandate: 'M', vintageNote: 'pre-disbursement perfection; may ride as COV-04', src: 'SRO-LandRecords' },
    ],
  },
]

// ---- LOAN-LEVEL ------------------------------------------------------------
const LOAN_BUCKETS: BucketTemplate[] = [
  {
    code: 'L1', title: 'Application & declarations', section: 'loan', requiredByStage: 'sanction',
    docs: [
      { label: 'Application form — student + co-applicant signed', mandate: 'M', src: 'LenderLOS' },
      { label: 'Margin-money confirmation', mandate: 'M', src: 'LenderLOS' },
      { label: 'Scholarship declaration', mandate: 'C', src: 'SelfDeclaration' },
      { label: 'Sponsorship declaration', mandate: 'C', vintageNote: 'sponsor letter on letterhead; deducted from ask', src: 'Upload' },
      { label: 'Existing-education-loan declaration', mandate: 'M', src: 'SelfDeclaration' },
      { label: 'LRS declaration — outward remittance under education exception', mandate: 'M', src: 'SelfDeclaration' },
      { label: 'FEMA self-declaration of purpose = Education-Abroad', mandate: 'M', src: 'SelfDeclaration' },
      { label: 'Interest-subsidy scheme declaration (Padho Pardesh / Dr Ambedkar)', mandate: 'C', vintageNote: 'scheme-eligible categories; informational', src: 'SelfDeclaration' },
    ],
  },
  {
    code: 'L2', title: 'Mandate & disbursement setup', section: 'loan', requiredByStage: 'documentation',
    docs: [
      { label: 'NACH mandate on parent Indian INR account', mandate: 'M', vintageNote: 'penny-drop', src: 'NPCI' },
      { label: 'Standing instruction for interest-during-moratorium', mandate: 'C', src: 'LenderLOS' },
      { label: 'University wire details', mandate: 'M', src: 'UniversityPortal' },
      { label: 'Tranche disbursement schedule (semester / year wise)', mandate: 'M', src: 'LenderLOS' },
      { label: 'Form A2 — foreign-exchange purchase (per tranche)', mandate: 'M', vintageNote: 'at each tranche', src: 'LenderLOS' },
      { label: 'Forex-rate-lock / spot-rate declaration', mandate: 'M', vintageNote: 'at sanction and per tranche', src: 'LenderLOS' },
      { label: 'Mortgage perfection confirmation', mandate: 'C', vintageNote: 'Tier-3', src: 'SRO-LandRecords' },
    ],
  },
]

export const ALL_BUCKET_TEMPLATES: BucketTemplate[] = [
  ...APPLICANT_BUCKETS,
  ...COAPPLICANT_BUCKETS,
  ...COLLATERAL_BUCKETS,
  ...LOAN_BUCKETS,
]

export const SECTION_ORDER: PartySection[] = ['applicant', 'co_applicant', 'collateral', 'loan']
export const SECTION_LABEL: Record<PartySection, string> = {
  applicant: 'APPLICANT (Student)',
  co_applicant: 'CO-APPLICANT (Parent/Guardian)',
  collateral: 'COLLATERAL PROVIDER (conditional)',
  loan: 'LOAN-LEVEL',
}

// ---- §8.1 profile-driven checklist generator -------------------------------
export interface ProfileSwitches {
  incomeBranch: 'salaried' | 'self_employed'
  nriOverlay: boolean
  securedConstruct: boolean
}

// Returns the buckets present for a given profile (does NOT create doc items).
export function generateBuckets(profile: ProfileSwitches): DocumentBucket[] {
  return ALL_BUCKET_TEMPLATES.filter((t) => {
    if (t.onlyIf === 'salaried') return profile.incomeBranch === 'salaried'
    if (t.onlyIf === 'self_employed') return profile.incomeBranch === 'self_employed'
    if (t.onlyIf === 'nri') return profile.nriOverlay
    if (t.onlyIf === 'secured') return profile.securedConstruct
    return true
  }).map((t) => ({
    id: t.code,
    code: t.code,
    title: t.title,
    section: t.section,
    requiredByStage: t.requiredByStage,
    conditional: t.conditional,
    present: true,
    note: t.note,
  }))
}

let _docSeq = 0
/** Reset the document-id counter so `Reset demo data` reproduces the seed exactly. */
export function resetDocSeq(): void {
  _docSeq = 0
}
function docId(bucketCode: string): string {
  _docSeq += 1
  return `${bucketCode}-D${_docSeq}`
}

// Materialise document items for the present buckets, at a default lifecycle.
export function generateDocuments(
  buckets: DocumentBucket[],
  defaultStatus: DocumentItem['status'] = 'requested',
): DocumentItem[] {
  const out: DocumentItem[] = []
  for (const b of buckets) {
    const t = ALL_BUCKET_TEMPLATES.find((x) => x.code === b.code)
    if (!t) continue
    for (const d of t.docs) {
      out.push(materialiseDoc(docId(b.code), b.code, d, defaultStatus))
    }
  }
  return out
}

/** Build a DocumentItem from a template, deriving the sourcing mode and consent
 *  requirement from the source registry so the two can never disagree. */
export function materialiseDoc(
  id: string,
  bucketId: string,
  d: DocTemplate,
  status: DocumentItem['status'],
): DocumentItem {
  const sourcing = modeOf(d.src)
  const arrived = status !== 'requested'
  return {
    id,
    bucketId,
    label: d.label,
    mandate: d.mandate,
    status,
    version: 1,
    vintageNote: d.vintageNote,
    sourceSystem: d.src,
    sourcing,
    consentType: sourcing === 'consent_fetch' ? consentTypeOf(d.src) : undefined,
    // Classification only exists once a document has actually arrived.
    classification: arrived ? classifyDoc(d.label) : undefined,
  }
}

/** §v2 req 3 — generate a SECOND (or third…) co-applicant's P1–P6 set.
 *
 *  Bucket ids are suffixed (`P1#2`) so the new set can be APPENDED. Never
 *  regenerate the whole checklist to add a party: that would discard every
 *  already-verified document on the file. */
export function generateBucketsForParty(
  incomeBranch: 'salaried' | 'self_employed',
  instance: number,
  partyId: string,
): { buckets: DocumentBucket[]; documents: DocumentItem[] } {
  const templates = ALL_BUCKET_TEMPLATES.filter((t) => {
    if (t.section !== 'co_applicant') return false
    if (t.onlyIf === 'salaried') return incomeBranch === 'salaried'
    if (t.onlyIf === 'self_employed') return incomeBranch === 'self_employed'
    if (t.onlyIf === 'nri') return false
    return true
  })

  const buckets: DocumentBucket[] = templates.map((t) => ({
    id: `${t.code}#${instance}`,
    code: `${t.code}#${instance}`,
    title: `${t.title} — co-applicant ${instance}`,
    section: t.section,
    requiredByStage: t.requiredByStage,
    conditional: t.conditional,
    present: true,
    note: t.note,
    partyId,
    instance,
  }))

  const documents: DocumentItem[] = []
  for (const b of buckets) {
    const t = templates.find((x) => `${x.code}#${instance}` === b.id)
    if (!t) continue
    for (const d of t.docs) {
      documents.push(materialiseDoc(docId(b.id), b.id, d, 'requested'))
    }
  }
  return { buckets, documents }
}

// Bucket status derives from member docs (worst-of).
const DOC_RANK: Record<DocumentItem['status'], number> = {
  rejected: 0,
  qc_fail: 1,
  requested: 2,
  uploaded: 3,
  fetched: 3, // arrived digitally — same standing as a customer upload
  extracted: 4,
  qc_pass: 5,
  waived: 6,
  verified: 7,
}
export function bucketStatus(docs: DocumentItem[], bucketId: string): DocumentItem['status'] {
  const members = docs.filter((d) => d.bucketId === bucketId && d.mandate !== 'O')
  if (members.length === 0) return 'requested'
  return members.reduce((worst, d) => (DOC_RANK[d.status] < DOC_RANK[worst] ? d.status : worst), members[0].status)
}
