# Handoff — v2 "agentic origination" (WORK IN PROGRESS, UNCOMMITTED)

**Written:** 2026-08-17
**Status:** **`v1.1.0` was cut and pushed on 2026-08-17** — `origin/main` is at
`8eb6d35`, tag `v1.1.0`. It is a **checkpoint** release: the corpus and all of
Phase E, plus the Phase A/B/C-core snapshot at `1c60aaa`. The Phase B session's
later work was uncommitted and **not compiling** when the version was cut, so it
is deliberately **not** in v1.1.0 — it remains in the working tree for that
session to commit and ship in the next version. v2 items 4 and 5 are not started.
⚠️ **The GitHub Release is still outstanding** — GitHub's Releases API was
returning 503 at the time. The tag and CHANGELOG are done; see §10.
**Companion docs:** `HANDOFF-JOURNEYS.md` (v1, complete) · `docs/RELEASING.md` · `docs/API-CONTRACT.md` · `docs/ACCEPTANCE-JOURNEYS.md`
**Design plan:** `~/.claude/plans/moving-on-to-the-precious-hoare.md` — the full approved design for all six v2 items. Read it before continuing.

---

## 0. Orientation

| | |
|---|---|
| Repo | `~/Downloads/PythonProject/eduloan-orchestrator` |
| GitHub | `nimishberiwal/eduloan-orchestrator` (**private**) |
| Stack | Vite 5 · React 18 · TypeScript strict · Tailwind v3 · Zustand v4 · react-router-dom v6 |
| Run | launch config `glibmoney` → port **5292** (journeys) · `eduloan` → **5290** (dashboard) |
| Network calls | **zero, by design.** The standalone HTML build must work offline. |

### URLs

| Surface | Path |
|---|---|
| Customer journey | `/apply` |
| Assisted (RM) journey | `/assisted` |
| Bank dashboard (App-360) | `/` |
| Task projection harness | `/__dev/tasks` |
| **Agent harness (new)** | `/__dev/agents` |

---

## 1. Where things stand

### v1.0.0 — shipped, tagged, pushed

The Glib.money origination journeys: four customer-facing surfaces in front of the
existing Horizon Bank EduLoan Orchestrator. 48 screens, eligibility engine,
consent mocks, handoff primitive, document capture/classification/extraction,
tracker with send-back loop, sanction → disbursement, co-applicant and collateral
portals. 19 defects found and fixed across two sweeps. Fully documented.

### v2 — partially built, **uncommitted**

Six requested developments. Progress:

| # | Development | State |
|---|---|---|
| 1 | Upload-instead-of-typing + parallel-agent processing view | **Built and wired into all 6 screens** |
| 2 | Three agents per upload (extraction · fraud · validation) | **Built and verified** |
| 3 | Skip → self-declared → post-decision mandatory upload w/ cross-validation | **Built and verified** (CJ-28 + derived tranche-1 gate) |
| 4 | Sanction-time CAM + letter + extras by parallel agents | **Not started** |
| 5 | Pre-sanction customer message drafting agent | **Not started** |
| 6 | University news crawler agent with source links | **Built and verified** (Phase E — see §7) |

---

## 2. The idea everything rests on

> **Timing is theatre; results are deterministic.**

`lib/capture.ts` already established this — quality scores come from a hash of the
filename, so a demo repeats exactly. The agent runtime follows the same rule:

- Every agent's **findings** are a pure function of `(application, document, capture)`.
- Every agent's **duration** is a staggered, hash-derived delay whose only job is to
  make parallel work visible.

Findings are computed **synchronously and completely, up front**. Only the *reveal*
is on a timer. This is why `/__dev/agents` can assert determinism by running each
swarm twice and diffing the JSON.

This runtime is the **first async machinery in the entire codebase** — there was no
interval, no polling, no progress state anywhere before it. It is therefore
deliberately confined to ephemeral UI state that can never desynchronise the
application record.

---

## 3. Invariants — do not break these

1. **Fraud findings are bank-only.** A customer must never read "fraud check:
   suspicious" about themselves. Enforced in the *type system*, not a comment:
   `FindingAudience = 'customer' | 'bank'`, and every finding in `runFraud` is
   `'bank'`. The fraud **lane is visible** to the customer (they see work happening)
   but the **verdict is private** — they get the neutral `customerSummary`.
2. **Agents propose; they never silently overwrite.** Extracted values land in the
   form prefilled and *editable*. The value recorded at submit is always what is on
   screen, never what the agent proposed.
3. **No internal vocabulary reaches a customer** — no rule IDs, stage IDs, bucket
   codes, department names. (§0.6 of the original spec; a 28-route scanner enforces it.)
4. **`src/data/seed.ts`'s 14 literals must never be edited.** Every new field on a
   persisted type must be **optional** so the seed still compiles.
5. **Anything on `Application` must be clone-safe** — `mutate()` uses `structuredClone`.
6. **No network calls.** Anywhere.
7. **Every push needs a semver tag + CHANGELOG entry + GitHub Release.** Procedure in
   `docs/RELEASING.md`. Non-negotiable, per standing instruction.
