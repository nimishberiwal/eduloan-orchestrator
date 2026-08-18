# START HERE — EduLoan Orchestrator

**Handoff for a fresh session.** This is a router, not a manual. Eleven other
documents hold the detail; this one tells you where you are, what is true, and
what to read before touching anything.

| | |
|---|---|
| **Repo** | `~/Downloads/PythonProject/eduloan-orchestrator` |
| **Version** | `v2.6.0` — `package.json` and the tag agree |
| **Git** | clean, level with `origin/main`, 12 tags and 12 GitHub Releases |
| **Last commit** | `v2.6.0` The collateral orchestrator |
| **Written** | 2026-08-18, revised 2026-08-19 for `v2.4.0`–`v2.6.0` |

## What it is

A **front-end-only prototype** of an Education Loan origination system — Abroad
Postgraduate, US-only, up to ₹1 crore — built for an internal product-clearance
committee. No backend, no auth, no network, no persistence beyond in-memory
Zustand with a demo-reset.

Vite 5 · React 18 · TypeScript strict · Tailwind v3 · Zustand v4 · react-router v6.

Two halves sharing one store: a back-office **console** and four customer-facing
**journeys**. On top of both sits an **agent layer** — 20 agents in 5 swarms.

## Run it

```bash
npm install && npm run dev     # or: preview_start { name: "eduloan" } → :5290
```

| Surface | Route |
|---|---|
| Customer journey | `/` → `/apply/:appId/*` |
| Co-applicant portal | `/co/:token/*` |
| Collateral portal | `/security/:token/*` |
| Assisted (RM) journey | `/rm/*` |
| Back-office console | `/console/*` |
| Projection inspector | `/__dev/tasks` |
| Agent inspector | `/__dev/agents` |

Verification commands that must stay green:

```bash
npx tsc --noEmit && npm run build && node scripts/build-standalone.mjs && node scripts/scan-vocabulary.mjs
```

The last one must print `leaks: []`. The build-standalone script emits one
self-contained ~0.94 MB HTML file.

## Read in this order

| # | Document | Why |
|---|---|---|
| 1 | `docs/VERSIONS.md` | **First.** What V1 and V2 are and how to tell them apart in source |
| 2 | `HANDOFF.md` | The console: map, reasoning, open items |
| 3 | `HANDOFF-JOURNEYS.md` | The journeys; assumes you read #2 |
| 4 | `docs/V2-BUILD-NOTES.md` | The V2 build record and the 16 defects found while building it |
| 5 | `DECISIONS.md` | Every choice made where the spec was silent |
| 6 | `docs/RELEASING.md` | **No push without a version.** Read before any git push |
| 7 | `CHANGELOG.md` | Per-version: what shipped, what was verified, what is open |
| 8 | `docs/ACCEPTANCE.md` · `docs/ACCEPTANCE-JOURNEYS.md` | 14 + 18 items |
| 9 | `docs/API-CONTRACT.md` | The seam a real LOS would implement. Documented, none implemented |

## Five invariants — breaking one is a defect, not a tradeoff

1. **No network calls anywhere.** Not fetch, not a CDN font, not an image URL.
   Everything, including the 45-dossier university corpus, is a local literal.
2. **Timing is theatre; results are deterministic.** Every agent finding is a
   pure function of its inputs, computed completely up front. Only the *reveal*
   is on a timer. `/__dev/agents` proves it by running a swarm twice and diffing.
3. **The customer never sees internal vocabulary** — no stage IDs, rule codes,
   bucket codes, department names. `scripts/scan-vocabulary.mjs` enforces it.
4. **`src/data/seed.ts`'s 14 hand-written applications are never edited**, and
   **every new persisted field is optional** so those literals still compile.
   The bulk 200 in `seedBulk.ts` are generated and are fair game.
5. **No party sees another party's documents**, and **the journey is not a side
   door** — a customer submit runs the same `FORWARD_GATES` as an officer's
   move-forward, through the one chokepoint `moveForward` in `store/appStore.ts`.

## The map

**V1 (`§v4`) — the journeys.** Four surfaces feeding the same store. Two pieces
carry the weight: `lib/customerTasks.ts`, the projection that turns a 97-row
checklist into a short ordered human list; and `lib/handoff.ts`, which stops an
RM performing any act bound to the customer's identity (Aadhaar, AA consent,
e-sign, NACH) — those controls render disabled with an explanation and one
action, hand it to the customer.

**V2 (`§v5`) — agentic origination**, in two waves.

*Wave 1, agents that assist:* a 3-agent swarm on every document upload; a
7-agent sanction pack at countersign; self-declared data chased at CJ-28 and
gated so no money moves until evidenced; a university intelligence corpus.

