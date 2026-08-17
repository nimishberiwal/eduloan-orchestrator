# HANDOFF — Glib.money · Origination Journeys

**Paste this whole file into a new Claude session to hand off the journeys.** It
is written to be read cold: what the thing is, how it is built, why the
non-obvious parts are that way, and what is still open.

The code is NOT in this file. Point the new session at
`~/Downloads/PythonProject/eduloan-orchestrator`.

This is the **companion** to `HANDOFF.md`, which covers the back-office
dashboard in the same repo. Read that one first if you have not: this document
assumes the dashboard exists and does not restate it.

---

## 0. Read-me-first: rules that will save the next session

Nine rules. The first six come from the build spec; the last three were learned
the hard way during the build and cost real time to find.

1. **`src/data/*` is the single source of truth.** The journeys never define
   their own document list, validation list, consent list, stage list or policy
   numbers. If a journey needs something the catalogue does not express, extend
   the catalogue — never fork it. The reuse map in §18 of the build spec says
   which files are additive-only and which are frozen.
2. **`src/data/seed.ts`'s 14 literals stay untouched.** Same rule as the
   dashboard. Journey-created applications start at **APP-2901** — see rule 7.
3. **Journeys do not mutate application state directly.** They emit
   `JourneyEvent`s which reduce through the *existing* store verbs. Duplicating
   mutation logic is how the two surfaces start disagreeing.
4. **Time comes from `lib/clock.ts`.** Never `Date.now()`, never bare
   `new Date()`. The frozen clock is what makes OTP expiry, handoff validity,
   offer validity and sanction countdowns deterministic across both surfaces.
5. **The customer never sees internal vocabulary.** No stage IDs, no `VAL-*`
   codes, no bucket codes, no department names, no rule IDs, no SNAKE_CASE
   classifier labels. This is a hard rule and it has been violated four times
   already — see rule 8 for how to hold it.
6. **Verify, don't assert.** `window.__glibmoney` mirrors `window.__eduloan` in
   dev. Nine defects in the first sweep and ten more in the second were found
   only by walking the browser; every one of them typechecked and looked fine.
7. **APP-2801 is a seeded application. Do not use it.** The build spec says new
   applications start there "so they can collide with neither the curated 14 nor
   the bulk 27xx range". The bulk seed is *not* a 27xx range — `buildBulkSeed()`
   generates 200 applications from APP-2701 and therefore runs to **APP-2900**.
   The start id is computed from live state with a floor of 2801, so the first
   journey application is **APP-2901**. See `journeys/newApplication.ts`.
8. **Re-run the leak scanner after any copy change** (§7 below). Reading screens
   one at a time does not hold rule 5; a scanner over 28 routes does.
9. **The store is in-memory with no persistence.** A full page reload — *including
   a Vite hot-reload after a source edit* — wipes every session, invite, handoff
   and journey-created application. Do not edit source in the middle of a
   walkthrough and then wonder why the state vanished. This wasted an hour.

---

## 1. What it is

**Glib.money** is the origination front end that feeds the Horizon Bank
back-office dashboard. Four authenticated party types across four surfaces, one
shared engine.

| Surface | Who | Device | Route |
|---|---|---|---|
| Customer journey | The student (applicant) | Mobile-first | `/` |
| Co-applicant portal | The parent (credit spine) | Mobile-first | `/co/:token` |
| Collateral portal | Property/security owner (Tier-3 only) | Mobile-first | `/security/:token` |
| Assisted journey | Sales officer / RM | Tablet & desktop | `/rm` |
| *(existing)* Back office | Bank staff | Desktop | `/console` |

**Brand**: Glib.money is the platform; Horizon Bank is the lender and appears as
a co-brand lockup. Product is unchanged from the dashboard — Education Loan,
Abroad PG, **USA only**, ticket ≤ ₹1 Cr, student borrows, parent co-applicant is
the credit spine.

**The demo moment**: apply as a student → invite a parent → the parent grants
Account Aggregator consent on their own device → seven documents vanish from the
task list → switch to the console and find the file in the Ops queue with an
audit trail naming who did what.

### Three constraints that shaped every decision

- **An RM cannot grant a consent.** Aadhaar eKYC, AA, TRACES, GSTN, bureau,
  e-sign and NACH are identity-bound. The assisted journey therefore needed a
  **handoff primitive** (§5), not a "fill on behalf" checkbox.
