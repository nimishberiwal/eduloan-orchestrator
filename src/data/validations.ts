// ============================================================================
// Validation catalogue (§10) — ALL 60 rules seeded as data, verbatim messages.
// {tokens} interpolate from each application's seed values.
// ============================================================================
import type { ValidationDef } from '@/types'

// ---- 10.1 Intra-document (Tier 1) ------------------------------------------
export const VAL_INT: ValidationDef[] = [
  {
    id: 'VAL-INT-01', tier: 'INT', title: 'Student PAN format + checksum', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'Student PAN structurally valid — pattern and checksum OK.',
    failMessage: 'Student PAN fails format/checksum — request correct PAN card. → Send back to E1.',
  },
  {
    id: 'VAL-INT-02', tier: 'INT', title: 'Co-applicant PAN format + checksum', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'Co-applicant PAN structurally valid.',
    failMessage: 'Co-applicant PAN fails format/checksum. → Send back to P1.',
  },
  {
    id: 'VAL-INT-03', tier: 'INT', title: 'Aadhaar 12-digit + Verhoeff checksum (both parties)', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'Aadhaar number(s) pass Verhoeff checksum.',
    failMessage: 'Aadhaar checksum invalid for {party}. → Re-capture Aadhaar XML / eKYC.',
  },
  {
    id: 'VAL-INT-04', tier: 'INT', title: 'Passport MRZ valid; ≥6 mo validity beyond course start', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'Passport MRZ OK; {months} months validity beyond course start (≥6 required).',
    failMessage: 'Passport validity {months} mo < 6 beyond course start or MRZ invalid — request renewed passport. Sanction blocked until cured.',
  },
  {
    id: 'VAL-INT-05', tier: 'INT', title: 'I-20 dates: start < end; duration matches Masters norm (1–2 yr)', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'I-20 program dates consistent — {duration} yr within PG norm.',
    failMessage: 'I-20 duration {duration} yr outside 1–2 yr PG norm or dates inverted. → Confirm with university / re-upload I-20.',
  },
  {
    id: 'VAL-INT-06', tier: 'INT', title: 'COA arithmetic: line items sum per year; per-year × years = program total', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'COA arithmetic verified — lines sum to {coa_year}/yr; program total {coa_total}.',
    failMessage: 'COA lines do not sum (Δ {delta}) — re-extract or obtain corrected COA. → SB-02 to S04.',
  },
  {
    id: 'VAL-INT-07', tier: 'INT', title: 'Test vintage: language ≤24 mo at course start; GRE/GMAT ≤5 yr at admission', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'Test vintages OK — {language_test} {lang_age} mo; {test_type} {test_age} yr.',
    failMessage: '{which_test} stale ({age}) — request retake or university test-optional confirmation (→ DEV-05).',
  },
  {
    id: 'VAL-INT-08', tier: 'INT', title: 'UG aggregate recomputed across all semesters = declared ±1%', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'UG aggregate recomputed {calc}% vs declared {decl}% — within ±1%.',
    failMessage: 'UG aggregate mismatch: recomputed {calc}% vs declared {decl}%. → SB-02; verify marksheets.',
  },
  {
    id: 'VAL-INT-09', tier: 'INT', title: "Programmatic accreditor's listed program name = I-20 program name (exact)", triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Program "{program}" exactly matched in {accreditor} listing.',
    failMessage: 'Program name not found in {accreditor} list ("{listed}" ≠ "{i20}"). → Escalate; non-accredited professional program ⇒ REJ-04.',
  },
  {
    id: 'VAL-INT-10', tier: 'INT', title: 'Work-experience chronology consistent; cumulative = declared', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'Work-ex chronology consistent — {months} months cumulative matches claim.',
    failMessage: 'Employment dates overlap/gap; cumulative {calc} ≠ declared {decl}. → Request clarification (E8).',
  },
  {
    id: 'VAL-INT-11', tier: 'INT', title: 'Net ask ₹ = (COA − aid − sponsor − margin) × policy FX, ±2%', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Net loan ask ₹{ask} matches formula at ₹{fx}/USD (Δ {gap}% ≤ 2%).',
    failMessage: 'Net-ask deviates {gap}% from formula. → Re-price / correct L1 application.',
  },
  {
    id: 'VAL-INT-12', tier: 'INT', title: 'Form 16 Box-1 ↔ ITR salary head (co-applicant salaried)', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'Form 16 ↔ ITR salary heads reconcile.',
    failMessage: 'Form 16 Box-1 ₹{f16} ≠ ITR salary ₹{itr}. → SB-03 additional income proof.',
  },
  {
    id: 'VAL-INT-13', tier: 'INT', title: 'P&L ↔ BS reconciliation; Assets = Liabilities + Equity (co-app SE)', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'Financials reconcile — P&L ties to BS; accounting identity holds.',
    failMessage: 'Financials do not reconcile (Δ ₹{delta}). → Request CA-certified statements with UDIN.',
  },
  {
    id: 'VAL-INT-14', tier: 'INT', title: 'Encumbrance certificate continuous, no breaks (collateral)', triggerStage: 'S09', severity: 'BLOCK',
    passMessage: 'EC continuous for {years} yrs — no breaks or charges.',
    failMessage: 'EC shows break/charge in {year}. → SB-04 collateral legal query.',
  },
  // --- §v3: inherited BRD-18 intra-doc rules not previously implemented -----
  {
    id: 'VAL-INT-15', tier: 'INT', title: 'Class 10/12 marks arithmetic — subjects sum to total within ±1 mark', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'Class 10/12 marks reconcile — subject totals within ±1 mark.',
    failMessage: 'Class 10/12 subject marks do not sum to the declared total (Δ {delta}). → Re-verify the marksheet.',
  },
  {
    id: 'VAL-INT-16', tier: 'INT', title: 'Class 12 stream consistent with the course applied for', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'Class 12 stream {stream} consistent with {program}.',
    failMessage: 'Class 12 stream {stream} inconsistent with {program}. → Confirm the academic route.',
  },
  {
    id: 'VAL-INT-17', tier: 'INT', title: 'Entrance scorecard belongs to the current admission cycle', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'Entrance scorecard is from the current admission cycle ({cycle}).',
    failMessage: 'Entrance scorecard cycle {cycle} does not match the admission cycle. → Obtain the correct scorecard.',
  },
  {
    id: 'VAL-INT-18', tier: 'INT', title: 'Admission letter dates — course_end > course_start; duration matches', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'Admission dates consistent — {duration} yr programme, end after start.',
    failMessage: 'Admission letter dates inconsistent or duration mismatched. → Obtain a corrected admission letter.',
  },
  {
    id: 'VAL-INT-19', tier: 'INT', title: 'Fee-schedule arithmetic — line items sum per period; periods sum to course total', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'Fee schedule reconciles across periods to the course total.',
    failMessage: 'Fee-schedule lines do not sum (Δ {delta}). → Obtain a corrected schedule.',
  },
  {
    id: 'VAL-INT-20', tier: 'INT', title: 'Net loan ask = total + reasonable living − scholarship − margin (±₹1)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Net ask reconciles to the fee + living − aid − margin computation (±₹1).',
    failMessage: 'Net ask does not reconcile to the computation (Δ ₹{delta}). → Correct the L1 application.',
  },
  {
    id: 'VAL-INT-21', tier: 'INT', title: 'Margin = 5% of (loan − ₹4L) where total > ₹4L, else nil', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Margin ₹{margin} computed correctly per the IBA model scheme.',
    failMessage: 'Margin ₹{margin} does not match the scheme formula. → Re-compute the margin.',
  },
  {
    id: 'VAL-INT-22', tier: 'INT', title: 'Property-tax receipts in the owner’s name and current FY paid (collateral)', triggerStage: 'S09', severity: 'BLOCK',
    passMessage: 'Property-tax receipts in the owner’s name; current FY paid.',
    failMessage: 'Property-tax receipts not in the owner’s name or the current FY is unpaid. → SB-04 collateral query.',
  },
]

