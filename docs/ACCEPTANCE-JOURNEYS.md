# Acceptance checklist — Glib.money origination journeys

**Re-walk after every change, in the browser, not by inspection.** The dashboard
checklist in `ACCEPTANCE.md` still applies unchanged and is item 1 here.

Everything below was verified against the dev server at `:5292`. Where a check
is programmatic, the exact expression is given so it can be re-run from the
console — `window.__glibmoney` mirrors `window.__eduloan` in dev.

---

## How to walk it

```bash
cd ~/Downloads/PythonProject/eduloan-orchestrator
npm run dev            # journeys at /, console at /console
```

Two dev surfaces do most of the work:

- **`/__dev/tasks`** — the projection inspector. Party isolation (item 7) and
  the headline reconciliation (item 8) are asserted there for all 14 curated
  applications at once, and go red if they ever stop holding.
- **The persona switch**, top right. Jumps between Student / Parent / Security
  owner / RM / Back office on the same application, and carries the
  "Links issued" tray — every invite and handoff link the prototype would have
  sent by SMS.

⚠ **The store is in-memory and has no persistence.** A full page reload — including
a Vite hot-reload after a source edit — resets everything. Walk each item without
editing source mid-walk.

---

## The 18 items

### 1. Build is clean and the console is untouched ✅

```bash
./node_modules/.bin/tsc --noEmit     # clean
npm run build                        # clean
```

`/console` renders the existing dashboard with all 14 original acceptance items
still green. The journeys mount alongside it; the dashboard keeps its
`tab`-in-store pattern and was not converted to routes.

### 2. Identify → OTP → resume, and the lock ✅

New mobile → code → session. Re-entry with the same mobile and party role
returns the **same** session object rather than a second one.

Five wrong codes:

> That is 5 wrong codes. For your security this number is locked for 15 minutes.

**A defect was found and fixed here.** The lock was originally held on the OTP
*challenge*, so "change my number" → re-enter the same number minted a fresh
challenge and walked straight past it — the copy was a lie. `issueOtp` now
returns the live locked challenge for that mobile + party role. Verified:

```js
const c2 = sessions.issueOtp({mobile:'+919876543210', partyRole:'applicant', …})
sessions.verifyOtp(c2.id, c2.code)
// → { ok:false, message:'This number is locked for 15 more minutes …' }
```

### 3. Eligibility — premier overlay vs unranked ✅

Stanford (global rank 6), ₹60,00,000 ask, US$90,000/yr COA, ₹10,00,000 own funds:

| | |
|---|---|
| Max eligible | **₹59,04,000** |
| Security needed | **No** — "Covered by the premier-university allowance" |

Hand-check against `data/policy.ts`, every number sourced from there:

```
coaInr        = 90,000 × 84 (POLICY.fxReference)        = ₹75,60,000
fundableNeed  = 75,60,000 − 10,00,000                   = ₹65,60,000
ceiling       = min(₹75L overlay Top-50, ₹1Cr cap)      = ₹75,00,000
maxEligible   = min(75,00,000, 65,60,000) × (1 − 0.10)  = ₹59,04,000 ✓
security      = tier3 AND ask 60L > ceiling 75L         = false ✓
```

The same ask on an unranked university falls back to the Tier-2 ceiling
(₹7,50,000) and returns **security required**. Both offers carry the word
**INDICATIVE** in body copy on the screen, once, not in a footnote or a modal.

### 4. A completed customer application reaches the back office ✅

Created through the journey, submitted by the customer, visible in the Kanban at
the correct stage with the correct owner and blocker.

> ⚠ **Deviation from the build spec, deliberate.** The spec says new applications
> start at **APP-2801**, "so they can collide with neither the curated 14 nor the
> bulk 27xx range". The bulk seed is not a 27xx range — `buildBulkSeed()`
> generates 200 applications from APP-2701, so it runs to **APP-2900**, and 2801
> is an existing seeded record. Creating a file there produced a duplicate id;
> the new application silently resolved to a REJECTED bulk record when moved
> forward, which is how it was caught.
>
> The floor stays at 2801 as the spec asks, but the effective start is computed
> from live state, so the first journey application is **APP-2901** and a future
> change to the bulk seed can never reintroduce the clash. See
> `journeys/newApplication.ts`.

### 5. Account Aggregator consent, granted by the co-applicant ✅