8. **Do not commit v2 until explicitly approved.**

---

## 4. What was built (Phase A + B + C-core)

### New files — all uncommitted

| Lines | File | What |
|---:|---|---|
| 109 | `src/lib/agents/types.ts` | `AgentId`, `SwarmKind`, `LaneStatus`, `FindingLevel`, **`FindingAudience`**, `AgentFinding`, `AgentTask`, `AgentRunPlan`, `AgentResult(s)`, `LaneState`, `AgentRunState` |
| 134 | `src/lib/agents/registry.ts` | 11 agents: `{id, name, what, swarm, weight, internal?}`. `isInternalAgent()` hides CAM/risk-note/university lanes from customers. Fraud is deliberately **not** internal. |
| 238 | `src/lib/agents/runtime.ts` | `hash` (FNV-1a), `draw`, `durationFor`, **`enforceStagger`**, `planRun`, `runDuration`, `finding`, `result`, `findingsFor`, `hasBlocking`, `customerSummary`, per-agent `STEPS` |
| 297 | `src/lib/agents/documents.ts` | The three document agents + `DOC_VALIDATIONS` + `extractionContext` + `runDocumentSwarm` + `fieldsFromRun` |
| 229 | `src/store/agentStore.ts` | The **only** timer-driven state in the codebase. rAF + wall-clock settle. Registered with `registerJourneyReset`. |
| 143 | `src/journeys/common/AgentSwarm.tsx` | Per-lane progress bars, streaming step lines, `audience` filter, reduced-motion path |
| 217 | `src/journeys/common/SmartFill.tsx` | Four phases: `offer` / `running` / `filled` / `skipped`. Quality gate runs **before** the agents. |
| 197 | `src/lib/declared.ts` | `DeclarationSpec`, `valuesAgree`, `declareSelfReported`, `declareEvidenced`, `mergeFields`, `pendingDeclarations`, `discrepancies`, `declarationsSettled` |
| 88 | `src/journeys/useDeclaration.ts` | Shared hook every detail screen uses |
| 268 | `src/journeys/dev/AgentInspector.tsx` | `/__dev/agents` — asserts determinism + parallelism; "customer sees / bank sees" columns make a fraud leak visible |

### Modified files

| File | Change |
|---|---|
| `src/types.ts` | Two **optional** fields on `ExtractedField`: `selfDeclared?: boolean`, `backingDocIds?: string[]` |
| `src/store/appStore.ts` | New verb `recordDeclaredFields(appId, fields, actor, note?)` → `DETAILS DECLARED` / `DETAILS EVIDENCED` audit lines |
| `src/lib/capture.ts` | Scorecard `EXTRACTION_SHAPES` (GRE/GMAT/LSAT/IELTS-TOEFL); `awardYear` + `backlogs` on the marksheet shape; new `ExtractionContext` interface |
| `src/journeys/customer/Details.tsx` | `Academics` (CJ-09) fully wired |
| `src/routes.tsx` | `/__dev/agents` route |

### The key insight that saved a lot of work

`ExtractedField` **already had exactly the right shape** for cross-validation:

```
enteredValue    what the customer typed
extractedValue  what we read off the document
match           whether they agree
```

…and the App-360 Extracted-data tab **already renders both sides**. So Phase C
needed no new model and almost no console work — a typed value is just an
`ExtractedField` with `selfDeclared: true` and `match: 'pending'`.

---

## 5. Verified behaviour

Both paths confirmed live on `Academics` (CJ-09), APP-2901 / APP-2903:

**Evidenced path** — upload `ug-marksheet.jpg` → swarm → submit:

```
Institution: entered "Veermata Jijabai Technologic", read "Veermata Jijabai Technologic", match "pass"
Result:      entered "8.4 CGPA",  read "8.4 CGPA",  match "pass"
Year:        entered "2025",      read "2025",      match "pass"
Backlogs:    entered "0",         read "0",         match "pass"
```
All four `selfDeclared: false`.

**Skip path** — "I'll type it myself" → IIT Bombay / 9.1 CGPA / 2024 → submit:

All four `match: "pending"`, `selfDeclared: true`, `backingDocIds` populated, audit line:
```
ACADEMICS SUBMITTED — IIT Bombay · 9.1 CGPA · 0 backlog(s) · self-declared
```

This also closed a **real pre-existing gap**: `Academics` previously persisted
**nothing at all** — values lived only inside an audit remark.

`tsc --noEmit` clean · `npm run build` clean (4.12s).

### Phase B completion — APP-2901, all five remaining screens

Walked end to end. App-360 → Extracted data reads:

```
APPLICANT
  Cost of Attendance (E6)  cost per year   US$62,400 / US$62,400   pass   evidenced
  Identity (E1)            full name       Ananya Rao / Ananya Rao pass   evidenced
                           date of birth   14-08-2002 / 14-08-2002 pass   evidenced
                           PAN             ABCDE1234F / ABCDE1234F pass   evidenced
  Academic (E3)            4 fields        typed, no reading       pending self-declared
  Admission (E5)           SEVIS ID        N0031882745 / same      pass   evidenced
CO-APPLICANT
  Income — salaried (P2)   monthly income  ₹2,11,400 / ₹2,11,400   pass   evidenced
  Identity & relationship (P1) full name   Rajesh Rao, no reading  pending self-declared
```