- **The co-applicant grants 4 of the 7 consents**, so they need their own
  authenticated session — not a form section inside the student's application.
- **126 document templates exist; a customer must never see 126 rows.** The
  projection (§4) is what turns the catalogue into a short ordered task list.

---

## 2. Stack, commands, surfaces

Same stack as the dashboard, plus one dependency:

```
Vite 5 · React 18 · TypeScript (strict) · Tailwind v3 · Zustand v4
+ react-router-dom v6          ← NEW, journeys only
```

```bash
cd ~/Downloads/PythonProject/eduloan-orchestrator
npm install
npm run dev -- --port 5292          # launch config `glibmoney`
npm run build                       # tsc --noEmit, then vite build
node scripts/build-standalone.mjs   # → ~/Downloads/glibmoney-journeys.html
```

> The dashboard's own launch config `eduloan` runs on **:5290** and is often
> already up from another session. Use **:5292** for the journeys.

**Routing.** The journeys use real routes because deep links, resume, invite
links, handoff links and browser back are all load-bearing. **The dashboard keeps
its `tab`-in-store pattern unchanged** and mounts at `/console/*` as a single
route — `src/App.tsx` is byte-for-byte untouched.

```
/                     landing            /co/:token/*        co-applicant portal
/start  /otp          identify & verify  /security/:token/*  collateral portal
/apply                my applications    /rm/*               assisted journey
/apply/:appId/*       customer journey   /handoff/:token     handoff landing
/console/*            the dashboard      /__dev/tasks        projection inspector
```

**Three delivery surfaces**, as before. The standalone HTML needed two fixes the
dashboard did not: `BrowserRouter` cannot work over `file://` (it switches to
`HashRouter`), and `main.tsx` waits for `DOMContentLoaded` because
`vite-plugin-singlefile` inlines the script into `<head>` and an inline script
cannot be deferred. Both are documented in `scripts/build-standalone.mjs`.

---

## 3. File map

~11,200 new lines. Nothing existing moved.

### New pure modules — no React, no store
| File | Lines | Does |
|---|---|---|
| `lib/customerTasks.ts` | 554 | **The projection.** App state → ordered `CustomerTask[]` |
| `lib/capture.ts` | 317 | Deterministic quality checks, classification, extraction |
| `lib/plainLanguage.ts` | 282 | `VAL-*` / reason codes / covenants → customer copy |
| `lib/eligibility.ts` | 221 | Indicative offer from `data/policy.ts` bands |
| `lib/handoff.ts` | 136 | Identity-bound acts, token verification |

### New state
| File | Lines | Holds |
|---|---|---|
| `store/sessionStore.ts` | 684 | Sessions, OTP, invites, handoffs, leads, pre-qual, links tray |
| `types/journeys.ts` | 267 | Every new type. Additive — no existing type changed shape |
| `journeys/resetRegistry.ts` | 27 | Teardown registry. **Imports nothing** — that is the point |

### Surfaces
| File | Lines | Covers |
|---|---|---|
| `journeys/assisted/AssistedJourney.tsx` | 1020 | RM-01…RM-09 |
| `journeys/customer/Details.tsx` | 693 | CJ-08…CJ-12 |
| `journeys/common/ConsentFlow.tsx` | 681 | 3 full consent mocks + 4 sheets |
| `journeys/customer/PostSanction.tsx` | 596 | CJ-22…CJ-26 |
| `journeys/customer/PreQual.tsx` | 513 | CJ-04…CJ-07 |
| `journeys/common/glib.tsx` | 449 | Brand primitives |
| `journeys/common/DocFlows.tsx` | 440 | CJ-16…CJ-18, party-agnostic |
| `journeys/coapplicant/CoApplicantPortal.tsx` | 423 | CO-01…CO-08 |
| `journeys/collateral/CollateralPortal.tsx` | 366 | CP-01…CP-04 |
| `journeys/customer/Tasks.tsx` | 348 | CJ-13…CJ-15, CJ-21 |
| `journeys/customer/Track.tsx` | 335 | CJ-19, CJ-20, CJ-27 |
| `journeys/assisted/HandoffLanding.tsx` | 296 | `/handoff/:token` |
| `journeys/customer/CustomerJourney.tsx` | 259 | Router + capture/consent hosts |
| `journeys/copy.ts` | 250 | Customer vocabulary — buckets, consents, blockers |
| `journeys/dev/TaskInspector.tsx` | 218 | `/__dev/tasks` |
| `journeys/shell/*` | 436 | AppShell, BrandHeader, ProgressRail, PersonaSwitch |