*Wave 2, orchestrators that own a phase and can stop a file. There are now
**four**. Onboarding runs once at S05 and credit once around S06/S07;
disbursement runs on every tranche of every file; collateral is conditional and
runs only on the 98 secured ones:*

| Swarm | Agents | |
|---|---|---|
| `document` | 3 | extraction · fraud · validation |
| `sanction` | 7 | cam · sanction_letter · kfs · repayment_schedule · covenants_schedule · risk_note · outreach |
| `university` | 1 | university_intel |
| `onboarding` | 4 | minimum_data · co_applicant_fit · **decision_sufficiency** · onboarding_guardrail |
| `credit` | 5 | **fresh_assessment** · geography_cohort · college_cohort · policy_fit · credit_guardrail |
| `disbursement` | 5 | **lrs_aggregate** · fema_compliance · visa_gating · fx_band · disbursement_guardrail |
| `collateral` | 5 | **security_value** · title_search · coverage · charge_perfection · collateral_guardrail |

The four bolded agents are **anti-goal** agents, and they are the reason this is
an architecture rather than five more functions:

- **`decision_sufficiency`** must judge whether a file is *decidable* without
  shaping data to fit the mould of an approvable loan. Enforced by construction:
  it receives a `SufficiencyView` = `Omit<Application, 'decision' | 'rejectionCode' | 'outcome' | 'pendingChecker'>`.
- **`fresh_assessment`** must reassess with no inheritance from sales. It
  receives a `CreditView` = `Omit<Application, 'onboardingVerdict'>`.
- **`lrs_aggregate`** runs the **opposite way**, and this is the one most likely
  to be "simplified" by a later session. The other two are given *less* than the
  record; this one must be given *more*. The LRS ceiling is an annual aggregate,
  so a schedule of four USD 70,000 tranches passes every per-tranche check ever
  written and breaches a USD 250,000 cap. It therefore takes the **whole
  schedule** by construction and there is deliberately no per-tranche variant.

The first two are held by a guardrail asserting the output is **byte-identical**
when the stripped field is forced both ways. The third is held by a *positive*
control instead.

> ⚠️ **`perTrancheLrsWouldPass()` in `agents/disbursement.ts` is the WRONG
> answer, kept on purpose — do not delete it as dead code.** Nothing calls it
> but `runDisbursementGuardrail`, which rigs a file and requires it to disagree
> with `runLrsAggregate`. The day they agree, the aggregate view has stopped
> being load-bearing and nothing else would notice.

- **`security_value`** must value the asset without knowing what is being asked
  for. A valuer who can see the loan arrives at the loan. It receives a
  `SecurityView` = `Omit<Application, 'askInr' | 'creditAssessment' | 'decision'
  | 'rejectionCode' | 'outcome'>`, and **exactly one agent sees the ask** —
  `coverage`, whose only job is the comparison.

> ⚠️ **`charge_perfection` reads `perfection_status` and must never read
> document presence.** A deed in a folder is not a charge. The guardrail forces
> every document to `verified` and requires the verdict not to move; `blocksS09`
> only binds from S09 onward, because C4 is `requiredByStage:
> 'disbursement_t1'` and a file at S04 correctly has no charge at all.

**Two grades of authority at S13.** `VAL-CRS-21` (LRS) and `VAL-CRS-22` (Form
A2/FEMA) are `statutory` and cannot be overridden — same distinction as
`nonOverridable` on the S03 and S08 forward gates. `VAL-CRS-23` (visa) and
`VAL-CRS-24` (rate band) are overridable with an audited reason. Statutory gates
are refused **twice**: `overrideTrancheGate` will not write one and
`releasability` will not honour one, so the rule survives a tampered record.

> ⚠️ **`assessmentFingerprint()` in `agents/credit.ts` casts to `CreditView`
> deliberately — do not "clean up" that cast.** Without it the fingerprint
> strips *both* sides of the comparison and the guardrail passes vacuously. A
> negative control proved this: before the fix it caught 0 deliberate leaks;
> after, 32 of 40.

**Data:** 214 applications (14 curated + 200 generated), 10,777 documents, 37
with a labelled outcome, 15 with a tranche schedule (44 tranches), 98 secured
(94 carrying a generated security). The clock is **frozen at 2026-07-20**. `Reset demo
data` reproduces the seed exactly.

## What is NOT built

Ranked. The first three were **committed in the approved plan and not
delivered** — they are debts, not ideas.

### 1. ~~Three swarms have no checked-in harness~~ — CLOSED in v2.4.0

