# Changelog

Every push to GitHub is tagged and documented here. The rule for this repo:

> **No push without a version.** Each one gets a semver tag, an entry below
> saying what changed and **what was verified**, and a GitHub Release carrying
> those notes.

Entries record *evidence*, not intentions. "Verified" means walked in the
browser or asserted programmatically — not "should work". If something was left
undone or is known-broken, it says so under **Known / open**.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For a prototype, semver reads as:

| Bump | When |
|---|---|
| **major** | A new surface, or a change that breaks how the demo is walked |
| **minor** | New screens, new engine capability, new catalogue coverage |
| **patch** | Defect fixes, copy corrections, doc-only changes |

---

## [2.2.0] — 2026-08-18

**V3 Phase 2 — the customer onboarding orchestrator.** The first swarm that owns
a phase rather than assisting one, and the first that can stop a file moving.

### Added — `src/lib/agents/onboarding.ts`

Four agents in parallel, all `internal`, every finding `audience: 'bank'`. A
customer sees tasks; a readiness score is not a task.

- **Minimum data** — learns what a file needs from what comparable files
  actually had when a decision was reached, via `peersOf`. Deliberately not the
  97-row checklist. It learns from files that got *far enough*, not files that
  got *approved* — a declined file still demonstrates what a decidable one looks
  like.
- **Co-applicant fit** — two questions, not one: does the file need another
  co-applicant, and is the existing one holding it back. The second is
  arithmetic, not opinion: FOIR past `postMoratoriumDeviationMax` says a second
  earner or a smaller ask is what moves the file, not more documents from the
  same person.
- **Enough to decide on** — the anti-goal agent. Fills a real hole:
  `isResolved` in `lib/gating.ts` treats a validation that is *absent* from the
  file as resolved, so today a file missing every check passes the gate as
  cleanly as one that answered them all. Telling absence from
  non-applicability is this agent's whole job.
- **Scope check** — the guardrail, following the `/__dev/agents` probe pattern.

Cohort claims carry `adequate | thin | absent` evidence, borrowed from the
university brief. Below three closed comparables no rate is quoted at all — a
percentage from n=2 is worse than saying nothing.

### The anti-goal, enforced rather than intended

`decision_sufficiency` is handed a `SufficiencyView` — the application with
`decision`, `rejectionCode`, `outcome` and `pendingChecker` stripped. It cannot
fit the mould of an approved loan because it cannot see whether one was
approved. The guardrail proves it: the agent is run against the same file with
the decision forced APPROVE and DECLINE, and all three outputs must be
**byte-identical**.

### Added — the S05 → S06 gate

`GateFailure` gains `kind: 'onboarding'`. S05's exit is where
`defaultDeptForStage` reassigns the file from Ops to Credit, so it is the
handover in the data model. Verified end to end: **S05 → S06, Ops → Credit**.

- **Absence of a verdict is not a failure.** A file never assessed is held by its
  validations like any other; inventing a block for one the orchestrator has not
  looked at would make every legacy file unmovable.
- **The override does not rewrite the verdict.** `ready` stays false and
  `overriddenBy` records who disagreed. The file moves; the record does not
  pretend it was complete.
- The override clears the *onboarding* gate only. APP-2605 still sits at S05 on
  `VAL-INT-06` and `VAL-CRS-01` afterwards, which is correct — this orchestrator
  owns readiness, not the validation catalogue.

### Fixed

- **The guardrail's own false positive, caught before it shipped.** The
  credit-spillover pattern matched the bare words approve / decline / sanction
  and failed four real files on the document label *"Approved / sanction plan
  (BBMP / DDA / equivalent)"* — a building-plan approval for property
  collateral. Not cosmetic: a guardrail breach makes `verdictFrom` hold the
  file, so a false positive here blocks a handover. It now matches asserted
  verdicts and identifiers, not vocabulary.

### Changed

- CJ-08 now persists the applicant's **city and PIN**, which it has always
  collected and always discarded into a milestone remark. The only geography on
  the model is the servicing branch, so a cohort agent asked where applicants
  come from can currently only answer where the bank has offices. This does not
  fix that today — no closed file has one — but it is the difference between the
  gap closing over time and never closing.
- New App-360 **Readiness** tab; new store verbs `assessOnboarding` and
  `overrideOnboarding`, both audited.

### Verified

| Check | Result |
|---|---|
| Guardrail breaches across all 214 files | **0** |
| Determinism · sufficiency independent of outcome · no credit spillover · no customer audience | all true |
| Absent verdict does not block | true |
| Gate holds a not-ready file at S05 | true — `moveForward` refused |
| Override recorded, audited, and clears the gate | true |
| Full handover | **S05 → S06, Ops → Credit** |
| `tsc` · `build` · standalone · vocabulary scan | clean · clean · 0.93 MB · `leaks: []` |