// ---- 10.2 Cross-document (Tier 2) ------------------------------------------
export const VAL_CRS: ValidationDef[] = [
  {
    id: 'VAL-CRS-01', tier: 'CRS', title: 'Student name 7-way: PAN ↔ Aadhaar ↔ Passport ↔ UG marksheets ↔ I-20 ↔ GRE/GMAT ↔ IELTS/TOEFL (fuzzy ≥0.95)', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'Student name converges across all 7 documents (min similarity {score}).',
    failMessage: 'Name divergence: {docA} "{nameA}" vs {docB} "{nameB}" (similarity {score} < 0.95). → SB-02; obtain name-affidavit or corrected document.',
  },
  {
    id: 'VAL-CRS-02', tier: 'CRS', title: 'Student DOB: Passport ↔ Aadhaar ↔ UG marksheet ↔ I-20', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'DOB consistent across identity, academic and admission documents.',
    failMessage: 'DOB mismatch: {docA} {dobA} vs {docB} {dobB}. → SB-02.',
  },
  {
    id: 'VAL-CRS-03', tier: 'CRS', title: 'Co-applicant name + relationship proof + residency status converge', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: 'Co-applicant identity, relationship ({relation}) and residency ({residency}) consistent.',
    failMessage: 'Relationship/residency inconsistent — {detail}. → Request relationship proof / FEMA residency declaration (P1/P4).',
  },
  {
    id: 'VAL-CRS-04', tier: 'CRS', title: 'UG institution recognised (UGC/AICTE or foreign-accredited)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'UG institution "{ug_univ}" recognised — {regulator}.',
    failMessage: 'UG institution not on recognised list. → Escalate; AIU-equivalence check; else REJ-03.',
  },
  {
    id: 'VAL-CRS-05', tier: 'CRS', title: 'Entrance ↔ program route: GRE→MS/MA/PhD · GMAT→MBA/MSc-Mgmt · LSAT→JD (or language-only where test-optional)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Entrance route consistent — {test_type} supports {program_level} {program}.',
    failMessage: 'Route mismatch: {test_type} does not support {program}. → Verify admission basis; possible DEV-05 if university test-optional.',
  },
  {
    id: 'VAL-CRS-06', tier: 'CRS', title: 'Language score ≥ university minimum (or test-optional flag captured)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: '{language_test} {score} ≥ university minimum {min}.',
    failMessage: '{language_test} {score} < university minimum {min} and no test-optional confirmation. → Cure by retake or university waiver letter; else block.',
  },
  {
    id: 'VAL-CRS-07', tier: 'CRS', title: 'University on lender global-approved list', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: '{university} on approved list — slot {slot}.',
    failMessage: '{university} slot = Not-Approved. → Escalate to Credit Policy or REJ-03. Tier-3 collateral mandatory if proceeding on exception.',
  },
  {
    id: 'VAL-CRS-08', tier: 'CRS', title: 'Programmatic accreditation present + current (business/engineering/law/medicine etc.)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: '{accreditor} accreditation Accredited/current for "{program}".',
    failMessage: 'Professionally-accreditable program without current {accreditor} accreditation. → REJ-04 (business/law/medical) or escalate.',
  },
  {
    id: 'VAL-CRS-09', tier: 'CRS', title: 'Premier overlay: institution + program on overlay list AND ask ≤ enhanced ceiling', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Premier-PG overlay valid — basis {basis}; ask ₹{ask} ≤ ceiling ₹{ceiling}; unsecured construct approved.',
    failMessage: 'Overlay claimed but ineligible / ask ₹{ask} > ceiling ₹{ceiling}. → Recompute as Tier-3; regenerate checklist (C1–C4); route SB-05 to Underwriting.',
  },
  {
    id: 'VAL-CRS-10', tier: 'CRS', title: 'SEVIS ID present + active on I-20 (USA)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'SEVIS {sevis_id} present and active; school SEVP-designated.',
    failMessage: 'SEVIS missing/inactive. → Obtain corrected I-20; hold HLD-01.',
  },
  {
    id: 'VAL-CRS-11', tier: 'CRS', title: 'Conditional admit → covenant for unconditional captured', triggerStage: 'S10', severity: 'BLOCK',
    passMessage: 'Admission {status}; covenant COV-01 registered for unconditional before final disbursement.',
    failMessage: 'Conditional admit without covenant. → Attach COV-01 at decision (AWC) or hold HLD-01.',
  },
  {
    id: 'VAL-CRS-12', tier: 'CRS', title: 'Credential evaluation = Equivalent-to-bachelors-US (where required)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Credential evaluation ({agency}) outcome: Equivalent.',
    failMessage: 'Credential eval {outcome}. Insufficient ⇒ block/decline; Pending ⇒ covenant COV-02 before final disbursement.',
  },
  {
    id: 'VAL-CRS-13', tier: 'CRS', title: 'COA ↔ I-20 stated cost ±5%; declared living cost ≤ country-cost-table cap', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'COA ₹{coa} within ±5% of I-20 cost; living cost ≤ {city} cap.',
    failMessage: 'COA vs I-20 gap {gap}% or living cost exceeds {city} cap by ₹{excess}. → Re-size ask or obtain revised COA.',
  },
  {
    id: 'VAL-CRS-14', tier: 'CRS', title: 'Net ask verified against L1 application (gap ≤2%)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'L1 ask matches computed net requirement (Δ {gap}%).',
    failMessage: 'L1 ask off by {gap}% (> 2%). → Correct application / re-size.',
  },
  {
    id: 'VAL-CRS-15', tier: 'CRS', title: 'Sponsorship consistent across E4/E5/L1; no double-count with employer-paid components', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Sponsorship ₹{sponsor} consistently declared and deducted; no double-count.',
    failMessage: 'Sponsorship undisclosed or double-counted with company-paid fees. → Block; sponsor verification VAL-EXT-16.',
  },
  {
    id: 'VAL-CRS-16', tier: 'CRS', title: 'FX conversion within ±2% of RBI reference', triggerStage: 'S07/S13', severity: 'BLOCK',
    passMessage: 'Conversion at ₹{fx} within ±2% of RBI reference ₹{ref}.',
    failMessage: 'FX used deviates {gap}% from reference. → Re-price at policy rate.',
  },
  {
    id: 'VAL-CRS-17', tier: 'CRS', title: 'Co-applicant income 4-way convergence (payslip↔Form16↔ITR↔bank; SE: ITR↔P&L↔GSTR↔bank; + NRI overlay) gap ≤15%', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'Income converges 4-way — max gap {gap}% ≤ 15%. Assessed income ₹{income}/mo.',
    failMessage: 'Income gap {gap}% > 15% across {pair}. → SB-03; 15–20% may ride as DEV-07.',
  },
  {
    id: 'VAL-CRS-18', tier: 'CRS', title: 'FOIR two-track within policy (moratorium interest-only ≤65%; post-moratorium ≤55%)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'FOIR OK — moratorium {foir_m}%, post-moratorium {foir_p}%.',
    failMessage: 'FOIR breach — post-moratorium {foir_p}%. 55–65% ⇒ raise DEV-01 (+1 DoA level); >65% ⇒ re-size or REJ-01.',
  },
  {
    id: 'VAL-CRS-19', tier: 'CRS', title: 'Tier-3 collateral required if ask > overlay ceiling OR slot Not-Approved; collateral Indian-situs', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Security construct consistent — {tier}; collateral {status}.',
    failMessage: 'Unsecured construct not permitted for this file. → Regenerate Tier-3 checklist; foreign-situs collateral out of policy.',
  },
  {
    id: 'VAL-CRS-20', tier: 'CRS', title: 'Collateral technical value ≥ LTV policy × ask; legal clear; mortgage executable', triggerStage: 'S09', severity: 'BLOCK',
    passMessage: 'Collateral cover OK — LTV {ltv}% ≤ {policy}%; legal opinion Clear.',
    failMessage: 'LTV {ltv}% > {policy}% or legal objections: {objection}. → SB-04; shortfall may ride as DEV-03.',
  },
  {
    id: 'VAL-CRS-21', tier: 'CRS', title: 'LRS aggregate (student + parent) within USD 250K per FY', triggerStage: 'S13', severity: 'BLOCK',
    passMessage: 'Projected FY remittance ${amt} within LRS cap $250,000.',
    failMessage: 'FY remittance ${amt} exceeds LRS cap. → Restructure tranche calendar across FYs.',
  },
  {
    id: 'VAL-CRS-22', tier: 'CRS', title: 'Form A2 + FEMA declaration per tranche; purpose = Education-Abroad; payee = university/student foreign account', triggerStage: 'S13 (per tranche)', severity: 'BLOCK',
    passMessage: 'Tranche {n}: A2 + FEMA on file; purpose and payee compliant.',
    failMessage: 'Tranche {n} missing A2/FEMA or payee mismatch. → Collect L2 tranche set before release.',
  },
  {
    id: 'VAL-CRS-23', tier: 'CRS', title: 'Visa endorsement before first major (tuition) disbursement; living tranches gated on visa', triggerStage: 'S13 (T1)', severity: 'BLOCK',
    passMessage: 'F-1 endorsement verified — Tranche 1 releasable.',
    failMessage: 'No visa endorsement on record — no major disbursement. → HLD-02 until stamped visa uploaded (E9).',
  },
  {
    id: 'VAL-CRS-24', tier: 'CRS', title: 'FX rate-lock / spot documented at each tranche; tranche ₹ within band of schedule', triggerStage: 'S13', severity: 'WARN',
    passMessage: 'Tranche {n} FX documented at ₹{fx}; within schedule band.',
    failMessage: 'Tranche {n} FX off schedule band by {gap}%. → Note re-price; Credit to acknowledge.',
  },
  {
    id: 'VAL-CRS-25', tier: 'CRS', title: 'Existing education-loan disclosure ↔ bureau; aggregate UG-EL + PG-EL exposure within policy', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'No undisclosed education loan; aggregate exposure ₹{agg} within policy.',
    failMessage: 'Bureau shows open education loan not declared at L1. → REJ-09 unless satisfactorily explained.',
  },
  {
    id: 'VAL-CRS-26', tier: 'CRS', title: 'Work-ex claims evidenced (payslip/Form 16/bank credits) and consistent', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'Work-experience of {months} mo evidenced and consistent.',
    failMessage: 'Work-ex claimed but unevidenced/inconsistent. → Remove from CAM weighting; request E8 evidence.',
  },
  {
    id: 'VAL-CRS-27', tier: 'CRS', title: 'Section 80E — informational; annual interest certificate to be issued', triggerStage: 'S11', severity: 'INFO',
    passMessage: '80E note added to sanction — interest certificate will issue annually.',
    failMessage: '—',
  },
]