E1 and P1 both carry a "PAN" document and land in the right sections — that is
the bucket-scoping fix working. Prefill proven by setting a field to a wrong
value first and watching the swarm overwrite it (COA 50000 → 62400, income
90000 → 211400).

---

## 6. Defects found and fixed during v2

| # | Defect | Fix |
|---|---|---|
| 1 | **3 of 14 swarms finished within 200ms** (spread as low as 49ms) — reads as one task with three labels, not parallel agents. ±420ms jitter swamped the 217ms weight gap. | Structural: `enforceStagger()` + `MIN_STAGGER_MS=320`. Preserves jittered *order*, widens only the gaps. Min spread now 640ms. Caught by `/__dev/agents`. |
| 2 | `setInterval` **throttles to ~1s in a background tab**, collapsing the stagger. | Switched to `requestAnimationFrame`. |
| 3 | But rAF **pauses entirely when hidden** — so an upload would never register if the customer switched tabs. | Added a `setTimeout` settle guarantee. rAF drives visuals; wall-clock guarantees the outcome. Verified: `onComplete` fired at 2758ms against a 2467ms longest lane with the pane hidden. |
| 4 | **`fromKey` namespace mismatch** — form keys (`ug_institution`) vs extraction keys (`institution`). `declareEvidenced` looked up the wrong key, so **every evidenced field was written with an empty reading and left `pending`**. Cross-validation silently never matched. | Added `fromKey?: string` to `DeclarationSpec['fields']`. **This is the trap when wiring the remaining five screens.** |
| 5 | Extraction returned the literal placeholder `'as printed'`. | Added `ExtractionContext` carrying real student/university/programme. |
| 6 | `institution` defaulted to `ctx.university` — so a Purdue applicant's UG degree read "Purdue University". | `institution` is the *undergraduate* institution, deliberately **not** the destination university. |
| 7 | Rules-of-hooks violation in `SmartFill` (early `return null` before `useMemo`). | All hooks run unconditionally; guard moved below. |
| 8 | TS7053 indexing `Record<AgentId, AgentDef>` with `string`. | Typed `durations` as `{agent: AgentId; ms: number}[]`. |
| 9 | **A co-applicant's PAN prefilled the STUDENT's name.** `extractionContext(app)` had no idea whose document it was building context for, so `contextual.name` was always the applicant. Defect #6 in a new place. | `extractionContext(app, doc)` resolves the owning party from the document's bucket section. Where that party hasn't joined there is no name to read, so it falls back to the placeholder and the screen skips the prefill. |
| 10 | **The same fix in one place only.** `runExtraction` built its own `extractionContext(app)` — and *that* is what feeds `fieldsFromRun`, so the form kept prefilling the wrong name after #9 was fixed. Two call sites, one fixed. | Passed `doc` at both. Caught only by walking the screen, not by `tsc`. |
| 11 | **CJ-11 recorded a false discrepancy:** entered "Rajesh Rao", read `"as printed"`, `match: 'fail'`. The reader's own placeholder was compared as if it were a reading. | `declared.ts` treats `as printed` / `—` as no reading. A field the document didn't evidence now goes back to `selfDeclared: true, match: 'pending'` so it stays owed for CJ-28, instead of `selfDeclared: false` where `pendingDeclarations` silently dropped it. |
| 12 | **`ConfirmDetails` showed customers the placeholder.** Defect #5's `ExtractionContext` fix was applied in `SmartFill` only, so the ORIGINAL upload path — the one most documents take — still rendered "Name: as printed" on the confirm screen. | Passed `extractionContext(app, doc)` at both `extractFields` call sites in `DocFlows`. A fix that lands in the new path and not the old one is not a fix. |
| 13 | **The validation agent's output was discarded.** `runValidation` built real `ValidationResult`s off the real catalogue and nothing consumed `ValidationOutput` — so nothing the swarm found reached the Validations tab or `evaluateGate`, and `hasBlocking` was dead code. | `recordAgentFindings` persists them and `hasBlocking` picks the audit verb. See §7's closeout. |
| 14 | **A 1% tolerance passed a wrong graduation year.** `valuesAgree` applied a proportional tolerance to every number, for one stated reason — a customer rounding 8.43 to 8.4. On a year that is ±20 years of slack, so entered "2024" against a marksheet reading 2025 came back `pass`. A different graduation year is exactly what an officer checks for gaps and course duration. | The tolerance now applies ONLY where one side is fractional; whole numbers compare exactly. A proportional tolerance is wrong for a quantity that is a label rather than a measurement. Nine cases re-checked: year fails, 8.43/8.4 still passes, money/DOB/prefix behaviour unchanged. Surfaced by CJ-28 — the first screen that re-checks a year against its document. |
| 15 | **`discrepancies()` swept in pre-existing seeded mismatches.** It filtered `app.extracted` for any `match === 'fail'`, but the seed carries seven such fields (an I-20 name mismatch, a COA arithmetic delta, a bureau flag) that are console-side validation failures with their own rules and gates. Wiring the disbursement gate to it would have let one of those hold up a demo file through a gate about self-declared facts — **APP-2612, the only seeded application with tranches, carries one.** | Scoped to declaration-flow fields via `declarationFields()` (`backingDocIds` is set by both builders and nothing else). Verified: four seeded apps carry failed extracted fields and all four report `settled: true`. |