### Known / open

- Readiness runs on demand from the console. It is not yet triggered
  automatically as documents land, so a stale verdict is possible until
  re-assessed.
- The RM surface shows the onboarding failure through `evaluateGate` for free,
  but has no dedicated panel.
- The credit orchestrator (2.1–2.5) is designed but not built.

---

## [2.1.0] — 2026-08-18

**V3 groundwork.** Makes the seeded population causally consistent, so the
learning agents planned for V3 have something real to learn from. No new
features; every change is to generated data and the rollups that read it.

### Why

Planning the V3 credit orchestrator surfaced a problem that would have made its
self-learning sub-agents worthless. The closure reason on a bulk application was
`rng.pick(REJ_CODES)` — drawn independently of the ask, the university, the
bureau score, the FOIR and the blocker. Every rejection code was uncorrelated
with every feature of the file it sat on. Only APP-2613, hand-written, had a
reason its own evidence supported.

That is harmless for a pipeline board, which only counts. It is fatal for a
cohort learner, which would report "files at this university fail 22% of the
time" from pure noise, in a credit context, to a clearance committee.

### Changed — `src/data/seedBulk.ts`

- **A closure now has a cause, and the file is built to support it.** Three
  tables (`REJECTION_CAUSES`, `WITHDRAWAL_CAUSES`, `EXPIRY_CAUSES`) map a reason
  to the stage where it would actually surface and the feature pressure it
  implies. The cause is drawn first; the file's features follow from it.
- **Conditioning is deliberately soft.** A REJ-02 file draws a bureau score from
  512–664 while a healthy file draws 640–810 — the ranges overlap. A learner
  should find a real signal it has to work for, not a separator it can read off
  one column.
- **`bureauScore` was `rng.int(680, 810)`**, so nothing in the entire seed could
  justify REJ-02 "adverse bureau". It now has a sub-680 tail.
- **`stageAtClosure` comes from the cause**, not an independent weighted draw. A
  collateral shortfall surfaces at S09; adverse bureau at S06. Previously a
  collateral rejection could be recorded at S06, before the collateral had been
  looked at.
- **FOIR and bureau are computed before the outcome**, not after it. They were
  written at the party literal and inside `extracted`, which is precisely why no
  closure could reference them.
- **Deviations are raised from the file's own facts** — a FOIR in the 55–65 band
  *is* a DEV-01. `deviations: []` unconditionally meant one deviation existed
  across all 214 files, so `effectiveBand` never escalated.

### Added

- **`ClosureKind` gains `'disbursed'`** and DISBURSED_ACTIVE files carry an
  `Outcome`. Without a positive class every rate a cohort learner could compute
  was a rejection rate with no denominator of successes.

### Fixed

- **`closureByKind` silently dropped the disbursed files.** Its kind list was
  the three bad endings, written when those were the only kinds — so seven
  closed files vanished from the closure mix while `closureRollup` counted
  them, leaving two panels on the same screen disagreeing about how many files
  had closed.

### Verified

| Check | Before | After |
|---|---|---|
| Applications with an `Outcome` | 22 | **37** |
| Positive outcomes | 0 | **7** |
| Files with ≥1 deviation | 1 | **26** |
| Mean bureau on REJ-02 files | 745 (book 745) | **650** (book 729) |
| Mean FOIR on REJ-01 files | 46 (book 46) | **81** (book 47) |
| REJ-03 files on an unlisted university | ~random | **100%** |
| REJ-05 files with a secured construct | ~random | **100%** |
| `closureByKind` vs `closureRollup` totals | 30 vs 37 | **37 vs 37** |

`docs/ACCEPTANCE.md` items 1–5, 7–9 green after reset · party isolation clean
across 97 task-document links · sourcing reconciles on all 14 · population still
214 · the curated 14 byte-identical · `tsc` · `build` · standalone 0.92 MB ·
`scan-vocabulary` `leaks: []`.

### Known / open

- The curated APP-2613 closes at S10 while generated REJ-02 files close at S06.
  That is correct: `seed.ts`'s 14 literals are protected by invariant 4 and were
  not touched.
- Cohort sizes are still small. 214 files across 8 branches and 30 universities
  means many cohorts will be thin, and the V3 learning agents must say so rather
  than quote a percentage from n=3.

---

## [2.0.3] — 2026-08-18

The acceptance re-walk is now complete rather than risk-targeted. All 32 items
across both checklists were re-walked against this tree. One defect found.

### Fixed

