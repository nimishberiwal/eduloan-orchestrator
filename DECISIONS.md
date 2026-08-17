# DECISIONS.md — smallest-sensible choices for unspecified details

This prototype was built verbatim from the Master Build Prompt. Where a detail
was genuinely unspecified, the smallest sensible choice was made and logged here
(per §0). Rule text, codes, and messages from §7/§10/§11 are rendered verbatim.

## Stack
- **React 18 + Tailwind v3** pinned exactly as the spec states (§1), even though
  sibling projects in this workspace run React 19 + Tailwind v4. Confirmed with
  the user. Zustand v4 (curried `create<T>()` form), recharts, lucide-react.
- **No router** — top-level tab navigation via a single `tab` field in the store.
- **Font**: system-ui stack (not Inter) — a neutral, distinctive, offline choice
  for a dense back-office tool; avoids a web-font network dependency.

## Prototype "now"
- The clock is **frozen at 2026-07-20** (`NOW_ISO` in `lib/format.ts`) so aging,
  TAT, and sanction-countdown values are deterministic across a session and match
  the seed's `daysInStage` figures exactly.

## DoA / Committee (§5)
- **Credit Committee** is simplified (as the spec permits) to: Central Risk
  records the decision + Admin countersigns. Reached when a Band-2 file has ≥1
  open deviation. Implemented in `lib/doa.ts`.

## Assumptions carried from the spec (kept at spec defaults)
- margin 10% of COA; FOIR ≤55% pass / 55–65% DEV-01 / >65% block (moratorium ≤65%);
  LTV Immovable 70 · FD 90 · LIC 85 · MF 50; processing fee 1% min ₹10,000;
  fx ₹84.00/USD fixed. All live in `data/policy.ts` for committee tweaking.

## Assignment
- **Round-robin** auto-assignment on forward-move is a single-officer-per-dept
  rotation (one named demo officer per department per §5), logged in the audit
  trail. Extendable to real pools without UI change.

## Validation seeding (§10)
- The 60 rules are **seeded as data, not computed** (per spec). Each app carries a
  per-rule status; rules triggered at stages *after* the app's current stage are
  seeded `pending`. Rules not applicable to an app's profile are treated as
  resolved by the gate evaluator. Toggling `endorsement_verified` (APP-2612)
  re-evaluates VAL-CRS-23 / VAL-EXT-18 and the tranche gates live.

## Extracted-data placeholders (§9)
- A **representative** set of §9 fields is seeded per party (richer on the
  acceptance-critical apps), with mismatches only where a §14 scenario calls for
  them. The full field taxonomy is documented in the types; the panel renders
  whatever is seeded, party-segregated, with ƒ badges on derived fields.

## Gate override
- Overriding an overridable gate is modelled as **raising a Deviation** (§4). The
  Move-forward modal surfaces failing gate items verbatim and points to the
  Raise-deviation control. S03 KYC and S08 AML gates expose **no override control
  in any role** (§6d).

## Terminal statuses
- Terminal apps (REJECTED / EXPIRED / WITHDRAWN / DISBURSED_ACTIVE) keep a
  `status` field for chip rendering; EXPIRED/REJECTED use `rejected` chip styling.

## Visual redesign (premium pass)
- Elevated the internal UI to a **product-register console** (Linear/Stripe-grade
  "earned familiarity"): a dark navy nav rail (`ink-*` palette) as the second
  neutral layer + light content surfaces, a cohesive token system (brand indigo,
  `--line`/surface vars, card shadows, radii, 150–250ms transitions), refined
  chips/buttons/tables with full state vocabulary, stage-accented Kanban columns,
  a segmented App-360 tab strip, and a custom role-switcher popover.
- **Removed `recharts`** — the only chart (rejection Pareto) is now a CSS bar list
  matching the funnel/FOIR gauges, so the whole Analytics view is dependency-free
  SVG/CSS. Bundle dropped ~677 kB → ~322 kB (gzip 192 kB → 93 kB). This diverges
  from §1's "Charts: recharts" line; noted here as a deliberate simplification.
- Light theme only (the navy rail carries the dark contrast); no theme toggle,
  consistent with a single-surface prototype.

