# Versions — what V1 is, what V2 is, and how to tell them apart

This repo has been built in two distinct bodies of work. They are not the same
kind of thing, they were commissioned separately, and a good deal of confusion
is avoided by keeping them apart in your head before you read the code.

| | **V1** | **V2** |
|---|---|---|
| What it is | The **origination journeys** — the surfaces a customer, a parent and a relationship manager actually touch | **Agentic origination** — work the bank does *to* a file, made visible and made to produce artifacts |
| Shipped as | `v1.0.0` | `v1.1.0` (item 6 only) + `v2.0.0` (the rest) |
| Shape | Screens and flows | Agents, generated papers, and a gate |
| Code marker | `§v4` | `§v5`, `§Phase A`–`§Phase E` |

> **The one trap.** "V2" names a *body of work*, not a version number. V2's
> sixth development shipped early, inside **`v1.1.0`**, as a checkpoint release.
> So V2 spans two tags. If you are looking for the university intelligence
> corpus and cannot find it in the `v2.0.0` diff, that is why.

---

## Before V1 — the console

The Horizon Bank **EduLoan Orchestrator** console (`/console`) predates both
tagged versions. It is the bank-side orchestration screen: pipeline, queues,
batches, Application-360, analytics, reports, automation. V1 was built *in front
of* it; V2 adds to both sides of it.

It carries its own internal section markers — `§v2` (automation, escalation,
in-application deviations) and `§v3` (document sourcing, consent ledger, the
HITL queue). Those are **console** version markers and have nothing to do with
the V1/V2 split described here. This is the single most common misreading of
this codebase: `§v2` in a comment does **not** mean "V2".

---

## V1 — the origination journeys (`v1.0.0`)

Four customer-facing surfaces in front of the console:

| Surface | Route |
|---|---|
| Customer journey | `/apply` |
| Co-applicant portal | `/co/:token` |
| Collateral-provider portal | `/security/:token` |
| Assisted (RM) journey | `/assisted` |

48 screens. The eligibility engine, consent mocks, the handoff primitive,
document capture with classification and extraction, the tracker with its
send-back loop, and the whole sanction → acceptance → disbursement arc.

**What characterises V1 code:** it is *screens and state transitions*. Nothing
in V1 runs on a timer, produces a document, or has an opinion. Every value on a
V1 screen was typed by a person or read straight off the seed.

---

## V2 — agentic origination (`v1.1.0` + `v2.0.0`)

Six developments. The first five shipped in `v2.0.0`; the sixth shipped early.

| # | Development | Shipped in |
|---|---|---|
| 1 | Upload instead of typing, with a visible parallel-agent view | `v2.0.0` |
| 2 | Three agents per upload — extraction · fraud · validation | `v2.0.0` |
| 3 | Skip → self-declared → post-decision verification, gated at disbursement | `v2.0.0` |
| 4 | Sanction pack produced by seven parallel agents | `v2.0.0` |
| 5 | Pre-sanction outreach drafted by an agent, approved by an officer | `v2.0.0` |
| 6 | University intelligence crawler with sourced findings | **`v1.1.0`** |

### The idea the whole of V2 rests on

> **Timing is theatre; results are deterministic.**

Every agent's *findings* are a pure function of its inputs. Every agent's
*duration* is a hash-derived, staggered delay whose only job is to make parallel
work visible. Findings are computed synchronously and completely up front; only
the **reveal** is on a timer. This is why the harness at `/__dev/agents` can
assert determinism by running each swarm twice and diffing the JSON.

### Where V2 lives

New files — none of these existed in V1:

| Area | Files |
|---|---|
| Agent runtime | `src/lib/agents/{types,registry,runtime}.ts` |
| The three swarms | `src/lib/agents/{documents,sanction,university,universityCorpus}.ts` |
| Timer state | `src/store/agentStore.ts` — the **only** timer-driven state in the codebase |
| Agent UI | `src/journeys/common/{AgentSwarm,SmartFill}.tsx` |
| Self-declaration | `src/lib/declared.ts`, `src/journeys/useDeclaration.ts` |
| Verification screen | `src/journeys/customer/VerifyDeclared.tsx` (CJ-28) |
| Research corpus | `src/data/universityIntel.ts` |
| Harness | `src/journeys/dev/AgentInspector.tsx` (`/__dev/agents`) |

### How V2 touches V1 without breaking it

Every V2 addition to a persisted V1 type is **optional**. That is not tidiness —
`src/data/seed.ts` holds 14 hand-written application literals that must keep
compiling untouched, and an optional field is the only way to add to a type they
instantiate.

| Type | V2 added |
|---|---|
| `ExtractedField` | `selfDeclared?`, `backingDocIds?`, `sourceKey?` |
| `Application` | `universityBrief?`, `generatedDocs?` |
| `CommStatus` | `'draft'` |
| `App360Tab` | `'papers'`, `'university'` |

---

## Reading a version off the code

1. **`§v4` in a comment** → V1, the journeys.
2. **`§v5` or `§Phase A`–`§Phase E`** → V2, the agents.
3. **`§v2` / `§v3`** → the console's own history. **Not** this V1/V2 split.
4. **An optional field on a V1 type** → almost always a V2 addition.
5. `git log v1.0.0..v2.0.0` for the whole of V2 except item 6, which is in
   `git log v1.0.0..v1.1.0`.

---

## Walking each version

**V1**: sign in at `/apply`, start an application, walk the pre-qualification
arc to an indicative offer, then the capture arc. This is unchanged in V2 —
except that every screen which used to only take typing now also offers an
upload.

**V2**, the five things worth actually seeing:

| To see | Do this |
|---|---|
| Agents on an upload | Any detail screen (CJ-05, CJ-06, CJ-08 … CJ-11) → *Upload* |
| Agents on the ordinary checklist | `/apply/:id/tasks` → any bucket → any document |
| Self-declared → verified | Skip an upload, then `/apply/:id/verify` |
| The disbursement gate | App-360 → **Tranches** — tranche 1 carries *Self-declared details evidenced* |
| The sanction pack | Countersign a file at S10, then App-360 → **Sanction pack** |
| University intelligence | App-360 → **University brief** |
| Determinism and parallelism | `/__dev/agents` |

---

## Release history

| Tag | Date | What |
|---|---|---|
| `v1.0.0` | 2026-08-17 | V1 complete — the four origination journeys |
| `v1.1.0` | 2026-08-17 | V2 item 6 — university intelligence, 45 dossiers |
| `v2.0.0` | 2026-08-18 | V2 items 1–5 — the agent runtime, self-declaration and its gate, the sanction pack |

The rule for this repo, unchanged: **no push without a version** — a semver tag,
a `CHANGELOG.md` entry recording what was *verified*, and a GitHub Release.
Procedure in [RELEASING.md](RELEASING.md).