```
AA-sourced documents requested before:  4
after:                                  0   (all `fetched`)
tasks removed from the parent's list:    the AA consent task, exactly
audit lines written:                     1
```

> Priya Sharma (Co-applicant) — CONSENT GRANTED: Account Aggregator — banking
> — 4 documents auto-fetched from AccountAggregator

One line naming the consent, never one per document. Replaying the same event is
a no-op on the idempotency key.

**A defect was found and fixed here.** `emitJourneyEvent` dispatches to the
existing `grantConsent` verb, which audited as the console's current role — so a
consent granted by a parent on their own phone read as *"Admin (Admin)"*. The
four consent verbs now take an optional journey actor that changes the
**attribution only**; the mutation is byte-identical either way.

Through a handoff link the same line names both people, per §16.4:

> Priya Sharma (Co-applicant) — CONSENT GRANTED: Income Tax / TRACES —
> 3 documents auto-fetched from ITD-TRACES — **via a link issued by R. Iyer**

### 6. Declining DigiLocker produces uploads and blocks nothing ✅

```
DigiLocker documents:                     7
now sourcing = manual_upload:             7
documents inside upload tasks: 36 → 42    (they joined existing bucket tasks)
consent task still on the list:           no
application stage:                        unchanged, not terminal
```

The customer sees *"No problem — you can upload these yourself."*

### 7. No party ever sees another party's documents ✅

Asserted continuously at `/__dev/tasks`:

> Party isolation (acceptance item 7): clean across 14 application(s)

The check walks every task of every party on every application and fails if a
`docId` resolves to a section that party does not own. Enforced inside
`buildTasks` (rule 1), not in a component — which is why it is provable.

### 8. The CJ-15 header agrees with the dashboard's sourcing mix ✅

All 14 curated applications reconcile — `agrees? = yes` on every row:

| app | docs | collected | needs you | manual | consent |
|---|---|---|---|---|---|
| APP-2601 | 97 | 27 | 70 | 51 / 51 | 19 / 19 |
| APP-2604 | 116 | 90 | 26 | 22 / 22 | 4 / 4 |
| APP-2612 | 116 | 113 | 3 | 3 / 3 | 0 / 0 |
| … | | | | | |

The two columns in each pair are `collectedHeadline()` and
`lib/sourcing.sourcingMix()` — the projection and the dashboard analytic, derived
from one document list with no separate accounting.

The student's headline is deliberately **app-wide** (that is this number). The
co-applicant and collateral portals pass their own party, because "70 need you"
on a parent's screen when 60 of them belong to the student would be false and
would also disclose the size of the student's list.

### 9. A bad photo is rejected with a specific instruction; the retry works ✅

> Part of the page is outside the frame. Lay it flat and retake so all four
> corners are visible.

Both attempts are audited (`CAPTURE REJECTED`, then `DOCUMENT UPLOADED`).

**Tuned during the sweep.** The first pass rejected **~55%** of clean files, so a
customer retaking a photo was about as likely to be rejected again — the retry
path was not demonstrable. Now: **9.3%** of clean files (sampled over 400), and
retries after a failure succeeded 8/8. Filenames containing `blur`, `glare`,
`crop`, `dark` or `tiny` still fail deterministically, so the path can be
steered on demand.

### 10. A passport uploaded against the I-20 slot ✅

```
slot:      I-20 (USA F-1) with SEVIS ID
file read: PASSPORT (0.96)          → mismatch prompt
```

> This looks like a passport. We asked for your I-20. Use it for the passport
> instead?

Reassigning moves the upload and returns the I-20 slot to `requested`; both are
audited.

**A defect was found and fixed here.** `data/classification.ts` infers a label
from a document's *checklist name*, so run against the slot it could only ever
agree with itself and the mismatch prompt could never fire. `lib/capture.ts` now
classifies the **filename** through the same rules and falls back to the slot
when the filename is uninformative (`IMG_4471.jpg` → no false mismatch).
`classification.ts` itself is untouched, per the reuse map.

### 11. An ambiguous document goes to HITL without asking the customer ✅

```
slot: GRE Subject → GRE_SUBJECT_SCORECARD, confidence 0.61, ambiguous
```

Below `POLICY.lowConfidenceThreshold` the upload is **accepted**, flagged for a
human, and the customer is told only *"Received — someone will check this one."*
They are never asked to resolve a classifier ambiguity.

### 12. VAL-CRS-01 renders in plain language ✅