`/__dev/agents` now carries a section per orchestrator: onboarding and credit in
`v2.4.0`, disbursement in `v2.5.0`. The byte-identical tests that make the
anti-goals real are checked in and re-runnable, each with a control that must
fail if the test beside it has gone vacuous.

Disbursement joined in `v2.5.0` and collateral in `v2.6.0`.

**Still open: the `sanction` swarm has no section.** Seven agents producing
seven documents, and nothing asserts they are deterministic or that the pack a
reviewer sees is the pack the file's own facts produce.

### 2. Acceptance not fully re-walked since v2.0.3

Since then: the seed's outcome model changed (v2.1.0), **three** orchestrators
landed, two App-360 tabs appeared, `evaluateGate` gained an `'onboarding'`
failure kind that can hold a file at S05, and `releaseTranche` gained computed
gates that can hold a tranche at S13. Nine console items were re-run during the
seed work; the 18-item journeys checklist was not. Neither acceptance doc
mentions Readiness, Credit assessment, or the S13 computed gates.

Item 8 (APP-2612 tranche 2) **was** re-verified in `v2.5.0` and still passes
with the agent gates layered on. Items 4 and 5 rest on curated files whose
`sha256` is unchanged, which is a stronger check than a re-walk.

### 3. `docs/API-CONTRACT.md` has nothing for any orchestrator

The plan committed to documenting the backend seam the way the university crawl
did, stating plainly that the learning is computed in-prototype. Zero mentions.
Disbursement adds two real ones: an LRS position is a bureau-style external
lookup, and Form A2 lodgement is a filing, not a boolean on a record.

### Known limits, already recorded in the changelogs

- **Both orchestrators run on demand only** — neither re-fires as documents land
  or on entry to S06, so a stale verdict or stale cohort position is possible.
- **Geography learns on the servicing branch**, not applicant residence. CJ-08
  now persists the applicant's city and PIN, but no *closed* file carries one,
  so there is nothing to learn from on that basis yet.
- **Cohorts are thin.** 214 files across 8 branches and 30 universities means
  many cohorts honestly report `absent` or `thin` rather than a percentage. That
  is deliberate — the `adequate | thin | absent` vocabulary comes from the
  university brief — but it limits how much the demo can show.
- **The LRS cap never binds on this book.** ₹1 Cr is about USD 119,000 at ₹84,
  so a single file cannot reach a USD 250,000 ceiling; only the rigged control
  exercises the breach path. The agent's value here is the headroom figure, and
  it cannot see remittances made through another bank in the same year.
- **S03 KYC and S12 documentation still have no agent.** S09 was built in
  `v2.6.0`; these two are what remain.
- **Situs cannot currently fail.** Every instrument the product accepts is
  Indian-situs, so `VAL-EXT-15` is true by construction — computed rather than
  assumed, and it would bind if a foreign asset were offered.
- **The RM surface has no dedicated readiness panel**; it inherits the S05 gate
  failure through `evaluateGate` and shows only that.
- **HITL never received agent findings.** The original Phase F said Integrations
  *and* HITL; fraud score/signals went to the Documents tab instead, documented
  as a deviation. The HITL queue still surfaces nothing from the agents and
  still gates nothing.

## Working practices — learned the hard way here

**Releases.** `docs/RELEASING.md` is binding: **no push without a semver tag, a
CHANGELOG entry, and a GitHub Release.** Bump `package.json` *before* tagging —
v2.0.0 was tagged without the bump and the tag had to be moved before it was
shared.

**Marker convention, and the trap in it.** `§v2`/`§v3` in source comments mark
the *console's* own history and predate everything here. V1 is `§v4`; V2 is
`§v5`. **There is no V3** — some changelog entries say "V3 Phase 2/3", which was
a working label. All of it is V2. `docs/VERSIONS.md` exists to stop you tripping
on this.

**Detectors need negative controls.** Three times a check looked like it was
working and was not: the vocabulary scanner reported 38 hits of which 37 were
false (fixed by filtering to prose only — it then found one real leak, CJ-28
rendering "Academic (E3)"); the onboarding guardrail failed 4 files on the
document label "Approved / sanction plan (BBMP / DDA / equivalent)"; and the
credit guardrail passed everything while testing nothing. **Before trusting a
new check, make it fail on purpose.**

**Verifying while others are in the tree.** Two peer Claude sessions worked this
same checkout. They twice corrected me — a mis-attributed commit and a stale
`git status` — and I once propagated a wrong figure before correcting it
publicly. If a peer session may be active, **verify in an isolated git worktree**
rather than the shared tree, and re-read `git status` immediately before
asserting anything about it.

**No source edits mid-walkthrough.** There is no persistence. A Vite hot-reload
triggered by saving a file resets all demo state.