- **A redirect loop in the assisted journey.** `OnBehalf`'s catch-all route used
  `<Navigate to="summary">`, which resolves relative to the *current location*
  rather than to the route pattern. An unknown path under `/rm/apply/:id/`
  redirected to `…/tasks/summary`, which did not match `summary` either, so the
  catch-all fired again — appending a segment per hop and building a URL
  hundreds of levels deep. Now absolute.

  Pre-existing, from V1. The sibling `index` route is relative and correct,
  because at the index the location *is* the parent — which is what made the
  bug easy to write. Item 15's guard held throughout (no assisted route ever
  reached an identity-bound screen), which is why nobody had noticed.

### Verified — the full re-walk

`docs/ACCEPTANCE.md`, all 14: reset restores the seed · Kanban population ·
APP-2603 lane failure · APP-2605 verbatim `VAL-CRS-01`/`VAL-INT-06` tokens ·
APP-2608 C1–C4 + `CHECKLIST_REGENERATED` · maker-checker blocks self-countersign
then advances to S11 · APP-2611 COV-01 · APP-2612 tranche gates · APP-2607
Band-2 · non-overridable S03 gate · send-back reason codes · a decline moving
the analytics population · the §5 role matrix · audit who/role/when/from→to.

`docs/ACCEPTANCE-JOURNEYS.md`, all 18: console untouched · OTP session reuse and
the five-wrong-codes number lock · eligibility ₹59,04,000 with no security for
Stanford and security required unranked · APP-2901 reaching the back office ·
AA consent flipping 4 documents with exactly one audit line attributed to the
co-applicant · DigiLocker decline turning 7 documents into uploads and blocking
nothing · party isolation across 97 task-document links · sourcing reconciliation
on all 14 · bad photo rejected then retried · passport-against-I-20 offering
reassignment · ambiguous document to HITL without asking the customer ·
`VAL-CRS-01` in plain language carrying the seeded names · send-back reaching
the top of the list · customer submit held by the same forward gates with no
rule code shown · identity-bound controls visible, disabled and offering a
handoff · remote handoff demanding the party's own OTP and reaching nothing else
· expired token dead-ending · reset clearing every journey counter.

| Gate | Result |
|---|---|
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.92 MB |
| `scripts/scan-vocabulary.mjs` | `leaks: []` |

### Known / open

- Item 14 of `ACCEPTANCE-JOURNEYS` documents "10 blocking tasks" after a blocked
  submit. That was an observation of one file, not an invariant: the file it was
  first walked on is fully collected and correctly shows none. Re-walked on a
  file with outstanding work, where the customer does see work rather than a
  rule. The document's number is left as written.
- Nothing else outstanding on either checklist.

---

## [2.0.2] — 2026-08-18

Fixes the latent `CaptureHost` defect logged as known/open in 2.0.1. One file.

### Fixed

- **A capture result could outlive the document it belonged to.** `CaptureHost`
  held the result as a bare `CaptureResult | null`. React Router reuses the
  component across a `:docId` change — same route pattern, different param, no
  remount — so moving directly from one capture screen to another rendered CJ-18
  for the **previous** document: a passport's reading under the I-20's heading,
  with that document's Confirm button live beneath it. Confirming there would
  have written one document's extraction against another's slot.

  The result is now held together with the document it describes, and a result
  belonging to a different document is simply not a result for this screen. An
  effect resetting on `docId` would also have worked, but it clears one render
  too late — the wrong screen paints first. This makes the stale case
  unrepresentable rather than something to remember to clear.

  Pre-existing, from V1. Not reachable through the normal flow, which leaves
  CJ-18 via the task list; found by a scripted walk that moved between capture
  routes directly. It also affects the co-applicant and collateral portals,
  which mount the same host.

### Verified

| Check | Result |
|---|---|
| The reproduction from 2.0.1 | Passport → confirm, then jump to the I-20 route → **the I-20's capture screen**, file input present |
| Retake | Returns to the capture screen |
| Confirm | Navigates to the task list |
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.92 MB |
| `scripts/scan-vocabulary.mjs` | `leaks: []` |

### Known / open

- The acceptance re-walk carried forward from 2.0.1 is still risk-targeted, not
  exhaustive. Handoff tokens, expiry, the role matrix and analytics have not
  been re-walked since v1.1.0.

---

## [2.0.1] — 2026-08-18

Closes the four **Known / open** items carried by 2.0.0. No new features.

### Added — the vocabulary scanner is now checked in