// ---- 10.3 External verification (Tier 3) — Retry re-rolls to success --------
export const VAL_EXT: ValidationDef[] = [
  {
    id: 'VAL-EXT-01', tier: 'EXT', title: 'Student PAN ↔ NSDL live', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'NSDL: student PAN Active.',
    failMessage: 'NSDL: PAN inactive/invalid. → Cure before first disbursement; KYC blocked.',
  },
  {
    id: 'VAL-EXT-02', tier: 'EXT', title: 'Co-app PAN Active + PAN–Aadhaar linked', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'NSDL: co-applicant PAN Active and Aadhaar-linked.',
    failMessage: 'PAN not linked/inactive. → Customer to link PAN–Aadhaar; blocker=customer.',
  },
  {
    id: 'VAL-EXT-03', tier: 'EXT', title: 'Aadhaar eKYC (both parties)', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'UIDAI eKYC verified for student and co-applicant.',
    failMessage: 'eKYC failed for {party} ({reason}). → Retry / offline XML route.',
  },
  {
    id: 'VAL-EXT-04', tier: 'EXT', title: 'Passport Seva / MRZ verification', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'Passport verified against Passport Seva record.',
    failMessage: 'Passport not verifiable. → Manual verification; hold KYC.',
  },
  {
    id: 'VAL-EXT-05', tier: 'EXT', title: 'DigiLocker pull — UG marksheets', triggerStage: 'S05', severity: 'WARN',
    passMessage: 'UG marksheets pulled via DigiLocker; hash match.',
    failMessage: 'DigiLocker unavailable for {university}. → Proceed on uploads; mark unverified-source.',
  },
  {
    id: 'VAL-EXT-06', tier: 'EXT', title: 'Score verification at conducting body (ETS-GRE/TOEFL · GMAC · LSAC · IDP-IELTS)', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: '{test_type} score verified at {body}.',
    failMessage: 'Score not found/mismatch at {body}. → Block; possible misrepresentation → Risk referral.',
  },
  {
    id: 'VAL-EXT-07', tier: 'EXT', title: 'SEVIS check — ID active, school SEVP-designated', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'SEVIS active; {university} SEVP-designated.',
    failMessage: 'SEVIS inactive / school not designated. → HLD-01; obtain corrected I-20.',
  },
  {
    id: 'VAL-EXT-08', tier: 'EXT', title: 'Accreditor lookup — CHEA regional + programmatic current', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'CHEA: {regional} Accredited; {programmatic} current.',
    failMessage: 'Accreditor lookup failed / lapsed accreditation. → REJ-04 for professional programs; else escalate.',
  },
  {
    id: 'VAL-EXT-09', tier: 'EXT', title: 'Credential-evaluation verification at WES/ECE (where required)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: '{agency} report verified — Equivalent.',
    failMessage: '{agency} report unverifiable/Pending. → COV-02 or hard block per policy.',
  },
  {
    id: 'VAL-EXT-10', tier: 'EXT', title: 'Co-app ITR/26AS live match ±5% (ITD + TRACES)', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'ITD/TRACES match within ±5% of declared income.',
    failMessage: 'ITR live pull gap {gap}% > 5%. → SB-03; possible DEV-07 if 15–20% four-way.',
  },
  {
    id: 'VAL-EXT-11', tier: 'EXT', title: 'Account Aggregator banking pull matches statements', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'AA pull matches submitted statements.',
    failMessage: 'AA mismatch/failure. → Re-consent AA or verify uploads manually.',
  },
  {
    id: 'VAL-EXT-12', tier: 'EXT', title: 'CIBIL live — no suit-filed / wilful default / DPD 90+', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'CIBIL {score}; no adverse flags.',
    failMessage: 'Adverse bureau: {flag}. → REJ-02 unless Credit Committee exception.',
  },
  {
    id: 'VAL-EXT-13', tier: 'EXT', title: 'NPCI penny-drop on NACH account ≥85% name match', triggerStage: 'S12', severity: 'BLOCK',
    passMessage: 'Penny-drop success — name match {pct}%.',
    failMessage: 'Penny-drop failed ({pct}%). → Correct account / re-mandate; documentation blocked.',
  },
  {
    id: 'VAL-EXT-14', tier: 'EXT', title: 'PEP/sanctions screen (UN·OFAC·EU·UK-HMT) — student, co-applicant, collateral provider', triggerStage: 'S08', severity: 'BLOCK',
    passMessage: 'Sanctions/PEP screen clear for all parties.',
    failMessage: 'Potential match: {party} vs {list}. → Manual review — Compliance only may clear; confirmed hit ⇒ REJ-06.',
  },
  {
    id: 'VAL-EXT-15', tier: 'EXT', title: 'Collateral SRO/land-records/issuer lookup (Indian-situs)', triggerStage: 'S09', severity: 'BLOCK',
    passMessage: 'SRO/issuer confirms title/lien capability.',
    failMessage: 'Records mismatch/charge found. → SB-04 legal query.',
  },
  {
    id: 'VAL-EXT-16', tier: 'EXT', title: 'Sponsor verification — MCA21 + letterhead authenticity (sponsored cases)', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Sponsor {company} verified on MCA21; letter authentic.',
    failMessage: 'Sponsor unverifiable. → Remove sponsorship from computation; re-size ask.',
  },
  {
    id: 'VAL-EXT-17', tier: 'EXT', title: 'Mobile + email OTP (both parties)', triggerStage: 'S03', severity: 'BLOCK',
    passMessage: 'OTP verified for student and co-applicant.',
    failMessage: 'OTP pending/failed for {party}. → blocker=customer.',
  },
  {
    id: 'VAL-EXT-18', tier: 'EXT', title: 'Visa endorsement verification (stamping page / e-visa) pre-disbursement', triggerStage: 'S13', severity: 'BLOCK',
    passMessage: 'Visa endorsement verified against passport record.',
    failMessage: 'Endorsement unverifiable. → Hold Tranche 1 (pairs with VAL-CRS-23).',
  },
  {
    id: 'VAL-EXT-19', tier: 'EXT', title: 'RBI reference-rate check at tranche ±2%', triggerStage: 'S13', severity: 'WARN',
    passMessage: 'Tranche FX within ±2% of RBI reference.',
    failMessage: 'Tranche FX outside band. → Re-price note to Credit.',
  },
  // --- §v3: BRD external rules not previously implemented ------------------
  {
    id: 'VAL-EXT-20', tier: 'EXT', title: 'Aptitude/entrance score verification at the conducting body (ETS-GRE · GMAC · LSAC)', triggerStage: 'S05', severity: 'BLOCK',
    passMessage: '{test_type} score verified at {body}.',
    failMessage: '{test_type} score not found or mismatched at {body}. → Block; possible misrepresentation → Risk referral.',
  },
  {
    id: 'VAL-EXT-21', tier: 'EXT', title: 'Existing education loan — CIBIL Consumer flags an open EL', triggerStage: 'S06', severity: 'BLOCK',
    passMessage: 'No undisclosed education loan on the bureau record.',
    failMessage: 'Bureau shows an open education loan that was not declared at L1. → REJ-09 unless satisfactorily explained.',
  },
  // Defined for BRD traceability; NOT evaluated — this build is USA-only.
  {
    id: 'VAL-EXT-22', tier: 'EXT', title: 'CAS verification (UK) — institution is a UKVI-licensed sponsor', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'CAS valid; institution is a licensed UKVI sponsor.',
    failMessage: 'CAS invalid or sponsor licence lapsed. → Obtain a corrected CAS.',
  },
  {
    id: 'VAL-EXT-23', tier: 'EXT', title: 'DLI verification (Canada) — institution on the Designated Learning Institution list', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Institution is a Designated Learning Institution.',
    failMessage: 'Institution not on the DLI list. → Study permit cannot issue; escalate.',
  },
  {
    id: 'VAL-EXT-24', tier: 'EXT', title: 'CRICOS verification (Australia) — course registered for international students', triggerStage: 'S07', severity: 'BLOCK',
    passMessage: 'Course is CRICOS-registered for international students.',
    failMessage: 'Course not CRICOS-registered. → Subclass 500 cannot issue; escalate.',
  },
]