## v2 (reviewer-feedback build)

- **Protecting the 14.** New `Application` fields are *required on the type,
  optional on `AppSpec`, defaulted inside `mkApp()`* — so the 14 hand-written
  acceptance literals were never edited. `buildSeed()` emits them first;
  generated IDs start at `APP-2701`.
- **Seed scale.** ~200 procedurally generated applications (mulberry32 PRNG,
  fixed seed) at *lite* fidelity: documents only for buckets gated at/before the
  current stage, validations only for already-triggered rules. Safe because
  `gating.isResolved()` treats a missing validation as resolved. Full reseed
  costs ~20 ms.
- **The SLA pauses on customer/third-party blockers.** Measuring bank-side
  responsiveness only. Without this rule ~70% of aged files read as breached and
  the escalation register would be meaningless; with it, roughly 2 of the 12 open
  curated files breach — and they are exactly the two the bank is sitting on.
- **Automation safety.** Non-destructive actions auto-apply; destructive ones
  (close/withdraw/reject) queue for approval. `matchRules()` hard-skips terminal
  stages so automation can never touch a closed file. A `firedKey` guard makes
  sweeps idempotent — without it a second sweep would re-send every nudge.
- **Frozen clock + operator offset.** `lib/clock.ts` owns "now". The offset is a
  module global, so `advanceClock` also bumps `clockTick` and views subscribe to
  it; otherwise the button would appear to do nothing.
- **Adding a co-applicant appends, never regenerates.** New parties get
  suffixed buckets (`P1#2`); regenerating the checklist would discard every
  verified document on the file. Verified against APP-2608: 96 verified docs
  before and after.
- **Reports export CSV with a UTF-8 BOM** (Excel mangles ₹ without it) and
  neutralise formula injection on `= + - @`.
- **`resetDemo()` now also clears** the automation log, approval queue, fired-rule
  keys, escalations, filters and clock offset, and resets three module-global
  counters (`RR_STATE`, `_docSeq`) that previously survived a reset.

## v3 (BRD alignment — BRD-18/19/20/21 + Document Checklist)

- **The document catalogue was reconciled to the checklist row-by-row, not
  overlaid.** The first v3 pass treated the checklist as *metadata* to hang on an
  existing catalogue — it added sourcing to every row and filled three obvious
  gaps, but kept the master prompt's **merged** rows. That left 113 dashboard
  rows against the checklist's 125 US-relevant ones. The merges were the whole
  problem: the checklist gives AACSB, ABET, ABA and LCME each their own row
  because they are different bodies with different lookups, and a single
  "programmatic accreditation" row cannot carry four sources or four classifier
  labels. Corrected by splitting every merged row and adopting the checklist's
  own wording — **126 rows now cover all 125** (the extra is the Premier-PG
  overlay documentation, separated from the lender approved-list row). Splits
  made: Form 60 · school transcripts · Class-12 migration certificate · one-time
  charges ×2 · the four named accreditors + a catch-all · lender list vs overlay
  doc · FD/LIC/MF/G-sec as four securities · foreign account vs forex card.
- **Splitting the accreditor rows fixed a live classifier defect.** With one
  merged row, `/Programmatic accreditation/` bound *everything* to
  `PROGRAMMATIC_ACCREDITATION_AACSB` and ABA/LCME fell through to
  `GENERIC_UPLOAD` — the BRD's four label constants were unreachable. Each body
  now has its own rule, and BRD-21's `reup-class` ambiguity ("certificate
  carries no accreditor identifier") correctly narrows to the catch-all row
  alone, which is what the BRD actually describes.
- **Document sourcing is derived, not declared twice.** Each of the 126 doc
  templates names only its `SourceSystem`; the sourcing mode and consent
  requirement come from `data/sources.ts`, so a source and its mode can never
  drift apart.
- **Three sourcing modes carry real operational meaning** — `auto_fetch` (public
  registry, a bank task), `consent_fetch` (needs a customer consent artifact),
  `manual_upload` (customer must provide) — plus `bank_generated` (panel vendors)
  and `internal` (policy tables). "Waiting on the customer" now distinguishes a
  missing *consent* from a missing *upload*.