- `src/lib/vocabulary.ts` — the patterns and the customer route list, in one
  place. `scripts/scan-vocabulary.mjs` scans customer-facing source statically
  and exits non-zero on a hit, so it can gate a release; the same module drives
  a live DOM walk. Neither half is sufficient alone: static analysis cannot see
  `${bucket.code} verified`, and a DOM walk only covers the routes someone
  remembered to visit. Sharing the patterns means they cannot drift.
- The check that found V1's four leaks was a snippet pasted into a browser
  console and never checked in, so it could not be re-run — and by 2.0.0 it had
  not been run against anything V2 added.

### Fixed

- **CJ-28 could show a customer a bucket code.** Its "Still to send" heading fell
  back to the raw declaration group label — `Academic (E3)`, `Income — salaried
  (P2)` — when the backing document was missing from the checklist. Rare enough
  that a walkthrough would not have caught it; the scanner did on its first run.
- **`audit()` stamped the un-offset clock.** It defaulted to `NOW_ISO`, the
  frozen base, rather than `nowIso()`, which includes the operator's offset. Any
  audit line written after someone advanced the demo clock was dated *before*
  the action that produced it — hiding exactly what the clock control exists to
  show. Verified: +48h, then a milestone lands at base + 48h.
- **The fraud agent's verdict reached nobody.** Its score and signals were
  computed and dropped; `audience: 'bank'` kept the verdict private, and private
  turned out to mean private from everyone. New optional
  `Application.agentChecks` records score, signals, the rules run and whether
  anything blocks, per document, merged by `docId` so a re-upload corrects
  rather than appends.

### Changed

- Documents tab gains an **Agent checks** strip. Placed there rather than on
  Integrations, which the plan suggested, because Integrations is a table of
  external system calls and a fraud check on an uploaded page is not one.

### Verified

| Check | Result |
|---|---|
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.92 MB |
| `scripts/scan-vocabulary.mjs` | `leaks: []` across 31 files, 8 patterns |
| Live DOM scan, 27 customer routes | `leaks: []`, all 27 rendered without redirect |
| Live DOM scan, CJ-28 populated | `leaks: []` with both lists and a discrepancy shown |
| Fraud verdict, bank side | `fraud 50% — name similarity against a sanctions list`, blocking, on the Documents tab |
| Fraud verdict, customer side | no leak; the words "fraud" and "watchlist" absent from the customer screen |
| Audit clock | +48h → audit line at base + 48h |
| `docs/ACCEPTANCE.md` items 1–5, 7–9 | green after **Reset demo data** |
| `ACCEPTANCE-JOURNEYS` items 9, 10, 11 | green — re-walked because V2 rewrote `Capture` |

### Known / open

- **The acceptance re-walk was risk-targeted, not exhaustive.** Eight of the 14
  console checks were asserted against the store after a reset, and three of the
  18 journey items were re-walked in the browser — the three that run through
  the `Capture`/`ConfirmDetails` path V2 rewrote. The remaining journey items
  (handoff tokens, expiry, role matrix, analytics) were not re-walked; V2 does
  not touch them, but "does not touch" is an argument, not a check.
- **`CaptureHost` keeps its capture result in component state across a `:docId`
  change.** Navigating directly from one capture screen to another shows the
  confirm screen for the previous document. Pre-existing, not reachable through
  the normal flow (which exits via the task list), and found only because a
  scripted walk moved between capture routes directly.
- Item 4 of `docs/ACCEPTANCE.md` (`APP-2605` verbatim fail messages) was checked
  against the seeded tokens in the store, not read off the rendered Validations
  tab.

---

## [2.0.0] — 2026-08-18

**V2 complete.** Items 1–5 of the six agentic-origination developments; item 6
shipped early in `1.1.0`. See [docs/VERSIONS.md](docs/VERSIONS.md) for what V1
and V2 each are and how to tell them apart in the code.

Major rather than minor because it changes how the demo is walked: every
document upload now runs a visible three-agent swarm, countersign produces a
six-paper sanction pack, and disbursement is gated on evidence that did not
previously exist.

### Added — upload instead of typing (items 1 & 2)

- `SmartFill` on **all six** detail screens — CJ-05 Cost, CJ-06 Parent snapshot,
  CJ-08 Profile, CJ-09 Academics, CJ-10 Admission, CJ-11 Add parent. Upload the
  backing document and the form is prefilled and still editable.
- CJ-10 additionally offers the **entrance score report** (chosen by programme —
  GRE for MS/MA/PhD, GMAT for MBA/Mgmt, LSAT for JD, following the E4 bucket's
  own conditionality) and the **IELTS/TOEFL report**.
- The same three-agent swarm now runs on the **ordinary checklist upload**
  (`DocFlows.Capture`), where most of a file's 97 documents actually arrive.
  Previously the agents were visible only on six screens.
