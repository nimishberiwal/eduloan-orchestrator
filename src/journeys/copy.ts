// ============================================================================
// Customer-facing vocabulary (§0.6) — the translation layer.
//
// HARD RULE: the customer never sees internal vocabulary. No stage IDs, no
// VAL-* codes, no bucket codes, no department names, no rule IDs. Everything
// on a customer screen is named here or in lib/plainLanguage.ts.
//
// The catalogues in src/data/* stay the single source of truth for WHAT is
// asked; this file only decides how it is SAID.
// ============================================================================
import type { ConsentType, PartyRole, PartySection } from '@/types'

// ---- Buckets ---------------------------------------------------------------
// Keyed by bucket CODE. A suffixed bucket ('P1#2', a second co-applicant) falls
// back to its base code, so adding a party never produces an unnamed task.

export interface BucketCopy {
  /** The task title. Names the outcome, not the artefact class. */
  title: string
  /** One line: why we're asking. Never "as per policy". */
  why: string
}

export const BUCKET_COPY: Record<string, BucketCopy> = {
  E1: {
    title: 'Your identity documents',
    why: 'The bank has to know who is borrowing before anything else can start.',
  },
  E2: {
    title: 'Where you live',
    why: 'We need an Indian address on record, and your address abroad once you have one.',
  },
  E3: {
    title: 'Your degree marksheets and transcripts',
    why: 'Your university results decide whether the course you have been admitted to is fundable.',
  },
  E4: {
    title: 'Your test scores',
    why: 'GRE, GMAT, IELTS or TOEFL — whichever your university asked for.',
  },
  E5: {
    title: 'Your admission letter and I-20',
    why: 'The I-20 is what proves the admission and the course cost the bank is lending against.',
  },
  E6: {
    title: 'What your course costs',
    why: 'The university’s cost sheet sets the ceiling on what you can borrow.',
  },
  E7: {
    title: 'About your university',
    why: 'The bank checks the university and programme against its approved list. We do most of this ourselves.',
  },
  E8: {
    title: 'Your work experience',
    why: 'You told us you have worked before — this confirms it.',
  },
  E9: {
    title: 'Your visa',
    why: 'Money can only leave the country once your F-1 visa is stamped.',
  },
  E10: {
    title: 'Your account abroad',
    why: 'Living expenses need somewhere to land — a foreign account or a forex card.',
  },
  P1: {
    title: 'Your identity and relationship to the student',
    why: 'You are the co-applicant, so the bank verifies you exactly as it verifies the student.',
  },
  P2: {
    title: 'Your salary documents',
    why: 'Your income is what the loan is repaid from, so it has to be evidenced.',
  },
  P3: {
    title: 'Your business documents',
    why: 'Your income is what the loan is repaid from, so it has to be evidenced.',
  },
  P4: {
    title: 'Your overseas documents',
    why: 'You live outside India, so the bank needs your foreign income and residency papers.',
  },
  P5: {
    title: 'Your bank account',
    why: 'The repayment instruction is set up on an Indian rupee account in your name.',
  },
  P6: {
    title: 'Your credit report and existing loans',
    why: 'The bank checks what you already owe before adding to it.',
  },
  C1: {
    title: 'Your identity and net worth',
    why: 'You are offering security, so the bank verifies you and what you own.',
  },
  C2: {
    title: 'Your property papers',
    why: 'The title has to be clean and in your name before it can be pledged.',
  },
  C3: {
    title: 'Legal and valuation',
    why: 'The bank’s own lawyer and valuer inspect the property. Nothing is needed from you here.',
  },
  C4: {
    title: 'Registering the charge',
    why: 'The final registration step, done before the first payment goes out.',
  },
  L1: {
    title: 'Your application form and declarations',
    why: 'The signed form and the declarations that go with sending money abroad.',
  },
  L2: {
    title: 'Repayment and disbursement setup',
    why: 'How the money reaches your university and how you pay it back.',
  },
}

export function bucketCopy(bucketCode: string): BucketCopy {
  const base = bucketCode.split('#')[0]
  return (
    BUCKET_COPY[base] ?? {
      title: 'Some documents',
      why: 'The bank needs these to complete your file.',
    }
  )
}

// ---- Consents --------------------------------------------------------------

export interface ConsentCopy {
  /** Button/task title — the outcome, in the customer's words. */
  title: string
  /** Why we're asking. */
  why: string
  /** What it saves them. Shown as the payoff before they tap. */
  unlocks: string
  /** Full multi-step mock (§11.1) vs single-tap sheet (§11.2). */
  full: boolean
  /** What the customer actually shares. Plain text, not a legal blob. */
  shares: string[]
}