// ============================================================================
// §v3 — BRD traceability.
//
// The dashboard's own ids are kept (the acceptance checklist asserts VAL-CRS-01
// and VAL-INT-06 verbatim), and each is mapped back to the rule it implements in
// BRD-18 → BRD-20 → BRD-21. The intra-doc numbering deliberately differs:
// e.g. dashboard VAL-INT-06 implements BRD V-INT-17.
//
// Where one dashboard rule covers two BRD rules the ref lists both.
// ============================================================================
const BRD_REF: Record<string, string> = {
  // --- intra-doc: BRD-18 V-INT-01..14 → BRD-20 15..19 → BRD-21 20..23 -------
  'VAL-INT-01': 'V-INT-01', 'VAL-INT-02': 'V-INT-02', 'VAL-INT-03': 'V-INT-03',
  'VAL-INT-04': 'V-INT-15', 'VAL-INT-05': 'V-INT-16', 'VAL-INT-06': 'V-INT-17',
  'VAL-INT-07': 'V-INT-18 · V-INT-21', 'VAL-INT-08': 'V-INT-20',
  'VAL-INT-09': 'V-INT-22', 'VAL-INT-10': 'V-INT-23', 'VAL-INT-11': 'V-INT-19',
  'VAL-INT-12': 'V-INT-11', 'VAL-INT-13': 'V-INT-12', 'VAL-INT-14': 'V-INT-13',
  'VAL-INT-15': 'V-INT-04', 'VAL-INT-16': 'V-INT-05', 'VAL-INT-17': 'V-INT-06',
  'VAL-INT-18': 'V-INT-07', 'VAL-INT-19': 'V-INT-08', 'VAL-INT-20': 'V-INT-09',
  'VAL-INT-21': 'V-INT-10', 'VAL-INT-22': 'V-INT-14',
  // --- external: BRD-20 V-EXT-01..22 → BRD-21 V-EXT-23 ---------------------
  'VAL-EXT-01': 'V-EXT-01', 'VAL-EXT-02': 'V-EXT-02', 'VAL-EXT-03': 'V-EXT-03',
  'VAL-EXT-04': 'V-EXT-04', 'VAL-EXT-05': 'V-EXT-05', 'VAL-EXT-06': 'V-EXT-06',
  'VAL-EXT-07': 'V-EXT-08', 'VAL-EXT-08': 'V-EXT-12',
  'VAL-EXT-09': 'V-EXT-13 (BRD-21)', 'VAL-EXT-10': 'V-EXT-13 (BRD-20)',
  'VAL-EXT-11': 'V-EXT-14', 'VAL-EXT-12': 'V-EXT-15', 'VAL-EXT-13': 'V-EXT-16',
  'VAL-EXT-14': 'V-EXT-17', 'VAL-EXT-15': 'V-EXT-18', 'VAL-EXT-16': 'V-EXT-23',
  'VAL-EXT-17': 'V-EXT-22', 'VAL-EXT-18': 'V-EXT-20', 'VAL-EXT-19': 'V-EXT-19',
  'VAL-EXT-20': 'V-EXT-07', 'VAL-EXT-21': 'V-EXT-21',
  'VAL-EXT-22': 'V-EXT-09', 'VAL-EXT-23': 'V-EXT-10', 'VAL-EXT-24': 'V-EXT-11',
}