- **Verified:** COA 50000 → 62400, income 90000 → 211400, PAN name/DOB/PAN,
  SEVIS `N0031882745`, GRE 329, IELTS 7.5 + TOEFL 112 — each proved by setting
  the field wrong first and watching the swarm correct it.

### Added — self-declared data and its gate (item 3)

- **CJ-28 "Check what you told us"** at `/apply/:id/verify`. Two lists, because
  they are not the same problem: *Still to send* (an upload resolves it) and
  *Doesn't match* (a contradiction an upload will not fix). The screen never
  rewrites `enteredValue` — it is the thing being verified.
- Discrepancies in plain language: *"You told us 9.1 CGPA for result; the
  document says 8.4 CGPA."* Deliberately not a verdict — we do not know which
  side is wrong.
- **The condition of disbursement.** `gatesFor(app, tranche)` appends a derived
  gate to tranche 1: the file sanctions and signs normally, and no money moves
  until every self-declared fact is evidenced and nothing is contradicted.
  Enforced at all three read sites — CJ-26, `releaseTranche`, and the console
  Tranches tab — so the officer sees the gate the release check enforces.
- **Verified** on APP-2901: two groups owed → PAN resolved 3/3 clean → marksheet
  produced two genuine contradictions → gate `passed: false`.

### Added — the sanction pack (items 4 & 5)

- **Seven agents at countersign.** Six produce papers into a new
  `app.generatedDocs`: credit assessment memo and internal risk note (bank),
  sanction letter, Key Facts Statement, repayment schedule and conditions
  schedule (customer). The seventh drafts outreach.
- `sanctionTerms(app)` computes the loan **once**, so the letter, the KFS, the
  schedule and the outreach cannot quote four different numbers for the same
  loan.
- **Outreach is drafted, never sent.** Drafts carry the new `CommStatus`
  `'draft'` and leave only through `approveOutreachDraft`; `discardOutreachDraft`
  removes one unsent. Both audited.
- New console **Sanction pack** tab, each paper labelled `bank only` or
  `shared with customer`, downloads through the existing `downloadText` +
  `stampedName`. CJ-22 filters on `audience === 'customer'` **in code** — the
  CAM and the risk note sit in the same container.
- **Verified** on APP-2610 (₹44,00,000 at 10.5%): 30 months interest-only at
  ₹38,500, then 150 instalments of ₹52,789; total interest ₹46,73,414; APR
  10.57%. Letter, KFS, schedule and SMS all agree. Customer screen shows the
  four customer papers and neither bank paper.

### Fixed

- **A 1% tolerance passed a wrong graduation year.** `valuesAgree` applied a
  proportional tolerance to every number — written for CGPA rounding, but ±20
  years of slack on a year, so entered `2024` against a marksheet reading `2025`
  came back `pass`. The tolerance now applies only where one side is fractional.
- **`discrepancies()` swept in pre-existing seeded mismatches.** The seed carries
  seven `match: 'fail'` fields that are console-side validation failures with
  their own rules; wiring the disbursement gate to them would have blocked
  APP-2612 — the only seeded application with tranches. Now scoped to
  declaration-flow fields.
- **A co-applicant's PAN prefilled the student's name.** `extractionContext` had
  no idea whose document it was describing. Fixed at **both** call sites — the
  first fix missed `runExtraction`, which is the one feeding the form.
- **A false discrepancy from our own placeholder** — entered "Rajesh Rao" against
  a read of `"as printed"`, marked `fail`. Placeholders are no longer readings.
- **`ConfirmDetails` showed customers `"as printed"`.** The `ExtractionContext`
  fix had landed in `SmartFill` only, never reaching the older path most
  documents take.
- **The validation agent's output was discarded.** `runValidation` built real
  `ValidationResult`s that nothing consumed. `recordAgentFindings` now persists
  them to `app.validations`, which `evaluateGate` reads — a passport upload
  failing `VAL-INT-04` genuinely holds the non-overridable S03 gate.
- **`hasBlocking` was dead code**; it now selects the audit verb, so a
  BLOCK-severity finding does not read like a warning.
- **Three pre-existing `countersign` defects**: a hardcoded `180` instead of
  `POLICY.sanctionValidityDays` (the literal appeared three times in one block);
  a hardcoded owning officer instead of `PRIMARY_OFFICER.Credit`; and an inlined
  comm body that dropped the `validity` token its own template carries, so the
  customer's sanction email omitted the one date the offer turns on.