export const CONSENT_COPY: Record<ConsentType, ConsentCopy> = {
  uidai_ekyc: {
    title: 'Verify yourself with Aadhaar',
    why: 'This is the fastest way to confirm your identity — no scans, no branch visit.',
    unlocks: 'Confirms your name, date of birth and address in one step.',
    full: true,
    shares: [
      'Your name, date of birth, gender and address as held by UIDAI',
      'A masked Aadhaar number — the bank never sees the full number',
      'Nothing else. No transaction history, no biometrics.',
    ],
  },
  ckyc: {
    title: 'Use your existing KYC record',
    why: 'If you have completed KYC with any bank before, we can reuse it instead of asking again.',
    unlocks: 'Saves re-submitting identity and address proofs.',
    full: false,
    shares: [
      'The KYC record already registered against your PAN',
      'Your name, address and identity proofs as recorded there',
    ],
  },
  digilocker: {
    title: 'Connect DigiLocker',
    why: 'Your marksheets and ID documents come straight from the issuer, already verified.',
    unlocks: 'Pulls your issuer-signed marksheets and IDs — no scanning, no attestation.',
    full: true,
    shares: [
      'Only the specific documents you tick on the DigiLocker screen',
      'Documents arrive digitally signed by the issuing body',
      'You can disconnect DigiLocker at any time.',
    ],
  },
  account_aggregator: {
    title: 'Share your bank statements securely',
    why: 'The bank has to see salary credits and balances. This is the RBI-regulated way to share them.',
    unlocks: 'Replaces months of PDF statements with one approval.',
    full: true,
    shares: [
      'Statements for the accounts you choose, for the period shown',
      'Read-only. Nobody can move money through this.',
      'You can revoke it at any time from your consent screen.',
    ],
  },
  itd_traces: {
    title: 'Share your income tax records',
    why: 'Your ITR and Form 26AS confirm the income you have declared.',
    unlocks: 'Replaces uploading returns and tax statements year by year.',
    full: false,
    shares: [
      'Your filed returns, Form 26AS and AIS for the assessment years shown',
      'Nothing is filed or changed on your behalf.',
    ],
  },
  gstn: {
    title: 'Share your GST returns',
    why: 'For a business, the GST returns are the cleanest evidence of turnover.',
    unlocks: 'Replaces uploading twelve months of returns.',
    full: false,
    shares: ['Return summaries for your GSTIN for the period shown'],
  },
  cic_bureau: {
    title: 'Let us check your credit report',
    why: 'Every lender checks this. Seeing it early avoids surprises later.',
    unlocks: 'Confirms your existing loans and repayment record.',
    full: false,
    shares: [
      'Your credit report from CIBIL or another licensed bureau',
      'This is a lender enquiry and is visible on your report.',
    ],
  },
}

// ---- Parties ---------------------------------------------------------------

export const PARTY_LABEL: Record<PartyRole, string> = {
  applicant: 'you',
  co_applicant: 'your parent',
  collateral_provider: 'the property owner',
}

export const PARTY_SELF_LABEL: Record<PartyRole, string> = {
  applicant: 'Student',
  co_applicant: 'Co-applicant',
  collateral_provider: 'Security owner',
}

/** §10.1 rule 1 — the document sections a party owns.
 *
 *  Loan-level documents (L1 declarations, L2 mandate setup) sit with the
 *  APPLICANT: they are the borrower's form and the borrower's declarations, and
 *  the co-applicant countersigns rather than originates them. Putting them on
 *  the parent instead would show a parent tasks about their child's LRS
 *  declaration, which is the exact leak §7.6 forbids in the other direction. */
export function sectionsFor(role: PartyRole): PartySection[] {
  if (role === 'applicant') return ['applicant', 'loan']
  if (role === 'co_applicant') return ['co_applicant']
  return ['collateral']
}

// ---- Blocker states the customer may see (§14) -----------------------------
// Nothing finer than these four. "Credit is waiting on Risk" is not a customer
// concept.
export type CustomerBlocker = 'you' | 'parent' | 'reviewing' | 'third_party'

export const BLOCKER_COPY: Record<CustomerBlocker, string> = {
  you: 'Waiting on you',
  parent: 'Waiting on your parent',
  reviewing: 'We’re reviewing',
  third_party: 'Waiting on someone outside the bank',
}