- **Fetched ≠ verified.** A new `fetched` lifecycle state sits alongside
  `uploaded` at the same standing; fetched documents still pass QC and
  extraction, so forward gates behave exactly as before.
- **Rule IDs were NOT renumbered.** The dashboard keeps `VAL-*` ids (the
  acceptance checklist asserts two messages verbatim) and each rule carries a
  `brdRef` back to its BRD origin. The catalogue now covers **all 73 BRD rules**
  (23 V-INT + 27 V-CRS + 23 V-EXT) via 73 dashboard rules; 70 evaluate.
- **Known numbering collision in the source BRDs:** BRD-20 defines `V-EXT-13` as
  the parent ITR/26AS live match, while BRD-21 §6.3 lists `V-EXT-13` as
  credential-evaluation verification. Both are operationally required for abroad
  PG, so both are implemented and disambiguated in the traceability matrix as
  `V-EXT-13 (BRD-20)` and `V-EXT-13 (BRD-21)`. Worth resolving in the BRD.
- **Three rules are defined but do not evaluate** — `V-EXT-09` (CAS/UK),
  `V-EXT-10` (DLI/Canada), `V-EXT-11` (CRICOS/Australia) — because this build is
  USA-only. They appear in the traceability matrix marked out-of-scope so all 73
  are accounted for, rather than being silently dropped.
- **Consent progression tracks the journey**: identity consents (Aadhaar / CKYC /
  DigiLocker) are granted around KYC; the financial ones (AA / TRACES / GST /
  bureau) at credit analysis. A declined consent does not block the file — the
  affected documents fall back to `manual_upload`.
- **HITL cases are derived, not stored.** The queue is recomputed from live
  application state on every render, so it can never go stale against the file;
  only the officer's decision is persisted (keyed `appId|trigger`). A HITL case
  is distinct from a Deviation (a catalogued policy exception) and a Hold (parked
  awaiting an external event) — it means "a person must look at this".
- **`pending` is ambiguous in the rule model** and caused a real false positive:
  a validation reads `pending` both when its outcome is genuinely awaited *and*
  when the file simply has not reached its trigger stage. The credential-eval
  detector therefore gates on stage rank ≥ S07 before treating `pending` as a
  review case (this removed 6 spurious cases).
- **Policy corrected to the BRD**: moratorium is *course + 6–12 months* (EMI
  commences 18–30 months from sanction for 1–2 year PG programmes), margin is
  labelled *5–15% abroad, lender/country specific* with 10% applied, and the
  tier bands now carry their margin/collateral consequences.
- **Classification confidence is modelled, not randomised.** BRD-21's
  `reup-class` node names five genuinely ambiguous cases, and those are exactly
  the five the classifier flags: GRE-Subject vs GRE-General, non-NACES credential
  evaluation, programmatic certificate without an accreditor identifier, sponsor
  letter on individual letterhead, and non-English transcripts. A document is
  only classified once it has actually arrived — a `requested` document has no
  classification.