- **There was no interest rate anywhere in the product.** A bare `10.5` sat in a
  private helper under a comment saying the sanction letter carried the real
  band; CJ-22 separately displayed a hardcoded `Floating, 9.75%–11.25%`. Now
  `POLICY.sanctionRoi`, read by the indicative maths, all four generated papers,
  the outreach drafts and CJ-22.
- **"PAN" is a document in both E1 and P1.** `SmartFill`'s first-match-wins
  handed co-applicant screens the student's PAN. Both the component and
  `DeclarationSpec` now scope by bucket.
- **The university dropdown** went from 14 to 45 entries in build order; sorted
  alphabetically for display.

### Changed

- `ExtractedField` gains optional `sourceKey`; `Application` gains optional
  `generatedDocs`; `CommStatus` gains `'draft'`; `App360Tab` gains `'papers'`.
  All optional, so `data/seed.ts`'s 14 literals compile untouched.
- `POLICY` gains `sanctionRoi`, `courseMonthsByLevel` and
  `postCourseMoratoriumMonths`.

### Known / open

- **The fraud agent's score and signals are not surfaced.** They are counted in
  the audit line but have nowhere to live on the application. Surfacing agent
  findings on the Integrations and HITL views is Phase F, not built.
- **`audit()` stamps `NOW_ISO`, the un-offset base clock**, not `nowIso()`. Any
  audit line written after an operator advances the demo clock is stamped at the
  base instant. Pre-existing and repo-wide; not addressed here.
- **The 28-route internal-vocabulary scan was ad-hoc**, not a checked-in script.
  It has not been re-run against CJ-28 or the Sanction pack tab.
- No acceptance checklist was re-walked end to end for this release.

### Verified

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | clean |
| `node scripts/build-standalone.mjs` | clean — 0.91 MB self-contained |
| Live walk | APP-2901 (items 1–3) and APP-2610 (items 4–5) |

---

## [1.1.0] — 2026-08-17

University intelligence (v2 item 6) and its researched corpus. A **checkpoint
release**: v2 items 4 and 5 are not started, item 3 is partly built, and further
item 1/3 work was in flight in a parallel session and is deliberately **not**
included — see *Known / open*.

### Added — university intelligence corpus (`src/data/universityIntel.ts`)

- **45 hand-researched university dossiers · 146 findings**, covering the 14
  originally selectable universities plus the 31 US schools in the FT Global MBA
  Ranking 2026 not already listed. **13 are marked `thin`** — researched and
  genuinely quiet — rather than padded.
- Every finding carries a **real publisher, publication date and source URL**,
  a category (funding · leadership · faculty · ranking · policy · adverse) and a
  researcher-assigned `level`. No finding is ever `block`: university news
  informs a credit view and must not, on its own, stop a customer's file.
- `US_UNIVERSITIES` extended to 45 so the new schools are selectable at
  pre-qualification. They carry **no `rank`** — see *Known / open* item 2.

### Added — the university swarm (v2 item 6)

- **`lib/agents/university.ts`** — `runUniversitySwarm`, a pure function of the
  application, mirroring the document swarm. Selects corpus findings relevant to
  the university *and* programme, synthesises a brief, stamps `fetchedAt`.
  Every finding is `audience: 'bank'`.
- **`lib/agents/universityCorpus.ts`** — resolution and selection. The corpus's
  exact key first, then a token-subset match, then nothing. Deliberately not
  fuzzy string distance, and deliberately **no alias table**: writing out fifty
  benefactor-to-university pairs would reproduce the FT list, which is researched
  data and belongs in the corpus beside its source.
- **24-hour refresh on the prototype clock.** A brief older than 24h is stale;
  opening the file re-runs the crawl, increments `revision`, prints the previous
  stamp beside the new one and writes a `UNIVERSITY BRIEF REFRESHED` audit line
  **stamped at the advanced time**. No `Date.now()` anywhere in the path.
- **New App-360 tab — “University brief.”** Synthesis plus one card per source
  with its publisher, date and clickable URL. Three coverage states, not two:
  `adequate`, `thin`, and **`absent`** — which renders an amber *“absent, not
  clean — nobody has looked”* banner, because an empty panel otherwise reads as a
  clean bill of health.
- **New store verb** `recordUniversityBrief`, idempotent on `fetchedAt` so
  reopening a file does not pile up audit lines.
- **`docs/API-CONTRACT.md §8`** — the crawl endpoint. States plainly that the
  fetch is **modelled, not live**: zero network calls is a design constraint and
  the standalone build must work offline.

### Changed

- `Application` gains optional `universityBrief` (optional so `seed.ts`'s 14
  literals compile untouched; plain data only, `structuredClone`-safe).
- `/__dev/agents` extended with the university swarm, a corpus-resolution
  diagnostic over all 214 applications, and 14 name-matching guards.