### Existing files touched — all additive
| File | Change |
|---|---|
| `store/appStore.ts` | +8 verbs, `emitJourneyEvent`, journey actor on 4 consent verbs + `moveForward` |
| `types.ts` | `AuditEvent.role` widened to `AuditRole` (union extended, nothing narrowed) |
| `data/policy.ts` | §4.1 keys appended (OTP, offer, handoff, upload, capture thresholds) |
| `data/customerMirror.ts` | S02 branches on blocker — see §8 |
| `index.css` / `tailwind.config.js` | Glib tokens scoped under `.glib` |
| `main.tsx` | Router, font gate, `window.__glibmoney` |
| **`App.tsx`** | **untouched** |

### Docs
- `docs/ACCEPTANCE-JOURNEYS.md` — the 18 items, plus a table of all 19 defects
  found and fixed. **Re-walk it after every change.**
- `docs/API-CONTRACT.md` — the LOS contract. Documented, nothing implemented.
- `DECISIONS.md` — appended, not rewritten. The v4 sections are at the end.

---

## 4. The projection — `lib/customerTasks.ts`

The heart of the build. 22 buckets · 126 templates · 5 sourcing modes ·
7 consents · 73 validations → a short ordered list a person can finish.

```ts
buildTasks(app, forParty, now): CustomerTask[]
```

Six rules, in order:

1. **Filter by party.** `sectionsFor(role)` — the applicant owns `applicant` and
   `loan` (the borrower's form and declarations; the co-applicant countersigns
   rather than originates them).
2. **Filter by milestone.** `ASK_FROM_STAGE` — deliberately *one stage earlier*
   than the gate that blocks on it, because a customer asked for a document only
   at the blocking stage has no time to find it. A visa document still cannot
   appear at S04, which is the constraint the rule exists to enforce.
3. **Sourcing mode decides the interaction.** `consent_fetch` → **one task per
   consent artifact, not per document**. `manual_upload` → an upload task.
   `auto_fetch` / `bank_generated` / `internal` → **no task at all**; they are
   the bank's work and the header count says so.
4. **Collapse by bucket.** Never eleven rows for E3.
5. **Order**: send-backs → validation failures → blocking → non-blocking, then
   ascending `estSeconds` within a band (quick wins first).
6. **Never emit a task for a settled document.**

**Three task sources are easy to miss** if you only read the document loop:
a send-back (which may reject no *named* document — it sets stage, status and
blocker), a customer-fixable validation failure, and the milestone tasks
(invite a parent, accept the sanction, sign, set up repayment).

### The headline (§10.2)

> **We've already collected 34 of 41 documents for you.** 7 need you.

`collectedHeadline(app, forParty?)`. **App-wide for the student** — that is the
automation-ROI number, and it reconciles exactly against the dashboard's
`sourcingMix()`. **Party-scoped for the portals** — "70 need you" on a parent's
screen when 60 belong to the student would be false *and* would disclose the
size of the student's list.

`/__dev/tasks` asserts both the reconciliation and party isolation across all 14
curated applications on every render, and goes red if either stops holding.

---

## 5. The handoff primitive — the most important piece of the assisted journey

**The rule**: an RM may enter data, upload documents and progress a file. An RM
may **not** perform any act bound to the customer's identity. Attempting one
produces a **handoff**, not a form.

Every `HandoffReason` is identity-bound — that is what the type *is*. A consent
is an assertion by a specific person, and there is no such thing as granting one
on someone else's behalf.

- **In the on-behalf UI**, identity-bound controls are **present but disabled**,
  with an inline explanation and one primary action (`Hand to Priya`). Never
  hidden: the officer has to see what is outstanding.
- **Two modes**: `in_branch` (hand the device over, 30 min) and `remote_link`
  (their own phone, 24 h). Links land in the **"Links issued" tray** in the
  persona switch — no real SMS is sent.
- **`/handoff/:token`** verifies the token, requires the party's **own** OTP sent
  to their **real** number (from the invite that brought them onto the file),
  renders **only that one act** with no navigation to the rest of the journey,
  and dead-ends cleanly when expired.