> **The name on your I-20 doesn't quite match your PAN**
> Your PAN says Kabir Singh; your I-20 says Kabir Sing. Universities sometimes
> truncate names. Upload a name-affidavit or a corrected I-20, or tell us this is
> the same person and we'll review it.
> `[ Upload document ] [ It's the same person ]`

Both values quoted, two actions. The rule ID `VAL-CRS-01` and the similarity
score `0.91` appear **nowhere** in the customer DOM — the internal message keeps
both, and the customer copy is a separate string in `lib/plainLanguage.ts`.

Any BLOCK failure without a `CUSTOMER_COPY` entry stays internal by default. A
dev-only console warning fires when one *looks* customer-fixable and has no
entry, so gaps surface during the build rather than in front of a customer.

### 13. An Ops send-back reaches the top of the customer's list ✅

```
Ops → sendBack(APP-2605, 'SB-01', 'S04', …)
top task: origin 'send_back', blocking, --warn treatment
```

> **The bank needs something looked at again**
> The copy we have isn't clear enough to read. A fresh photo in good light
> usually does it.

The reason code never renders. The mirror flips to *"Action needed: upload
pending documents"* — `customerFacingStatus` at S04 with `blocker.kind ===
'customer'`.

**A gap was found and fixed here.** `sendBack` changes stage, status and blocker
but does not necessarily reject a *named* document, so a projection watching only
document status produced **no task at all** for the single most urgent thing that
can happen to a file. The send-back itself is now a task source.

### 14. Customer submit runs the same forward gates ✅

With `VAL-EXT-01` forced to fail on an S03 file:

```
stage before: S03      stage after submit: S03      blocked: true
gate error toast shown to the customer: none
blocking tasks the customer sees instead: 10
```

The customer sees work to do, never a rule that failed. `moveForward` skips the
§5 **bank-role matrix** for a journey actor — a customer is not a bank role and is
by definition allowed to submit their own application — while `FORWARD_GATES`,
which is the policy table, is evaluated identically for both callers.

### 15. Every identity-bound control is visible, disabled, and offers a handoff ✅

On `/rm/apply/:id/handoff`, each outstanding act renders as:

```
Bank statement permission
The approval goes to Venkat's own mobile.
The Account Aggregator consent is bound to their mobile.
[ Do it here ]  ← disabled, title="Only the customer can do this"
[ Hand to Venkat ]
```

Never hidden — the officer has to see what is outstanding.

**No route reaches an Aadhaar, AA, e-sign or NACH screen from an assisted
session.** `/rm/apply/:id/*` resolves only to `summary`, `handoff` and `docs`.
The summary originally linked to `/apply/:id/tasks` ("see it as the customer
does"), which would have walked an officer straight into a consent screen; that
link is gone and the summary now shows a **read-only mirror** of the customer's
list instead.

> The persona switch can still jump to the Student persona. That is a dev/demo
> affordance gated on `import.meta.env.DEV || __DEMO__`, and it *changes session*
> rather than reaching a screen from within an assisted one.

### 16. A remote handoff authenticates, renders one act, and updates the RM ✅

The link lands in the "Links issued" tray. `/handoff/:token` requires the
party's **own** OTP when no live session exists, renders **only** that consent
with no navigation to the rest of the journey, and on completion emits
`HANDOFF_COMPLETED` plus the underlying `CONSENT_GRANTED`. The RM's screen shows
`Done`. The audit line names both people — see item 5.

### 17. An expired token dead-ends cleanly ✅

```
openHandoff(staleToken) → status 'expired'
```

> **This link has expired**
> In-branch links last 30 minutes. Ask your officer to start it again.
> Nothing has been lost. Your officer can send a fresh link and pick up exactly
> where you left off.
> `[ Ask your officer for a new link ]`

Not alarming: a stale link is an ordinary thing, not an incident.

### 18. Reset demo data clears everything ✅

```
before: apps 214 · handoffs 2 · links 2
after:  apps 214 · sessions 0 · leads 0 · handoffs 0 · invites 0
        links 0 · journeyEvents 0 · prequal 0 · offers 0
```

Every journey module-global counter (`_sessionSeq`, `_otpSeq`, `_inviteSeq`,
`_handoffSeq`, `_leadSeq`, `_linkSeq`, `_journeyAppSeq`) tears down through
`journeys/resetRegistry.ts`. The registry imports nothing, which is what lets
`appStore` call it without closing an import cycle back to `sessionStore` — and
it means the next module that adds a counter cannot forget to reset it.

---

## Defects found and fixed during this sweep

Recorded so they are not reintroduced.

| Defect | Why it happened | Fix |
|---|---|---|
| OTP lock was bypassable by re-entering the same number | The lock was on the challenge, not the number | `issueOtp` returns the live locked challenge for that mobile + party |
| The indicative offer silently computed from defaults | Pre-qual answers were passed in react-router state, and each `nav(…, {state})` replaces it | Answers live in `sessionStore.prequal`, keyed by application |
| APP-2801 collided with a seeded application | The bulk seed spans 2701–**2900**, not "27xx" | Start id computed from live state, floor 2801 |
| Consents audited as "Admin" | `emitJourneyEvent` dispatches to the existing verb, which uses the console role | Optional journey actor on the four consent verbs — attribution only |
| The mismatch prompt could never fire | The classifier read the slot's label, so it always agreed with itself | `classifyUpload` reads the filename, falls back to the slot |
| An Ops send-back produced no customer task | The projection watched document status only | The send-back itself is a task source |
| ~55% of clean photos rejected | Capture-mock scaling factors far too aggressive | Retuned to ~9%; retries succeed |
| Parent's screen showed the student's document count | The headline was app-wide on every surface | Party-scoped for the portals, app-wide for the student |
| S02 mirror said "complete your details" after submission | A customer journey can submit at S02; the stage alone no longer implies who holds the file | `customerMirror.ts` S02 now branches on the blocker |

### Second pass — screens built but never walked

The first sweep proved the 18 acceptance items. It did not exercise every
screen, and a second pass over the ones that had never been rendered found
eight more. All are fixed and re-verified.

| Defect | Why it happened | Fix |
|---|---|---|
| **The task-disappearance animation never ran.** §11.3 calls it "the moment that sells the product" | `TaskList` tracked outgoing ids in state but never passed `exiting` to a card, so tasks just vanished. It also kept only ids — by the time a task leaves the projection there is nothing left to render | Hold the outgoing `CustomerTask` objects, render them above the live list with `exiting`, key the effect on the id SET (the array identity changes every render). Outgoing cards are `aria-hidden` and untabbable while they fade |
| **"E10 Foreign banking verified"** shown to a customer | `plainGate` stripped rule ids but not bucket codes | Strip bucket codes too, and never fall through to a raw label — an unmapped gate says "A check the bank still has to complete" |
| **"Your stamped visa" listed twice** on the same instalment | Two internal gates translate to one customer sentence | Dedupe on the translated sentence, not the rule |
| **"Mortgage perfection (C4)"** on the sanction letter | Covenant titles render verbatim in the console by design, and the sanction screen used them directly | `COVENANT_COPY` in `plainLanguage.ts`, plus `plainClearBy` for "Tranche-1" → "before instalment 1" |
| **"We asked for your document"** on a classifier mismatch | The classifier vocabulary bottoms out at `GENERIC_UPLOAD`, which renders as the word "document" | Fall back to the checklist's own name for the slot, trimmed: "Form 60" |
| **The student's progress rail appeared on the portals** — "Step 1 of 6 · Your details" | `Tasks`, `SharingHub`, `VerifyIdentity` and the shared capture/consent hosts passed `liveRail(app)` unconditionally | The rail is applicant-only. It charts someone else's journey and discloses how far along they are |
| **A handoff sent its OTP to a fabricated mobile** derived from the application id | No contact lookup existed | `partyContact` resolves the invite that brought them onto the file, then any session they hold. With no number on file the button is disabled with an explanation — a code sent anywhere else proves nothing |
| Owner name and officerId disagreed on assisted-created files | The id came from the spec but the name was always P. Shah's | Resolve the officer once; name, id, department and branch all come from that record |

Two smaller ones: a consent revoked from a portal was attributed to the
`customer` surface, and React Router's two v7 future-flag warnings were left in
the console. Both fixed.

### Systematic check that replaced the one-screen-at-a-time hunt

The leaks above were found by eye, which does not scale. A scanner now walks
**28 customer-facing routes** — landing, the full customer journey, both
portals, and a handoff landing — and greps the rendered DOM for rule ids, stage
ids, bucket codes, terminal ids, SNAKE_CASE classifier labels, department
names, sourcing modes and lifecycle values:

```
checked: 28 · leaks: []
```

Re-run it from the console on any route to re-check §0.6 after a copy change.