### Fixed

- **`Penn State University` resolved to the `Penn` (Wharton) dossier** — a Penn
  State applicant was handed Wharton's brief: sourced, plausible, wrong
  institution. The institution-token rule is now general, not place-only.
- **`University of Washington` matched `Washington University`** — both reduce to
  `{washington}`. Identical place-only token sets are now refused.
- **The brief claimed a parent-university dossier was “the business school for
  this programme”**, gated on the programme rather than on the key.
- **The customer-leak detector false-positived on `publisher: 'Dartmouth'`** — a
  university press office is a legitimate source. A red banner that cries wolf is
  worse than no check.

### Verified

Gates run against the **release commit in an isolated worktree**, so a parallel
session's uncommitted work could not affect the result.

| Check | Result |
|---|---|
| `tsc --noEmit`, `npm run build` | clean |
| Standalone single-file build | 0.89 MB, self-contained |
| `/__dev/tasks` — party isolation, 14 curated applications | clean |
| `/__dev/tasks` — projection agrees with the checklist | 14/14, 0 disagreeing |
| University swarm determinism (run twice, JSON diffed) | identical on all 14 |
| Brief reaches no customer route | 0 customer lanes · 0 customer-audience findings · 0 brief strings in `tasksFor()` + `customerFacingStatus()` |
| 24h staleness boundary | fresh at +23h, stale at +25h, every row |
| No finding is ever `block` | 0 across all rows |
| Corpus name-matching guards | 14/14 hold |
| Corpus resolution determinism | every university resolves identically on repeat |
| Corpus resolution coverage | 44 of 62 probe rows resolve; 12 names unresolved and named |
| Re-crawl observable end to end | APP-2612 rev 1 → rev 2 at both +24h (exact boundary) and +48h, with previous stamp and a new audit line |
| Network calls in `src/` | 0 (`fetch`/`XMLHttpRequest`/`WebSocket`) |

### Known / open

1. **Parallel-session work is excluded.** A second session's Phase A/B work
   (remaining detail screens, `verifyDeclared`, `recordAgentFindings`) was
   uncommitted and **not compiling** at the moment this version was cut. It is
   deliberately not in this release. v2 items 4 and 5 are not started; item 3 is
   partly built.
2. **The 31 FT additions carry no `rank`, so they get no premier overlay.**
   Wharton, Booth, Kellogg, Haas and Tuck therefore get no unsecured uplift while
   Purdue at rank 89 gets `Global-Rank-Top-100`. Setting `rank` from the FT table
   was proposed and **rejected**: six of the 45 are absent from the FT table, so
   Stanford and Columbia would have gone `top50` → NONE. Awaiting a decision on
   whether a separate programmatic basis is wanted.
3. **The basis label is only honest while `rank` is a global rank.**
   `PreQual.tsx` derives `overlayBasis` from the band alone. If a
   programme-specific table is ever used for `rank`, the label must move to
   `'Programmatic-Top'` — which `OverlayBasis` already carries. Now commented at
   the point the label is manufactured.
4. **12 university names resolve to no dossier** — Boston College, IIT Chicago,
   JHU, NC State, Ohio State, Penn State, Rutgers, Texas A&M, UB SUNY, UF, UIUC,
   UMass Amherst. Genuinely absent from the corpus, and rendered honestly as
   `absent` rather than as a clean result.
5. **`Georgia Tech` does not token-match `Georgia Institute of Technology`** —
   `Tech` and `Technology` are different tokens. Harmless today because the corpus
   files it under the short key, but a real limit of structural matching.
6. **The acceptance checklists were not re-walked for this release.**
   `docs/ACCEPTANCE.md` and `docs/ACCEPTANCE-JOURNEYS.md` were last walked at
   v1.0.0. The Phase E surfaces were walked live; the Phase A/B/C surfaces
   were not re-walked by the session that cut this version.
7. **A full page reload resets the prototype clock offset**, so the 24h re-crawl
   must be demonstrated with in-app navigation, not a browser reload.
8. Everything under v1.0.0's *Known / open* still stands.

---

## [1.0.0] — 2026-08-16

First push. Contains the whole prototype: the back-office dashboard (built in
three earlier waves) plus the Glib.money origination journeys.

### Added — back-office dashboard (`/console`)

- **13-stage state machine** (S01–S13) + 4 terminals, with parallel
  applicant / co-applicant / collateral lanes converging before S07.
- **Document engine** — 22 buckets, 126 templates, profile-driven checklist
  (income branch · NRI overlay · security construct), 5 sourcing modes derived
  from a 32-source registry, 7 consent artifacts.