- **Attribution**: an assisted entry is `kind: 'rm'` with `onBehalfOf`; a handoff
  is the **party's** actor kind with `viaHandoff`. The audit line names both:

  > Priya Sharma (Co-applicant) — CONSENT GRANTED: Income Tax / TRACES —
  > 3 documents auto-fetched — **via a link issued by R. Iyer**

**No route reaches an Aadhaar, AA, e-sign or NACH screen from an assisted
session.** `/rm/apply/:id/*` resolves only to `summary`, `handoff` and `docs`.
The summary shows a **read-only mirror** of the customer's list — it originally
linked into `/apply/:id/tasks`, which would have walked an officer straight into
a consent screen.

---

## 6. The event contract — `emitJourneyEvent`

```ts
emitJourneyEvent(e: JourneyEvent): void
```

**It dispatches to existing verbs. It holds no mutation logic of its own.** That
is what stops the two surfaces disagreeing. Where no verb existed (creating an
application, moving a document to `uploaded`, confirming extraction), a new
*verb* was added and the reducer dispatches to it.

Two hard constraints:

- **Gates apply identically.** A customer-initiated `APPLICATION_SUBMITTED` runs
  the same `FORWARD_GATES` evaluation as an Ops officer clicking move-forward.
  `moveForward` skips the §5 **role matrix** for a journey actor — that is a
  *bank-role permission table*, and a customer is not a bank role — but never the
  gates. When gating blocks a submit the customer sees the blocking task, not an
  error.
- **Idempotency.** Replayed events (double-tap, back-nav, handoff retry) are
  no-ops on matching `idempotencyKey`.

**Journey actor is an optional parameter that changes attribution only.** The
mutation is byte-identical with or without it. Without this, a consent granted by
a parent on their own phone audited as *"Admin (Admin)"*.

---

## 7. Holding the no-internal-vocabulary rule

Four separate leaks reached customer screens during the build: a bucket code in a
tranche gate (`E10 Foreign banking verified`), a bucket code in a covenant title
(`Mortgage perfection (C4)`), a duplicated gate sentence, and a classifier label
rendering as the bare word "document". Reading screens one at a time does not
hold this rule.

**Paste this into the browser console on any route** — it greps the rendered DOM:

```js
(function(){const t=document.body.innerText,h=[];
 const p=(n,re)=>{const m=t.match(re);if(m)h.push(n+': '+[...new Set(m)].slice(0,4).join(', '))};
 p('rule id',/\b(?:VAL|SB|REJ|DEV|COV|HLD|EXP|WD)-[A-Z]*-?\d+\b/g);
 p('stage id',/\bS(?:0[1-9]|1[0-3])\b/g);
 p('bucket code',/\b[EPCL]\d{1,2}(?:#\d+)?\b(?!\w)/g);
 p('terminal',/\b(?:DISBURSED_ACTIVE|REJECTED|WITHDRAWN|EXPIRED)\b/g);
 p('SNAKE_CASE',/\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/g);
 p('internal',/\b(?:Ops|Credit-Regional|Risk-Central|Compliance|maker-checker|FOIR|LTV|DoA)\b/g);
 p('mode',/\b(?:manual_upload|consent_fetch|auto_fetch|bank_generated|internal)\b/g);
 p('lifecycle',/\b(?:qc_pass|qc_fail|not_started|in_progress|pending_checker|sent_back)\b/g);
 return h})()
```

Last run: **28 customer routes, `leaks: []`.**

**Where the translations live.** Catalogue text renders verbatim in the console
by design — reviewers compare it against the BRD — so every customer translation
sits outside `src/data/*`:

| Internal | Customer copy lives in |
|---|---|
| `VAL-*` failures | `lib/plainLanguage.ts` → `CUSTOMER_COPY` |
| `SB-*` send-back codes | `lib/plainLanguage.ts` → `SEND_BACK_COPY` |
| `COV-*` covenant titles | `lib/plainLanguage.ts` → `COVENANT_COPY` |
| Bucket titles | `journeys/copy.ts` → `BUCKET_COPY` |
| Consent labels | `journeys/copy.ts` → `CONSENT_COPY` |
| Tranche gate labels, `clearBy` | `PostSanction.tsx` → `plainGate`, `plainClearBy` |
| Classifier labels | `lib/capture.ts` → `labelToWords` |

**A validation with no `CUSTOMER_COPY` entry is internal-only by default** —
that is the safe failure mode. A dev-only console warning fires when a
customer-fixable BLOCK has no entry.