- **CAM derived analytics (BRD-21 §8.1)** are computed, not seeded:
  programmatic-accreditation strength (inferred from programme where the field is
  absent), post-study work outlook (STEM-OPT 36 mo vs OPT 12 mo, from the
  programme's STEM designation), sponsorship coverage as a share of programme
  cost, aggregate education-loan exposure, and pre-PG work experience. The CAM
  states explicitly that post-study work options are informational and not
  covenants, per the BRD.

---

# v4 — Glib.money origination journeys

The four customer-facing surfaces that sit *in front of* this dashboard and feed
it. Same repo, same store, same catalogues; nothing in `src/data/*` forked.

## Architecture

- **The journeys use a real router; the dashboard does not.** Deep links,
  resume, invite links, handoff links and browser back are all load-bearing on
  the customer side. The dashboard was built without a router deliberately and
  retrofitting one would touch every view for no gain, so it mounts at
  `/console/*` as a single route with its `tab`-in-store pattern intact.
- **`store/sessionStore.ts` is separate from `appStore`.** An application is one
  thing; the four authenticated parties looking at it are another. This is what
  makes a co-applicant's session genuinely theirs rather than a form section
  inside the student's — which is the whole reason the four consents they grant
  can be attributed to them.
- **`journeys/resetRegistry.ts` imports nothing.** `resetDemo()` must clear
  sessions, OTP challenges, leads, handoffs, invites, captures and every new
  module-global counter. A registry means `appStore` can tear the journeys down
  without importing `sessionStore` (which imports `appStore`'s verbs), and the
  next module that adds a counter cannot forget. The dashboard learned this
  lesson twice already with `_docSeq` and `RR_STATE`.
- **Pre-qualification answers live in `sessionStore`, not on the Application.**
  They are estimates typed before anything was evidenced; the Application is the
  bank's record. They were originally threaded through react-router state, which
  was wrong in a way that took a browser walk to catch: each `nav(path, {state})`
  *replaces* history state, so by the time the offer screen rendered only the
  last screen's answers survived and the offer silently computed from defaults.

## The event contract

- **`emitJourneyEvent` dispatches; it holds no mutation logic.** Every event
  reduces through an existing store verb, so the customer surface cannot drift
  from the back office. Where no verb existed (creating an application, moving a
  document to `uploaded`, confirming extraction), a new *verb* was added and the
  reducer dispatches to it — the logic lives in the verb, not in the reducer.
- **Journey actor is an optional parameter on the verbs it affects, and it
  changes attribution only.** A consent granted by a parent on their own phone
  must audit as theirs, not as the console operator's. Threading an actor
  through `grantConsent` / `declineConsent` / `revokeConsent` / `requestConsent`
  keeps one copy of the mutation and one copy of the audit call.
- **`moveForward` skips the §5 role matrix for a journey actor, and never the
  gates.** The role matrix is a *bank-role permission table*; a customer is not a
  bank role and is by definition allowed to submit their own application.
  `FORWARD_GATES` is a *policy table* and is evaluated identically for both
  callers — the journey must not be a side door. When gating blocks a customer
  submit, no error is raised: the customer sees the blocking task.
- **`AuditEvent.role` widened additively** to `RoleId | 'Applicant' |
  'Co-applicant' | 'Collateral provider' | 'System'`. Only the Audit tab reads
  the field, and only as display text, so the 14 seed literals compile untouched.

## The projection

- **`lib/customerTasks.ts` is pure and is proved before it is dressed.**
  `/__dev/tasks` asserts party isolation and the headline-vs-sourcing-mix
  reconciliation across all 14 curated applications on every render, and goes red
  if either stops holding. A number that agrees only by eye does not agree.
- **The customer is asked one stage EARLIER than the gate that blocks on it.**
  `kyc` documents from S02, the `sanction` checklist from S03. A customer asked
  for a document only at the stage that blocks on it has no time to find it. The
  constraint the rule exists to enforce — a visa document cannot appear during
  S04 — still holds.
- **Loan-level documents (L1, L2) belong to the APPLICANT.** They are the
  borrower's form and the borrower's declarations; the co-applicant countersigns
  rather than originates them. Putting them on the parent would show a parent
  tasks about their child's LRS declaration.
- **The headline is app-wide for the student and party-scoped for the portals.**
  The student's file is the whole file, and that is the number the acceptance
  checklist reconciles against the dashboard's sourcing-mix analytic. On a
  parent's screen the same number would be false *and* would disclose how big
  the student's list is.
- **A send-back is a task source in its own right.** `sendBack` moves the stage
  and sets a blocker but does not necessarily reject a *named* document, so a
  projection watching only document status produced no task at all for the single
  most urgent thing that can happen to a file.

## Handoff

- **Every `HandoffReason` is identity-bound — that is what the type is.** A
  consent is an assertion by a specific person and there is no such thing as
  granting one on someone else's behalf, which is exactly why the assisted
  journey needs a handoff primitive rather than a "fill on behalf" checkbox.
- **Identity-bound controls are rendered and disabled, never hidden.** The
  officer needs to see what is outstanding; hiding it would make the file look
  finished when it is not.
- **The RM file summary shows a read-only mirror of the customer's list.** It
  originally linked into `/apply/:id/tasks`, which would have walked an officer
  straight into a consent screen from an assisted session.

## Brand

- **Two variable woff2 faces, latin subset, 77 kB raw** — Inter and Source Sans
  3 — replacing the four static faces the spec budgeted at 180–240 kB. The
  variable files cover all four weights used. `BUILD_FONTS=none` skips the import
  entirely and the system stack takes over; the CSS custom properties declare it
  as the fallback, so a font failure degrades rather than blanks.
- **The crossing motif appears in exactly one place**, the Progress Rail
  connector, where it also carries state: the crossing tightens from an open X to
  a near-flat seam as a step completes. A second use would make it wallpaper.
  The diamond clip mask is the one other permitted use, on RM avatars.
- **Glib tokens are scoped under `.glib`** so the console keeps its own visual
  language untouched. The journeys never restyle the dashboard.

## Deviations from the build spec

- **New applications start above the seed, not at APP-2801.** The spec's premise
  ("the bulk 27xx range") is wrong: `buildBulkSeed()` generates 200 applications
  from APP-2701 and therefore runs to **APP-2900**. APP-2801 is an existing
  seeded record, and creating a journey file there produced a duplicate id — the
  new application resolved to a REJECTED bulk record when moved forward. The
  floor stays at 2801 as asked, but the effective start is computed from live
  state, so the first journey application is **APP-2901**. Computing it rather
  than hardcoding means a change to the bulk seed size can never reintroduce it.
- **The capture mock's thresholds were tuned after measurement.** The first pass
  rejected roughly half of all clean files, which made the retry path
  undemonstrable — a customer retaking a photo was as likely to be rejected
  again. Now ~9% of clean files, with filename keywords (`blur`, `glare`, `crop`,
  `dark`, `tiny`) forcing deterministic failure so a demo can be steered.
- **`lib/capture.ts` classifies the FILENAME, not the slot.**
  `data/classification.ts` infers a label from a document's checklist name —
  its documented contract, and on the do-not-change list. Run against the slot it
  can only agree with itself, so the mismatch path could never fire.
  `classifyUpload` reads the filename through the same rules and falls back to
  the slot when the filename is uninformative. `classification.ts` is untouched.
- **`data/customerMirror.ts` S02 now branches on the blocker.** A customer
  journey can *submit* at S02, so the stage alone no longer implies the file is
  still in the customer's hands. Fixed in the mirror, which fixes both surfaces.

## v4 second pass — screens built but never walked

The first sweep proved the 18 acceptance items but did not render every screen.
Walking the rest found eight more defects. Two are worth recording as rules
rather than fixes:

- **A projection change needs a UI change to be visible, and the two were not
  checked together.** `TaskList` computed the outgoing task ids correctly and
  never passed them to a card, so the §11.3 disappearance animation — the one
  moment the spec singles out as selling the product — was dead code that
  typechecked, rendered and looked fine. The list now holds the outgoing
  `CustomerTask` objects (ids alone are not enough: once a task leaves the
  projection there is nothing left to render) and keys the effect on the id SET,
  because the array identity changes every render.
- **§0.6 cannot be enforced by reading screens one at a time.** Four separate
  leaks reached customer surfaces — a bucket code in a tranche gate, a bucket
  code in a covenant title, a duplicated gate sentence, and a classifier label
  that renders as the bare word "document". A scanner now walks 28 customer
  routes and greps the rendered DOM for rule ids, stage ids, bucket codes,
  terminal ids, SNAKE_CASE labels, department names, sourcing modes and
  lifecycle values. It is the only honest way to hold that rule.

Related: covenant titles and tranche gate labels render VERBATIM in the console
by design, so their customer translations live in `lib/plainLanguage.ts`
(`COVENANT_COPY`) and `PostSanction.tsx` (`plainGate`, `plainClearBy`) rather
than in the catalogues.

Two more, both about not showing a party someone else's context: the progress
rail charts the STUDENT's journey and is now applicant-only (it was appearing on
both portals, disclosing how far along the student was), and a handoff now sends
its one-time code to the party's real number from the invite that brought them
onto the file — it previously synthesised one from the application id, which
would have let whoever held the link verify as them.