- **73 validation rules** with BRD traceability, seeded per application.
- **49 orchestration verbs**, all audited, with the role × verb transition
  matrix, maker-checker, forward gates, DoA bands and the Committee path.
- **7 views** — Pipeline · Queues · Batches · Application 360 (12 tabs) ·
  Analytics · Reports (14, CSV-exportable) · Automation.
- **214 seeded applications** — 14 curated acceptance scenarios plus ~200
  deterministic generated ones across 8 branches.

### Added — Glib.money journeys (`/`, `/co/:token`, `/security/:token`, `/rm`)

- **Customer journey** CJ-00…CJ-27 — landing, OTP auth, pre-qualification and
  indicative offer, capture, task list, document capture with classification and
  extraction, tracker, sanction → disbursement.
- **Co-applicant portal** CO-01…CO-08 — own session, own consents, own
  documents. The parent grants 4 of the 7 consents.
- **Collateral portal** CP-01…CP-04 — Tier-3 only, asset declaration plus the
  C1–C4 documents.
- **Assisted journey** RM-01…RM-09 — leads, pipeline, branch view, apply on
  behalf, collect documents.
- **The handoff primitive** — an RM may never perform an identity-bound act;
  attempting one issues a handoff (in-branch or remote link) instead.
- **Five pure modules** — `customerTasks` (the projection), `eligibility`,
  `handoff`, `plainLanguage`, `capture`.
- **`emitJourneyEvent`** — the event contract. Dispatches to existing store
  verbs; holds no mutation logic of its own, so the two surfaces cannot drift.
- **Glib.money brand system** — tokens scoped under `.glib` so the console is
  untouched; two self-hosted variable fonts (latin subset, 77 kB) with a
  `BUILD_FONTS=none` fallback.
- **Two dev surfaces** — `/__dev/tasks` (projection inspector) and the persona
  switch with its issued-links tray.

### Verified

| Check | Result |
|---|---|
| `tsc --noEmit`, `npm run build` | clean |
| Dashboard acceptance (`docs/ACCEPTANCE.md`) | 14/14 green |
| Journey acceptance (`docs/ACCEPTANCE-JOURNEYS.md`) | 18/18 green |
| Party isolation across 14 curated applications | clean, asserted continuously |
| CJ-15 headline vs dashboard sourcing mix | reconciles on all 14 |
| Internal-vocabulary scan, 28 customer routes | 0 leaks |
| Live console errors across the route sweep | 0 |
| `Reset demo data` | returns exactly 214 applications, all journey state cleared |
| Standalone single-file build | 0.74 MB, self-contained, renders from `file://` |
| Fresh `git clone` → `npm install` → `npm run build` | clean |

### Fixed

Nineteen defects found during two verification sweeps — full table with cause
and fix in `docs/ACCEPTANCE-JOURNEYS.md`. The ones that would have shipped
silently:

- OTP lock was held on the *challenge*, so re-entering the same number walked
  straight past it — the "this number is locked" copy was a lie.
- The indicative offer silently computed from defaults, because pre-qual answers
  were passed through react-router state and each navigation replaces it.
- `APP-2801` collided with a seeded application; a new file resolved to a
  REJECTED bulk record. See **Known / open** below.
- Consents granted by a parent audited as *"Admin"*.
- The classifier read the document slot rather than the file, so the mismatch
  prompt could never fire.
- An Ops send-back produced no customer task at all.
- The §11.3 task-disappearance animation was dead code.
- Four internal-vocabulary leaks reached customer screens (bucket codes in a
  tranche gate and a covenant title, a duplicated gate sentence, a classifier
  label rendering as the bare word "document").
- A handoff sent its one-time code to a mobile number fabricated from the
  application id.

### Known / open

1. **`APP-2901`, not `APP-2801`.** The build spec asks for 2801, but the bulk
   seed occupies APP-2701…**APP-2900**, so that id is taken. The start is
   computed from live state with a floor of 2801. Renumbering the bulk seed to
   free 2801 is the alternative and would change ~100 generated application ids
   — **awaiting a decision.**
2. **The RM surface is unauthenticated** in the prototype; `/rm` renders as a
   default officer. A sign-in flow exists at `/rm/signin` but nothing forces it.
3. **`data/consents.ts` models one consent per type** with a single `grantedBy`,
   so a co-applicant cannot grant their own Aadhaar eKYC. The projection handles
   this correctly, but the underlying model is a simplification worth raising
   with the BRD author.
4. **No persistence.** A page reload — including a Vite hot-reload after a source
   edit — resets all state.

[1.0.0]: https://github.com/nimishberiwal/eduloan-orchestrator/releases/tag/v1.0.0