---

## 8. Non-obvious decisions worth knowing before you change something

- **Pre-qual answers live in `sessionStore.prequal`, keyed by application.** They
  were originally threaded through react-router state; each `nav(path, {state})`
  *replaces* history state, so by the offer screen only the last screen's answers
  survived and the offer silently computed from defaults. It looked plausible,
  which is what made it dangerous.
- **The OTP lock belongs to the NUMBER, not the challenge.** It was on the
  challenge, so "change my number" → re-enter the same number minted a fresh one
  and walked past it. The copy said "this number is locked for 15 minutes" and
  was a lie.
- **`lib/capture.ts` classifies the FILENAME, not the slot.**
  `data/classification.ts` infers a label from a document's *checklist name* —
  its documented contract, and on the frozen list. Run against the slot it can
  only agree with itself, so the mismatch prompt could never fire.
  `classifyUpload` falls back to the slot when the filename is uninformative, so
  `IMG_4471.jpg` produces no false mismatch.
- **Capture thresholds were tuned by measurement**, not by feel. The first pass
  rejected ~55% of clean files, so a customer retaking a photo was about as
  likely to be rejected again. Now ~9% over a 400-sample run, and filenames
  containing `blur`, `glare`, `crop`, `dark` or `tiny` fail deterministically so
  a demo can be steered.
- **The progress rail is applicant-only.** It charts the *student's* journey
  ("Your details", "Decision", "Money out"). On a portal it is meaningless and
  discloses how far along someone else is.
- **`data/customerMirror.ts` S02 branches on the blocker.** A customer journey
  can *submit* at S02, so the stage alone no longer implies who holds the file.
  Fixed in the mirror, which fixes both surfaces at once.
- **The §11.3 task-disappearance animation holds the outgoing `CustomerTask`
  objects, not ids** — once a task leaves the projection there is nothing left to
  look up — and keys its effect on the id *set*, because the array identity
  changes every render. Outgoing cards are `aria-hidden` and untabbable while
  they fade.
- **Fonts**: two variable woff2 faces, latin subset, 77 kB raw, replacing the
  four static faces the spec budgeted at 180–240 kB. `BUILD_FONTS=none` skips the
  import and the system stack takes over — verified identical layout, which is
  what the standalone build ships.

---

## 9. Acceptance

`docs/ACCEPTANCE-JOURNEYS.md` — 18 items, all green, each with the evidence.
Two dev surfaces do most of the work:

- **`/__dev/tasks`** — party isolation (item 7) and headline reconciliation
  (item 8) asserted continuously across all 14 curated applications.
- **The persona switch** (top right, every surface including `/console`) — jumps
  between Student / Parent / Security owner / RM / Back office on the same
  application without re-authenticating, and carries the links tray.

Current state: **typecheck clean · production build clean · standalone 0.74 MB
self-contained · 28 customer routes leak-free · zero live console errors ·
reset returns exactly 214 applications**.

---

## 10. Open items awaiting the user's decision

1. **APP-2901 vs APP-2801.** The spec asks for 2801; that id is taken by the bulk
   seed (§0 rule 7). The current resolution computes the start from live state.
   The alternative is renumbering the bulk seed to free 2801, which changes ~100
   existing generated application ids. **Not done — this is the user's call.**
2. **`overused-font` design-hook finding on Inter.** Left as-is: build spec §3.2
   names Inter and Source Sans 3 explicitly and says not to invent alternates.
   A narrow ignore can be persisted if the hook noise is unwanted.
3. **The RM surface is unauthenticated in the prototype.** `/rm` renders as a
   default officer without sign-in, which is a demo convenience. The sign-in flow
   exists at `/rm/signin` but nothing forces it.
4. **A parent's Aadhaar sits behind the student's eKYC consent.**
   `data/consents.ts` models one consent per type with a single `grantedBy`, so
   the co-applicant cannot grant their own Aadhaar eKYC. The projection handles
   this correctly (it is not shown to them as an actionable task) but the
   underlying model is a simplification worth raising with the BRD author.

## 11. Deliberately not built

No backend, no persistence, no real integrations, no payment gateway, no real
SMS/email/WhatsApp (a dev tray holds every issued link), no vernacular
localisation, no post-disbursement servicing, no push notifications, no document
storage beyond in-memory references, no dark theme, and no non-US geography.