---

## 7. Next steps, in order

### Phase B remainder — 5 screens — **DONE**

All five wired and walked live end to end on APP-2901. Verified state below.

| Screen | Backing document | Bucket | Declares |
|---|---|---|---|
| CJ-08 Profile | `PAN` | E1 | name · dob · PAN |
| CJ-10 Admission | `I-20 (USA F-1) with SEVIS ID` | E5 | SEVIS ID |
| CJ-05 Cost | `University COA per academic year` | E6 | cost per year — **evidenced only** |
| CJ-06 Parent snapshot | `3 payslips` | P2 | monthly income — **evidenced only** |
| CJ-11 Add parent | `PAN` (co-applicant) | P1 | parent's name |

Three decisions worth knowing before extending this:

1. **`backingBucket` is now required wherever the label repeats.** "PAN" is a
   document in BOTH E1 and P1, and `SmartFill`'s "first match wins" handed the
   parent's screen the student's PAN. `SmartFillProps.bucket` and
   `DeclarationSpec.backingBucket` scope the lookup. Same silent-mis-lookup
   family as `fromKey` — nothing errors, the wrong paper is simply recorded.
2. **CJ-05 and CJ-06 commit only when evidenced.** Both screens invite an
   estimate in their own intro copy ("estimates are fine for now", "rough
   figures are fine"). A self-declared field becomes a condition of
   disbursement once the Phase C gate lands, and a 1% tolerance against the real
   COA would turn an invited guess into a payment blocker. A figure actually
   read off the document is a fact and is kept.
3. **Only fields the backing document can evidence are declared.** CJ-08's
   address is on the Aadhaar, not the PAN; CJ-10's test scores are on the
   scorecards, not the I-20; CJ-11's relationship is on the relationship proof.
   Declaring those would create obligations CJ-28 could never discharge.

Point 3 above no longer holds for CJ-10's scores — see the closeout below.

### Phase A + B closeout — five loose ends, all closed

A sweep for "built but not wired" found five. All five are now done and walked
live on APP-2901.

1. **Scorecard `SmartFill` on CJ-10.** The Phase A scorecard shapes had no
   consumer. CJ-10 now offers two more cards inside the Test scores section:
   the entrance report chosen by programme (`entranceDocFor` — GRE for MS/MA/PhD,
   GMAT for MBA/Mgmt, LSAT for JD, following E4's own conditionality) and the
   IELTS/TOEFL report. A second `useDeclaration` on `Entrance & language (E4)`
   records the scores, which previously lived only in an audit remark — the same
   gap `Academics` had. Whichever report is uploaded *last* is the evidence
   source; scores it did not carry stay `pending` and owed, which is the safe
   direction.
2. **The three-agent swarm now runs on ordinary checklist uploads.** `SmartFill`
   only ever covered six screens; `DocFlows.Capture` — where most of a file's
   97 documents actually arrive — ran the bare `runCapture` path. It now shows
   the same three lanes. Hooks sit above the `if (!doc)` guard, per defect #7.
3. **`ConfirmDetails` no longer shows customers `"as printed"`.** Its two
   `extractFields` calls had no `ExtractionContext` — defect #5's fix landed in
   `SmartFill` and never reached the older path. A passport upload now reads
   "Name: Ananya Rao".
4. **The validation agent's results are persisted.** New store verb
   `recordAgentFindings(appId, docId, results, actor)` merges the agent's
   `ValidationResult[]` into `app.validations`. That array is what
   `evaluateGate` reads, so a rule the agent fails genuinely holds the file —
   verified: a passport upload failed `VAL-INT-04`, which sits in the **S03**
   forward gate marked `nonOverridable`.
5. **`hasBlocking` has a consumer.** It selects the audit verb, so a
   BLOCK-severity finding does not read like a warning:
   `AGENT CHECKS — BLOCKING — Passport … 3 validation(s) recorded, 1 failed ·
   A PERSON MUST LOOK BEFORE THIS FILE MOVES`.

**Still not surfaced:** `FraudOutput`'s score and signals are counted in the
audit line but have nowhere to live on the application. That is Phase F's
"agent findings on the Integrations and HITL views", not a gap here.

### Phase C — **DONE**, walked live on APP-2901

`src/journeys/customer/VerifyDeclared.tsx` at `/apply/:id/verify`, plus the gate.

**Two lists, and they are not the same problem.** *Still to send* is typed-but-
unevidenced and an upload resolves it. *Doesn't match* is a contradiction an
upload will not fix — a person has to decide which value is right. The screen
never rewrites `enteredValue`: it is the thing being verified, and a step that
quietly corrects its own subject is worth nothing to the officer reading it.

**The gate is DERIVED, not stored.** `gatesFor(app, tranche)` appends
`declarationGate(app)` to tranche 1. Two reasons: journey applications are
created with `tranches: []` and nothing ever fills them, so there is no creation
point to attach a stored gate to; and a stored copy of a boolean recomputable
from `app.extracted` is a copy that can go stale against it. Read at all three
sites that matter — CJ-26, `releaseTranche`, and the console Tranches tab — so
the officer sees the gate the release check enforces.

**Three things this needed that did not exist:**

| Addition | Why |
|---|---|
| `sourceKey?: string` on `ExtractedField` | CJ-28 verifies fields it did NOT collect. Without the extraction key on the record, the screen has a label and a typed value but no way to find the reading, and every re-check lands back on `pending`. The `fromKey` namespace split (defect #4) again, one layer down. |
| `verifyDeclared(fields, extracted, docId)` | `declareEvidenced` builds from a screen's form state. CJ-28 has no form — the values were typed days ago. Same comparison, different source, and it never touches `enteredValue`. |
| `SmartFill`'s `docId` prop | CJ-28 works from the `backingDocIds` already on a field, so it knows the id and should not have to reverse it into a label pattern. |

**Entry point:** a blocking `upload` task at S11→DISBURSED_ACTIVE, applicant only.
Asking mid-capture would undo the point of letting them skip the upload.

Verified on APP-2901: two groups owed → PAN upload resolved 3/3 clean → marksheet
upload produced two genuine contradictions rendered in plain language →
`declarationsSettled` false → gate `passed: false`. Console shows
`✓ Self-declared details evidenced` as tranche 1's fifth gate on APP-2612 and
correctly absent from tranche 2.

### Phase D — sanction pack (items 4 & 5)

Seven agents in parallel at countersign. **All four optional documents were selected
by the user**, so the full set is:

| Agent | Produces | Audience |
|---|---|---|
| Credit assessment memo | The CAM as an *artifact* — today `DecisionTab` renders a CAM screen but nothing is produced | Bank |
| Sanction letter | The formal letter behind CJ-22 | Customer |
| Key Facts Statement | RBI-style KFS — APR, all-in cost, fees, recovery, grievance route | Customer |
| Repayment schedule | Amortisation, moratorium interest-only phase separated | Customer |
| Conditions & covenants | Each covenant with what clears it and by when | Customer |
| Internal risk note | Deviations, FOIR, tier/overlay basis, DoA band | Bank |
| Pre-sanction outreach | Email + SMS + WhatsApp **drafts** (item 5) | Draft → officer approves |

- New optional `app.generatedDocs` container (checklist `documents` are rows to
  *collect*, not artifacts we *produce* — do not conflate them).
- Messages are created as **drafts**, never sent; an officer approves each through
  the existing `sendComm`.
- Downloads go through the **existing** `deliver()` in `lib/csv.ts` —
  `stampedName(base, iso, ext)` already takes a generic extension. No new dependency.
- **Fix while here (pre-existing defects in `countersign`):** hardcoded `180` instead
  of `POLICY.sanctionValidityDays`; hardcoded owning officer `'S. Kulkarni'`; inlined
  sanction-issued comm body, which drops the `validity` token its own template carries.

### Phase E — university intelligence (item 6) — **BUILT AND VERIFIED**

User's answer, verbatim: *"Combination of 1 and 3. We create a database of the
research we do, but with every application on a 24-hour basis, we do a live fetch to
update data."*

**State: complete.** `tsc --noEmit` clean · `npm run build` clean · standalone build
clean (0.83 MB, self-contained) · walked live on `/__dev/agents` and the new App-360
tab. Wiring only — the corpus itself was written by the parallel session.

#### What was built

| Lines | File | What |
|---:|---|---|
| ~110 | `src/lib/agents/universityCorpus.ts` | **New.** Selection over the corpus: `CATEGORY_RANK`/`CATEGORY_LABEL`, `coverageFor`, `matchesProgramme`, `selectFindings`, `allFindings`. Pure — no clock, store or network. |
| ~250 | `src/lib/agents/university.ts` | **New.** `runUniversitySwarm` / `runUniversityIntel` / `buildBrief` / `briefFromRun`, plus `BRIEF_TTL_HOURS`, `briefIsStale`, `briefStaleness`, `briefAgeHours`. |
| — | `src/types.ts` | `UniversityBrief` + `UniversityBriefSource`; **optional** `app.universityBrief`; `'university'` added to `App360Tab`. |
| — | `src/store/appStore.ts` | New verb `recordUniversityBrief(appId, brief, actor, note?)` → `UNIVERSITY BRIEF RECORDED` / `UNIVERSITY BRIEF REFRESHED`. |
| ~180 | `src/components/App360/tabs.tsx` | New `UniversityTab` — provenance band, coverage chip, synthesis, one card per source with publisher, date and clickable URL. |
| — | `src/components/App360/App360.tsx` | Tab in the strip at `:25`, case at `:113`. |
| ~230 | `src/journeys/dev/AgentInspector.tsx` | `UniversitySection` — determinism, customer-leak, 24h-boundary and never-blocking assertions across 31 rows. |
| — | `docs/API-CONTRACT.md` | New **§8 University intelligence** — endpoints, server-owned TTL, bank-only refusal rule, webhook. |

#### Design decisions worth knowing

- **Coverage is THREE states, not two.** `adequate` (researched, findings on file),
  `thin` (researched and genuinely quiet — the corpus says so and carries a `note`),
  `absent` (**not in the corpus at all**). `absent` is the dangerous one: an empty
  panel reads as a clean bill of health, so it renders an amber banner saying
  *"absent, not clean — nobody has looked"*.
- **The researcher's `level` is carried through, never re-derived.** The corpus
  assigns each finding `'info' | 'attention'` with the source in front of it. The
  agent selects, orders and synthesises; it does not re-judge severity.
- **Nothing is ever `'block'`.** Asserted in the harness, not merely documented. A
  newspaper must not be able to stop a customer's file.
- **The brief is a flattened COPY of the corpus finding**, not a reference into it —
  a brief records what was said when it was fetched, so revising the corpus must not
  silently rewrite briefs already on file. It carries the corpus's stable slug `id`.
- **`AgentFinding.ref` was deliberately NOT widened** to carry a URL. Its union is
  `document | validation | field | party`; adding a URL kind would let any finding
  smuggle a link into surfaces not built to show one. The URL travels on the brief.
- **The store verb is idempotent on `fetchedAt`.** The panel re-crawls on mount when
  stale; without the guard, clicking between tabs would write an audit line each time
  and the trail would stop meaning *"the crawl ran"* and start meaning *"somebody
  looked"*.

#### Verified live

- `/__dev/agents` → **31 rows** (14 seeded + 14 one-per-selectable-university
  synthetic + 3 MIT-with-varying-programme): determinism identical across two runs on
  all 31 · 0 customer lanes · 0 customer-audience findings · 0 brief strings in the
  customer projection · 0 blocking findings · fresh at +23h and stale at +25h on every
  row.
- **Customer-leak assertion** serialises `tasksFor()` + `customerFacingStatus()`
  against an application that *has* a brief attached — the only state in which a leak
  is possible — and searches for every publisher, source title, URL, synthesis line
  and category label. University and programme names are excluded on purpose: those
  are the customer's own facts. This is the runtime equivalent of the ad-hoc route
  scanner and is stronger for the brief specifically.
- **App-360 → University brief on APP-2612 (USC, 5 sources):** renders all five with
  category chip, attention chip, publisher, real date and clickable source URL.
- **Programme narrowing observable:** MIT on `MS Computer Science` → 4 sources, 0 set
  aside; on `MBA` / `MPH` → 3 sources, **1 set aside** (the graduate-intake finding is
  tagged to the taught MS/MEng courses).
- **Re-crawl fires and is legible.** Rev 1 at base → advance clock → rev **2**,
  `re-crawled — previous stamp 20-Jul-2026 15:30` printed beside the new stamp, and a
  fresh `UNIVERSITY BRIEF REFRESHED … previous stamp … (48h earlier)` line on the
  Audit tab **stamped at the advanced time**. Confirmed at both **+24h (the exact
  boundary)** and **+48h**.
- **Zero network calls.** No `fetch(`/`XMLHttpRequest`/`WebSocket` anywhere in `src/`.
  The single `fetch(` in the standalone HTML is Vite's own modulepreload polyfill
  (pre-existing, and dead code in a single-file build).

#### Scope extension — FT Top 50 US MBA schools

The corpus was extended from 14 to **45 dossiers / 139 findings**, adding the FT Top
50 US MBA schools. The research is the parallel session's; the **wiring** side of
that extension is:

- **`resolveIntel()`** in `universityCorpus.ts` — the corpus's exact lookup first,
  then a token-subset match, then nothing. Deliberately not fuzzy string distance.
  Programme-sensitive, so a business programme can resolve to a different dossier
  than an engineering one at the same university.
- **No alias table, on purpose.** Writing out fifty benefactor-to-university pairs
  would be reproducing the FT Top 50 list — researched data that belongs in the
  corpus beside its source. Resolution matches structurally against whatever the
  corpus filed, so the list lives in exactly one place.
- **`brief.dossier` + `brief.matchedBy`** — the brief records which dossier it was
  built from and how it was reached. A `token` match renders a `dossier: Michigan`
  chip and a *"confirm it is the same institution before relying on it"* line,
  because with business schools in scope the heading legitimately differs from the
  name on the file.
- **Resolution diagnostic** at `/__dev/agents` — every distinct university across
  all 214 applications, resolved twice (business vs engineering programme), with
  the dossier key and match method. **This exists because a resolution miss is
  silent**: it renders identically to `coverage: 'absent'`, so without the table a
  researched dossier could sit in the corpus unreachable while the panel says
  nobody looked.
- **14 name-matching guards**, asserted against a fixed table rather than against
  whatever dossiers exist today — the pairs that matter most are the ones that must
  **not** match, and those cannot be demonstrated from the live corpus.

Current resolution: **18 of 30** distinct university names, **134 of 214**
applications. The 12 unresolved names are genuinely absent from the corpus
(Boston College, IIT Chicago, JHU, NC State, Ohio State, Penn State, Rutgers,
Texas A&M, UB SUNY, UF, UIUC, UMass Amherst).

**`US_UNIVERSITIES` was extended to 45 by the parallel session** — the 31 FT US
schools not already listed. They correctly did **not** reuse `rank` for the FT
position: an FT MBA rank is not a global university rank, and feeding Wharton's FT
rank of 1 into `overlayFor()` would have been a category error that silently
widened a ceiling. All 31 additions omit `rank` entirely.

> **✅ CREDIT DECISION — CLOSED. `rank` stays undefined on the 31.** (`7bf9b58`,
> comment only — no behaviour moved.)
>
> The open question was: the 31 FT additions carry no `rank`, and
> `overlayFor(undefined)` returns `{ overlay: null, ceilingInr: null }` — so
> Wharton, Booth, Kellogg, Yale SOM, Haas and Tuck get **no** premier overlay while
> **Purdue** at rank 89 gets `Global-Rank-Top-100`. Policy intent inverted for
> exactly the schools the extension was for.
>
> Setting `rank` from the FT MBA table was proposed, briefly accepted, and then
> **rejected** on a ground neither of the sessions arguing it had raised: **six of
> the 45 are not in the FT table at all.** Stanford and Columbia would have gone
> `top50` → **NONE** — an applicant losing their unsecured uplift because a
> business school declined a questionnaire. Regressing existing universities to buy
> an uplift for new ones is a bad trade, so `rank` stays a **global** rank
> everywhere it is set.
>
> **Correction to an earlier version of this note.** It claimed FT positions run
> 1…39 so every FT school lands in the `rank <= 50` band. That was wrong — the span
> is **1…89**, splitting 23 top-50 / 16 top-100. The number came from the Phase B
> session (conflating "39 US schools" with "positions 1…39") and was repeated here
> without being checked against the FT table, which this session cannot see. The
> ₹75L / ₹50L ceilings, the `securityRequired` chain at `eligibility.ts:94` and the
> label derivation below were all verified directly and stand.
>
> **What survives, and is now documented in code.** `PreQual.tsx:511` derives the
> basis label from the band alone:
> `a.overlayBasis = offer.premierOverlay === 'top50' ? 'Global-Rank-Top-50' : …`.
> That is **only honest while `rank` is a global rank everywhere it is set** — an
> unwritten invariant, and the label renders to a reviewer on the Decision tab
> (`tabs.tsx:378`) and the Tier chip tooltip (`badges.tsx:30`). If a
> programme-specific table is ever used for `rank`, the label must move with it:
> `OverlayBasis` already carries **`'Programmatic-Top'`**, and `POLICY`'s note
> names the valid bases as *"QS/THE/ARWU rank or programmatic-top (AACSB/ABET) or
> lender-curated"*. The invariant is now recorded at the point the label is
> manufactured.
>
> `seedBulk.ts:414` has the same band-to-label shape but keys off `uni.tier`, not
> `rank`, so it is unaffected either way.

#### Defects and traps found during Phase E

| # | Finding | State |
|---|---|---|
| E1 | **`src/data/universityIntel.ts` did not exist when Phase E started** — repo clean, no stash, nothing on disk. Phase E was built against a placeholder stub at a *separate* path (`universityIntel.stub.ts`) so it could not collide with the parallel session's file. The real corpus landed mid-build; the wiring was rewired to it and the stub deleted. | Resolved. **This tree is shared by two live sessions** — `git status` changed under me during the build. Check it before assuming a file is missing. |
| E2 | **The corpus and the bulk seed name different universities.** The corpus keys on `US_UNIVERSITIES` (the 14 the pre-qual screen can select). The bulk seed draws from a wider list, so **10 of APP-2601…2614 resolve to `coverage: 'absent'`** — only Purdue (2605), CMU (2607), NYU (2609) and USC (2612) have a dossier. Journey-created files (APP-2901+) always resolve. | **Open, by design but worth a decision.** Demo on 2605/2607/2609/2612 or on a journey file. Renaming seed universities would fix it but means editing `seed.ts` — forbidden. |
| E3 | **`audit()` defaults `ts` to `NOW_ISO` — the UN-OFFSET frozen base** (`lib/format.ts:51`), not `nowIso()`. Any audit line written after the operator advances the clock is stamped at the base instant, so a +25h refresh would appear to have happened at 10:00 on the base day — hiding exactly what a reviewer came to see. | Overridden locally (`ts: brief.fetchedAt`). **Every other verb in the store still has this.** Phase D's sanction pack will hit it. |
| E4 | **`AgentInspector.tsx:207` uses `Date.now()`** in the `LiveRun` plan seed (pre-existing). Presentation only — it reseeds the stagger so a re-run looks different — and it does not touch results, so determinism is unaffected. Flagged because the standing rule is *no `Date.now()` in prototype logic* and a reader will trip over it. | Open, benign. |
| E5 | **`Penn State University` was resolving to the `Penn` (Wharton) dossier.** Found live in the resolution diagnostic the moment the corpus grew to 45. Both names reduce to a shared `penn` token, and the institution-defining leftover `state` was only being checked inside the place-name branch. A Penn State applicant was being handed Wharton's brief — sourced, plausible, and about the wrong university. | **Fixed.** The institution-token rule is now general, not place-only. Guarded in the checked-in table alongside `Michigan`/`Michigan State` and `Boston University`/`Boston College`. |
| E6 | **`University of Washington` matched `Washington University`.** Both reduce to `{washington}`; identical place-only token sets were being allowed. Different institutions, opposite sides of the country, and the corpus carries both (`UW`, `WashU`). | **Fixed** — a bare place name never carries a match. The legitimate version goes through the exact lookup on the dossier's own `name`. |
| E7 | **The brief claimed a parent-university dossier was "the business school for this programme".** The clause was gated on the *programme* being a business programme rather than on the *key* naming a school. Since the corpus files MBA dossiers under the parent short name (`Michigan`, not `Ross`), it described the dossier wrongly — a small lie on a credit surface. | **Fixed** — the clause now requires the matched key to name a school. |
| E8 | **The customer-leak detector false-positived on `publisher: 'Dartmouth'`.** A university press office is a legitimate source, so a publisher name can equal the institution name — which appears on customer surfaces perfectly legitimately. The detector reported `1 LEAKING` on every Dartmouth file. Left in, it would have trained a reader to ignore a red banner, which is worse than not having the check. | **Fixed** — needles that are substrings of the file's own university/programme are excluded. URLs, source headlines, details, corpus ids and synthesis lines are unaffected; none of them is a substring of a university name. |
| E9 | **`Georgia Tech` does not token-match `Georgia Institute of Technology`** — `Tech` and `Technology` are different tokens. Harmless today because the corpus files it as `Georgia Tech`, but it is a real limit of structural matching. | Open, documented in the guard table. **File dossiers under the short key the seed uses.** |
| E10 | **A full page reload resets the clock offset.** `_offsetHours` is a module global in `lib/clock.ts`, so a browser reload silently returns to +0h. Verifying the re-crawl therefore requires **client-side** navigation (in-app links/tabs); a `location.assign` between advancing the clock and opening the file will make the re-crawl appear not to fire. Cost a false negative during verification. | Open, inherent to the design. **Demo the clock and the brief without reloading.** |

### Phase F — surfacing, verification, docs

- App-360 tab for generated papers + university brief; agent findings on the existing
  Integrations and HITL views.
- Extend the harness: every generated paper renders; every self-declared field has a
  backing document; **no fraud finding leaks to a customer route**.
- Re-run the 28-route internal-vocabulary scanner (expect `leaks: []`).
- Re-walk both acceptance checklists.
- `tsc --noEmit` · `npm run build` · `node scripts/build-standalone.mjs`.

---

## 8. Open decision

**APP-2901 vs renumbering the bulk seed.** The bulk seed spans APP-2701…**2900**
(not "27xx" — this caused a collision defect in v1). The journey start id is now
computed from live state with a floor of 2801, so the first journey application is
**APP-2901**. The alternative is renumbering the bulk seed to free APP-2801.
Not yet decided.

---

## 9. Frozen clock

`BASE_NOW_ISO = '2026-07-20T10:00:00.000Z'` plus an operator offset. There is no
`Date.now()` in prototype logic — everything derives from the frozen clock so demos
repeat exactly. The 24h university refresh in Phase E must use this clock, not wall time.

---

## 10. Release state — v1.1.0

Per `docs/RELEASING.md`, a push needs all three. Two are done:

| # | Requirement | State |
|---|---|---|
| 1 | Semver tag | ✅ `v1.1.0`, annotated, pushed → `8eb6d35` |
| 2 | `CHANGELOG.md` entry | ✅ committed, with a Verified table and 8 Known/open items |
| 3 | GitHub Release | ❌ **OUTSTANDING** — GitHub's Releases API returned `503 Service Unavailable` on every attempt (both `gh release create` and `gh release list`, so it was the service, not the call) |

**To finish it when GitHub recovers** — notes come from the changelog so the two
can never disagree:

```bash
gh release create "v1.1.0" --title "v1.1.0" \
  --notes-file <(awk "/^## \[1.1.0\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md)
gh release view "v1.1.0" --json tagName,url -q '.tagName + "  " + .url'
```

Nothing else is pending. Do **not** re-tag or force-push; if something in the
release turns out wrong, cut `v1.1.1` with a `### Fixed` entry (RELEASING.md §5).

### What was verified before tagging

Gates were run against the release commit in a **detached worktree**, not the
shared working tree — a parallel session's uncommitted, non-compiling work was
present throughout and would otherwise have contaminated the result. `tsc`,
`npm run build` and the standalone build were clean; `/__dev/tasks` showed party
isolation clean and 14/14 projections agreeing; `/__dev/agents` showed all seven
Phase E assertions green. The acceptance checklists were **not** re-walked —
recorded as Known/open item 6.
