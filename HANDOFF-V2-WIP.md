# Handoff — v2 "agentic origination" (WORK IN PROGRESS, UNCOMMITTED)

**Written:** 2026-08-17
**Status:** working tree only. Nothing committed. `v1.0.0` on GitHub is untouched.
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
| 1 | Upload-instead-of-typing + parallel-agent processing view | **Built**, wired into **1 of 6** screens |
| 2 | Three agents per upload (extraction · fraud · validation) | **Built and verified** |
| 3 | Skip → self-declared → post-decision mandatory upload w/ cross-validation | **Core built**; screen + gate **not built** |
| 4 | Sanction-time CAM + letter + extras by parallel agents | **Not started** |
| 5 | Pre-sanction customer message drafting agent | **Not started** |
| 6 | University news crawler agent with source links | **Not started** |

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

---

## 7. Next steps, in order

### Phase B remainder — 5 screens (mechanical, pattern proven)

Follow `Academics` in `src/journeys/customer/Details.tsx` exactly.

| Screen | Backing document | Bucket |
|---|---|---|
| CJ-08 Profile | `PAN` | E1 |
| CJ-10 Admission | `I-20 (USA F-1) with SEVIS ID` | E5 |
| CJ-05 Cost | `University COA per academic year` | E6 |
| CJ-06 Parent snapshot | `3 payslips` | P2 |
| CJ-11 Add parent | `PAN` (co-applicant) | P1 |

Each needs, in this order:
1. `const *_DOC = /…/i` regex over the checklist label
2. `useDeclaration(app, { section, group, backingMatch })`
3. `<SmartFill>` with `onExtracted` prefill handlers and `onComplete={declare.onSwarmComplete}`
4. `declare.commit([...])` on submit — **with `fromKey` on every field** (defect #4)

### Phase C remainder

- `CJ-28 VerifyDeclared.tsx` at `/apply/:id/verify` — lists each self-declared group
  with its backing document; upload → same three-agent swarm → `match` computed.
- Discrepancies rendered in plain language ("You told us 8.4 CGPA; your marksheet
  says 7.9") using the two-action shape `lib/plainLanguage.ts` already provides.
- **The gate (user's choice): condition of disbursement.** A new `TrancheGate` on
  tranche 1 — the file sanctions and signs normally, but no money moves until
  `declarationsSettled(app)` is true. `TrancheGate { label, ref, passed }` already
  exists and CJ-26 already renders it as a plain "before this can go out" line.

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

### Phase E — university intelligence (item 6)

User's answer, verbatim: *"Combination of 1 and 3. We create a database of the
research we do, but with every application on a 24-hour basis, we do a live fetch to
update data."*

- `src/data/universityIntel.ts` — a corpus built by **actually researching all 14
  selectable universities**: funding, leadership changes, faculty moves, ranking
  shifts, campus/immigration policy, adverse coverage. Every finding carries a **real
  source URL, publisher and date**. Where a university yields thin results, say so in
  the corpus rather than pad it.
- `lib/agents/university.ts` — selects findings relevant to the programme,
  synthesises, stamps `fetchedAt`.
- **24-hour refresh**: a brief older than 24h against the prototype clock is stale;
  opening the file re-runs the crawl and re-stamps. Advancing the demo clock +25h
  visibly triggers a re-crawl. Staleness detection and re-crawl are real and observable.
- New optional `app.universityBrief` (per-application, so refresh is per-file).
- **State plainly:** the *fetch* is modelled, not live — zero network calls is a
  design constraint and the standalone HTML must work offline. A real crawl needs the
  backend `docs/API-CONTRACT.md` describes. **Add the endpoint to that contract** so
  the seam is documented.

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

## 10. Release procedure (when approved)

Per `docs/RELEASING.md` — no push without all three:

1. Semver tag
2. `CHANGELOG.md` entry
3. GitHub Release

Target for this work: **`v1.1.0`**.
