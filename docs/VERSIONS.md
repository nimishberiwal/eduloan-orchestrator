# Versions — what V1 is, what V2 is, and how to tell them apart

This repo has been built in two bodies of work. They are not the same kind of
thing, they were commissioned separately, and a good deal of confusion is
avoided by keeping them apart in your head before you read the code.

| | **V1** | **V2** |
|---|---|---|
| What it is | The **origination journeys** — the surfaces a customer, a parent and a relationship manager actually touch | **Agentic origination** — work the bank does *to* a file, made visible, made to produce artifacts, and finally made to own a phase |
| Shape | Screens and flows | Agents, generated papers, gates and orchestrators |
| Tags | `v1.0.0` | `v1.1.0` → `v2.3.0` |
| Code marker | `§v4` | `§v5` |

> **There is no V3.** The orchestrator work was drafted under a working "V3"
> label and its changelog entries for `2.1.0`–`2.3.0` still read *"V3
> groundwork"*, *"V3 Phase 2"*, *"V3 Phase 3"*. Those entries are published in
> GitHub Releases and are left as written. **All of it is V2** — the second
> commission, delivered in two waves.

---

## Before V1 — the console

The Horizon Bank **EduLoan Orchestrator** console (`/console`) predates both
tagged versions: pipeline, queues, batches, Application-360, analytics, reports,
automation. V1 was built *in front of* it; V2 adds to both sides of it.

It carries its own internal markers — `§v2` (automation, escalation, deviations)
and `§v3` (document sourcing, consent ledger, HITL queue). Those are **console**
version markers and have nothing to do with the V1/V2 split.

> **This is the single most common misreading of this codebase.** `§v2` in a
> comment does **not** mean "V2", and `§v3` does **not** mean "V3". The
> orchestrator work briefly used an uppercase `§V3`, which collided with the
> console's `§v3` inside the same file. It was renamed to `§v5`; if you find a
> `§V3` anywhere, it is a straggler and belongs to V2.

---

## V1 — the origination journeys (`v1.0.0`)

Four customer-facing surfaces in front of the console:

| Surface | Route |
|---|---|
| Customer journey | `/apply` |
| Co-applicant portal | `/co/:token` |
| Collateral-provider portal | `/security/:token` |
| Assisted (RM) journey | `/rm` |

48 screens. The eligibility engine, consent mocks, the handoff primitive,
document capture with classification and extraction, the tracker with its
send-back loop, and the whole sanction → acceptance → disbursement arc.

**What characterises V1 code:** it is *screens and state transitions*. Nothing in
V1 runs on a timer, produces a document, or has an opinion. Every value on a V1
screen was typed by a person or read straight off the seed.

---

## V2 — agentic origination (`v1.1.0` → `v2.3.0`)

Two waves. The first made agents *assist*; the second made them *own*.

### Wave 1 — the six requested developments

| # | Development | Shipped |
|---|---|---|
| 1 | Upload instead of typing, with a visible parallel-agent view | `v2.0.0` |
| 2 | Three agents per upload — extraction · fraud · validation | `v2.0.0` |
| 3 | Skip → self-declared → post-decision verification, gated at disbursement | `v2.0.0` |
| 4 | Sanction pack produced by seven parallel agents | `v2.0.0` |
| 5 | Pre-sanction outreach drafted by an agent, approved by an officer | `v2.0.0` |
| 6 | University intelligence crawler with sourced findings | `v1.1.0` |

Item 6 shipped **early**, as a checkpoint release. That is why V2 spans two
minor lines: if you are looking for the university corpus in the `v2.0.0` diff,
that is where it went.

Then three patches closing what `2.0.0` shipped as known/open: the vocabulary
scanner checked in and run, the audit clock, the fraud verdict surfaced, a full
acceptance re-walk, and two latent V1 defects found by it (`v2.0.1`–`v2.0.3`).

### Wave 2 — the two orchestrators

| | Shipped | What it owns |
|---|---|---|
| Causally consistent seed | `v2.1.0` | Prerequisite — see below |
| **Customer onboarding orchestrator** | `v2.2.0` | Four agents; gates the S05 → S06 handover |
| **Credit decisioning orchestrator** | `v2.3.0` | Five agents; assesses independently of the sales view |

The seed repair came first because it had to. A bulk application's closure
reason was `rng.pick(REJ_CODES)` — uncorrelated with the ask, the university, the
bureau score, the FOIR and the blocker. Cohort-learning agents over that data
would have reported confident percentages from pure noise, in a credit context.

**The two orchestrators are the point of wave 2.** Everything before them
*assists* — reads a page, writes a paper, fetches a brief. These two own a phase
and can stop a file:

- **Onboarding** decides whether an application is complete enough to leave
  collection, and holds the S05 → S06 exit until it is. Officers keep an audited
  override that records the disagreement without pretending the file was
  complete.
- **Credit** reassesses from raw data with the onboarding verdict structurally
  removed, and proves the independence rather than asserting it.

### The idea the whole of V2 rests on

> **Timing is theatre; results are deterministic.**

Every agent's *findings* are a pure function of its inputs. Every agent's
*duration* is a hash-derived, staggered delay whose only job is to make parallel
work visible. Findings are computed synchronously and completely up front; only
the **reveal** is on a timer. This is why `/__dev/agents` can assert determinism
by running each swarm twice and diffing the JSON.

### Two anti-goals, enforced rather than intended

These are the properties that made wave 2 an architecture change rather than
more swarm functions, and each is held by a guardrail agent that can fail:

| Property | How it is enforced | How it is proven |
|---|---|---|
| Onboarding measures whether a file is **decidable**, never whether it would be **approved** | Handed a `SufficiencyView` with `decision`, `rejectionCode`, `outcome` and `pendingChecker` stripped | Run against the same file with the decision forced APPROVE and DECLINE — all three outputs must be byte-identical |
| Credit assesses with **no influence** from what sales concluded | Handed a `CreditView` with `onboardingVerdict` removed | The assessment is run with and without the verdict attached and must be byte-identical — and the test is checked with a negative control that deliberately leaks |

### Where V2 lives

| Area | Files |
|---|---|
| Agent runtime | `src/lib/agents/{types,registry,runtime}.ts` |
| Assisting swarms | `src/lib/agents/{documents,sanction,university,universityCorpus}.ts` |
| **Orchestrators** | `src/lib/agents/{onboarding,credit,disbursement,collateral}.ts` |
| Timer state | `src/store/agentStore.ts` — the **only** timer-driven state in the codebase |
| Agent UI | `src/journeys/common/{AgentSwarm,SmartFill}.tsx` |
| Self-declaration | `src/lib/declared.ts`, `src/journeys/useDeclaration.ts` |
| Verification screen | `src/journeys/customer/VerifyDeclared.tsx` (CJ-28) |
| Research corpus | `src/data/universityIntel.ts` |
| Harness | `src/journeys/dev/AgentInspector.tsx` (`/__dev/agents`) |
| Vocabulary guard | `src/lib/vocabulary.ts`, `scripts/scan-vocabulary.mjs` |

### How V2 touches V1 without breaking it

Every V2 addition to a persisted V1 type is **optional**. That is not tidiness —
`src/data/seed.ts` holds 14 hand-written application literals that must keep
compiling untouched, and an optional field is the only way to add to a type they
instantiate.

| Type | V2 added |
|---|---|
| `ExtractedField` | `selfDeclared?`, `backingDocIds?`, `sourceKey?` |
| `Application` | `universityBrief?`, `generatedDocs?`, `agentChecks?`, `onboardingVerdict?`, `creditAssessment?` |
| `CommStatus` | `'draft'` |
| `ClosureKind` | `'disbursed'` |
| `GateFailure['kind']` | `'onboarding'` |
| `App360Tab` | `'university'`, `'papers'`, `'onboarding'`, `'credit'` |

---

## Reading a version off the code

1. **`§v4`** → V1, the journeys.
2. **`§v5`** → V2, the agents. Also `§Phase A`–`§Phase F` for wave 1's build order.
3. **`§v2` / `§v3`** → the console's own history. **Not** this split.
4. An optional field on a V1 type → almost always a V2 addition.
5. `git log v1.0.0..v2.3.0` for the whole of V2 except item 6, which is in
   `git log v1.0.0..v1.1.0`.

---

## Walking each version

**V1**: sign in at `/apply`, start an application, walk the pre-qualification arc
to an indicative offer, then the capture arc. Unchanged in V2 — except that every
screen which used to only take typing now also offers an upload.

**V2**, the things worth actually seeing:

| To see | Do this |
|---|---|
| Agents on an upload | Any detail screen (CJ-05, CJ-06, CJ-08 … CJ-11) → *Upload* |
| Agents on the ordinary checklist | `/apply/:id/tasks` → any bucket → any document |
| Self-declared → verified | Skip an upload, then `/apply/:id/verify` |
| The disbursement gate | App-360 → **Tranches** — tranche 1 carries *Self-declared details evidenced* |
| The sanction pack | Countersign a file at S10, then App-360 → **Sanction pack** |
| University intelligence | App-360 → **University brief** |
| **The onboarding orchestrator** | App-360 → **Readiness** — run it on a file at S05 and watch `Move forward` refuse |
| **The credit orchestrator** | App-360 → **Credit assessment** |
| Determinism and parallelism | `/__dev/agents` |
| **The two anti-goal proofs, with their negative controls** | `/__dev/agents` — the last two sections |

---

## Release history

| Tag | What |
|---|---|
| `v1.0.0` | **V1 complete** — the four origination journeys |
| `v1.1.0` | V2 item 6 — university intelligence, 45 dossiers |
| `v2.0.0` | V2 items 1–5 — the agent runtime, self-declaration and its gate, the sanction pack |
| `v2.0.1` | Vocabulary scanner checked in; audit clock; fraud verdict surfaced |
| `v2.0.2` | A capture result could outlive its document |
| `v2.0.3` | Full acceptance re-walk; assisted-journey redirect loop |
| `v2.1.0` | A causally consistent seed, so cohort learning has real signal |
| `v2.2.0` | The customer onboarding orchestrator and the S05 handover gate |
| `v2.3.0` | The credit decisioning orchestrator, independent by construction |
| `v2.3.1` | Marker reconciliation — `§V3` → `§v5`; this document rewritten |
| `v2.4.0` | The anti-goal harness at `/__dev/agents`; two seed contradictions closed |
| `v2.5.0` | The disbursement gating orchestrator — five agents, per tranche, two grades of authority |
| `v2.6.0` | The collateral orchestrator — the valuation never sees the ask; held is not perfected |

The rule for this repo, unchanged: **no push without a version** — a semver tag,
a `CHANGELOG.md` entry recording what was *verified*, and a GitHub Release.
Procedure in [RELEASING.md](RELEASING.md).