/** Rules that do not evaluate for this product variant. */
const APPLICABILITY: Record<string, ValidationDef['applicability']> = {
  // Non-US country checks — defined for traceability, out of scope (USA-only).
  'VAL-EXT-22': 'out_of_scope_us_only',
  'VAL-EXT-23': 'out_of_scope_us_only',
  'VAL-EXT-24': 'out_of_scope_us_only',
  // Domestic / school-stack rules that only bite when those documents are present.
  'VAL-INT-15': 'conditional',
  'VAL-INT-16': 'conditional',
  'VAL-INT-19': 'conditional',
}

// Cross-doc rules map 1:1 onto the BRD — VAL-CRS-nn implements V-CRS-nn.
for (let i = 1; i <= 27; i++) {
  const n = String(i).padStart(2, '0')
  BRD_REF[`VAL-CRS-${n}`] = `V-CRS-${n}`
}

function withBrd(defs: ValidationDef[]): ValidationDef[] {
  return defs.map((d) => ({
    ...d,
    brdRef: BRD_REF[d.id],
    applicability: APPLICABILITY[d.id] ?? 'in_scope',
  }))
}

export const ALL_VALIDATIONS: ValidationDef[] = withBrd([...VAL_INT, ...VAL_CRS, ...VAL_EXT])

/** Rules that actually evaluate on an application (excludes out-of-scope). */
export const ACTIVE_VALIDATIONS: ValidationDef[] = ALL_VALIDATIONS.filter(
  (v) => v.applicability !== 'out_of_scope_us_only',
)

export const VALIDATION_BY_ID: Record<string, ValidationDef> = Object.fromEntries(
  ALL_VALIDATIONS.map((v) => [v.id, v]),
)

// Interpolate {tokens} into a message string.
export function renderMessage(template: string, tokens?: Record<string, string | number>): string {
  if (!tokens) return template
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    key in tokens ? String(tokens[key]) : m,
  )
}
