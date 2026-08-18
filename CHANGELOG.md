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

## [2.6.0] — 2026-08-19

**The collateral orchestrator.** Five agents in `src/lib/agents/collateral.ts`,
gating the S09 → S10 exit on secured files. S09 is conditional — Tier-3 only —
it is the only stage that runs *alongside* others rather than after them, and it
is the slowest closure path in the seed.

### Two anti-goals, and both are old rules in a new domain

**1. The valuation must not know the ask.** The oldest error in secured lending
is not a bad valuation but a valuation that arrives at whatever number the loan
needs. `security_value` receives a `SecurityView` = `Omit<Application, 'askInr'
| 'creditAssessment' | 'decision' | 'rejectionCode' | 'outcome'>` and therefore
cannot back-solve. **Exactly one agent sees the ask** — `coverage`, whose entire
job is the comparison. Splitting the valuing from the comparing is what makes
the property enforceable; the guardrail forces the ask to ₹10L and to ₹1Cr and
requires the valuation to come back byte-identical.

This is `decision_sufficiency` ⊥ outcome, moved one domain over.

**2. Held is not perfected.** A deed in a folder is not a charge. The S09 gate
says so in as many words — *"C4 perfection may remain as COV-04"* — so a file
may be sanctioned with the mortgage unregistered, perfection deferred to a
covenant cleared before first disbursement. `charge_perfection` reads
`perfection_status` and **never** document presence; the guardrail forces every
document on the file to `verified` and requires the verdict not to move.
`c4DocsVerified` is reported and legitimately changes; `state`,
`covenantCarrying` and `blocksS09` may not.

This is "absence is not compliance" inverted: there, a missing validation is not
a passed one; here, a document on file is not a charge created.

Both tests are guarded by `controlsLive`, which asserts the ask genuinely
differs in the raw record and that only `securityView` neutralises it.

### Not applicable is not a pass

Two of the four title checks are meaningless on a lien-marked deposit: a fixed
deposit has no encumbrance certificate and no property tax. `TitleCheck.passed`
is `boolean | null`, and `null` is reported as *not applicable* rather than
folded into either column. An unsecured file gets `applicable: false` from the
verdict rather than a clean bill of health — **no security is not the same as
good security**.

### Fixed — REJ-05 rested on nothing

98 files carry `securedConstruct`, a collateral-provider party and the C1–C4
buckets. **Exactly three carried any collateral data**, all hand-written in
`seed.ts`. So `REJ-05` — *"Collateral shortfall / legal not clear"* — was being
written onto files whose collateral was never described: the same defect class
as the original `rng.pick(REJ_CODES)`, one layer down.

Secured files now carry an instrument, a valuation, a legal opinion, encumbrance
and tax status and a perfection state, all derived. The advance rate comes from
`POLICY.ltvPolicy` per instrument, and **all 3 REJ-05 files are now genuinely
short or adverse on title**.

Two knock-on effects worth noting: `policy_fit`'s LTV tests were reporting
`unassessable` on nearly every secured file for want of a valuation to assess —
book-wide `unassessable` falls from 542 to 449 and `outside` rises from 308 to
334. And `covenants: []` on all 200 bulk files meant COV-04 never existed, so
the gate's own allowance could never be exercised: every secured file at S09 was
held for an uncarried charge and the legitimate path was invisible. COV-04 is
now raised on most secured files from S09, absent on a minority.

### Fixed — a premature block, caught by its own numbers

The first cut held **69 of 98** secured files on *"charge neither perfected nor
carried"*, including files at S03 and S04. A charge is created at C4, which is
`requiredByStage: 'disbursement_t1'` — a file at S04 has none for entirely
correct reasons, and blocking it is the mirror of the error the onboarding agent
exists to catch. Perfection now only binds from S09 onward. Held falls to 18,
across five distinct reasons.

### Verified

| Check | Result |
|---|---|
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.99 MB |
| `scan-vocabulary` | `leaks: []` |
| Applications | 214, unchanged |
| **Curated 14 byte-identical** | `sha256 f00319c0…4aa227`, unchanged since `2.3.1` |
| Secured files | 98 · 94 with generated security · 80 clear, 18 held |
| Guardrail breaches | 0 / 214 — including all 116 unsecured, where there is no security to read |
| Valuation ⊥ ask | 24 / 24 byte-identical at ₹10L and ₹1Cr |
| Held ≠ perfected | 24 / 24 — verdict unmoved with every document forced to `verified` |
| Controls live | 24 / 24 |
| Unsecured files reporting `applicable: true` | **0 / 116** |
| Determinism | 0 non-deterministic / 214 |
| **REJ-05 justified by the file's own collateral** | **3 / 3** |
| S09 gate walk | APP-2730 (COV-04 removed) → `COLLATERAL HELD` → `moveForward` refused, *1 gate item failing* → `COLLATERAL OVERRIDDEN` audited, verdict still `ready: false` → advances **S09 → S10** |
| `resetDemo` | clears the verdict, restores COV-04 |
| Prior invariants | closure/history 0 · onboarding, credit, sufficiency, independence and disbursement probes all unchanged |

### Known / open

- **`coverage` reports `unassessable` on 5 curated secured files** whose
  `technical_value_inr` is seeded as `awaited`. That is the honest answer —
  absence is not a shortfall and not a pass — but it means those files are held
  on a missing figure rather than a finding.
- **Situs is true by construction.** Every instrument this product accepts is
  Indian-situs, so `VAL-EXT-15` cannot currently fail. It is computed rather
  than assumed, and would bind if a foreign asset were ever offered.
- **The collateral provider's own portal is unchanged.** A shortfall on a
  parent's property is a conversation an officer has; all five agents are
  `internal` and nothing reaches `/security/:token`.
- The `sanction` swarm still has no `/__dev/agents` section — now the oldest
  harness debt.
- S03 KYC and S12 documentation still have no agent.

---

## [2.5.0] — 2026-08-19

**The disbursement gating orchestrator.** The third orchestrator, and the only
one that repeats: onboarding runs once at S05 and credit once around S06/S07,
this one runs on every tranche of every file. Five agents in
`src/lib/agents/disbursement.ts`.

### Why S13 and not somewhere else

`Tranche.gates` was an array of hand-typed booleans. Nothing computed them. The
only thing that ever moved one was `toggleField`, reaching into every tranche to
flip `VAL-CRS-23`/`VAL-EXT-18` when `endorsement_verified` changed. The LRS cap,
the FEMA paperwork, the payee and the rate were seeded `true` and never tested
against the file at all.

`POLICY.lrsCapUsd` and `POLICY.forexBandPct` got their first reader in `2.3.0`,
in the credit orchestrator — at **assessment** time, which is not the moment
either of them binds. They bind here, per tranche, when money actually moves.

### The anti-goal runs the other way

Onboarding and credit are each handed **less** than the record — a
`SufficiencyView` with the decision stripped, a `CreditView` with the verdict
stripped — and each is proven by showing the output does not move.

This one must be handed **more**. The LRS ceiling is an annual aggregate, so a
schedule of four USD 70,000 tranches passes every per-tranche check ever written
and breaches a USD 250,000 cap by USD 30,000. `runLrsAggregate` therefore takes
the whole schedule by construction; there is no per-tranche variant to reach for
by mistake.

`perTrancheLrsWouldPass` exists **only** as the control — it is the wrong answer,
kept so the right one can be shown to differ from it. The guardrail rigs a file
and requires the two to disagree. The day they agree, the aggregate view has
stopped being load-bearing.

### Two grades of authority, and the second one cannot be waived

| Gate | Severity | Because |
|---|---|---|
| `VAL-CRS-21` LRS aggregate | **statutory** | A FEMA limit. Not a matter on which an officer holds discretion |
| `VAL-CRS-22` Form A2 + FEMA | **statutory** | The instrument the remittance is made under |
| `VAL-CRS-23` Visa endorsement | overridable | Sequencing. Audited override, as at S05 |
| `VAL-CRS-24` Rate within band | overridable | A treasury forward can legitimately sit outside today's reference |

Same `nonOverridable` distinction S03 and S08 already carry, in the same
vocabulary. Statutory gates are refused **twice**: `overrideTrancheGate` will not
write one, and `releasability` will not honour one — so the rule survives a
record that was tampered with, not merely a UI that hides the button. The dev
harness proves the second half by forging an override and requiring the tranche
to stay held.

Overrides are per **gate**, not per tranche: a reason that clears a rate finding
says nothing about a visa. They survive a re-run of the agents.

### Fixed — two seed contradictions the agent surfaced

- **Rejected, withdrawn and expired files carried disbursement schedules.** The
  first cut gated on `rank >= 13`, and `stageRank` returns 99 for every terminal
  token — so 28 closed files, including ones that died at S07, were handed a
  tranche schedule. Now named stages: `S13` and `DISBURSED_ACTIVE` only, which
  is **15** files and matches the funnel's corrected S13 reach exactly.
- **A remitted tranche could lack Form A2** — money remitted without the
  instrument it is remitted under. `a2FemaOnFile` is now forced true on a
  remitted tranche.

And a related rule in the agent: a **settled** tranche is not re-gated on any of
the four checks. Reporting a hold on money that has already gone states a problem
no officer can act on. The LRS aggregate still *counts* those tranches — they
consumed the year's headroom — which is a different thing from gating them.

### Changed — `buildTranches` uses a private RNG stream

Seeded from the application id, not the shared generator. Every draw taken from
the shared stream shifts the sequence for every application built afterwards:
the first version re-rolled the closure causes and bureau scores of the other
170 files, and the disbursed population fell from **7 to 4** — a `2.1.0`
guarantee quietly undone by a `2.5.0` feature. With a private stream the rest of
the seed is byte-identical.

### Verified

| Check | Result |
|---|---|
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.97 MB |
| `scan-vocabulary` | `leaks: []` |
| Applications | 214, unchanged |
| **Curated 14 byte-identical** | `sha256 f00319c0…4aa227`, unchanged through all of `2.4.0` and `2.5.0` |
| Files with a schedule | 15 (8 at S13, 7 disbursed) · 44 tranches |
| Guardrail breaches | 0 / 214 — including the 199 with no schedule, where an empty tranche list must not throw |
| Positive control (aggregate beats per-tranche) | 15 / 15 |
| Forged statutory override refused | 15 / 15 |
| Cannot release · no write-back | 15 / 15 · 15 / 15 |
| Settled-but-held tranches | **0** |
| Remitted without A2 | **0** |
| Customer leak | 0 lanes, 0 customer-audience findings |
| **ACCEPTANCE item 8 preserved** | APP-2612 T2 held before endorsement, releasable after — unchanged with agent gates layered on |
| Statutory walk | APP-2823 → override refused with a toast, 0 overrides written, release refused |
| Overridable walk | APP-2823 T2 (rate +2.8%) → override recorded and audited → release proposed → `pendingChecker`, maker Admin |
| `resetDemo` | clears the verdict, restores `gated` |
| Prior invariants | closure/history 0 breaches · onboarding, credit, sufficiency and independence probes all unchanged |

### Known / open

- **The LRS cap never binds on this book, and the harness says so.** A ₹1 Cr
  product is about USD 119,000 at ₹84 — a single file cannot reach a USD 250,000
  ceiling. The check is not decoration (it is why the schedule is summed at all,
  and it binds the moment the ceiling moves) but on this population its value is
  the *headroom figure*, not the block. Only the rigged control exercises the
  breach path.
- **The agent cannot see remittances made through another bank** in the same
  financial year, which consume the same cap. `LrsOutput.basis` states this
  rather than implying the cap is clear.
- The customer's post-sanction screen still reads the seeded `gatesFor` and is
  deliberately unchanged — two of the four holds are statutory limits a customer
  cannot act on. A customer may therefore request a tranche the bank will refuse.
- S09 collateral, S03 KYC and S12 documentation still have no agent.
- Not tagged or pushed. `package.json` is bumped and this entry is written; the
  tag, commit and GitHub Release are the owner's call.

---

## [2.4.0] — 2026-08-18

> **No separate `v2.4.0` tag.** This entry was written but never pushed, and its
> changes are carried inside `v2.5.0`. Tagging it now would point a tag at a
> tree containing the whole of `2.5.0` as well — a tag that does not describe
> its own code is worse than a missing one (`RELEASING.md` §5). The entry stays
> as written because the work is real and separately reviewable.

**The two orchestrators get their harness, and the seed stops contradicting
itself about where files died.** `docs/VERSIONS.md` verification item 3 — *"a
new `/__dev/agents` section per orchestrator"* — was the one part of the wave-2
brief never built. The anti-goal properties were enforced in `onboarding.ts` and
`credit.ts` and provable, but nothing ran them where they could be seen.

### Fixed — `stageHistory` disagreed with `stageAtClosure` on 27 of 37 closed files

Wave 2 made `outcome.stageAtClosure` causal: it comes from the closure cause, so
a collateral shortfall closes at S09 and adverse bureau at S06. `stageHistory`
was left alone, and it is synthesized to a depth fixed by the *terminal token*
alone — `REJECTED` → S10, `EXPIRED` → S04, everything else → S13. The two were
never reconciled:

| | Was | Now |
|---|---|---|
| Closure stage absent from the file's own history | 3 (all `EXP-02`) | 0 |
| History running past the stage the file closed in | 24 | 0 |

An `EXP-02` file is a **lapsed sanction** — closure stage S11 — carrying the
4-deep expiry history that stops at S04. It expired for the lapse of a sanction
it had never reached. In the other direction a file withdrawn at S04 carried a
history through S13.

This was not cosmetic. `funnelRollup` reads *"reached stage N"* straight off
`stageHistory`, so every overshooting file was counted at stages it never saw:

| | Was | Now |
|---|---|---|
| Reached S08 | 74 | 56 |
| Reached S11 | 35 | 31 |
| Reached S13 | **22** | **15** |

15 is the number that reconciles: 8 files in flight at S13 plus 7 disbursed
closures. The old 22 counted seven files that had been withdrawn or rejected
earlier. `buildHistory` now takes the closure stage and synthesizes the run the
file actually walked. `closureByStage` is unchanged — it reads `stageAtClosure`,
which was already causal.

### Fixed — `SufficiencyOutput.notApplicable` was empty on all 214 files

Agent 1.3's stated purpose is that `evaluateGate` treats an **absent**
validation as resolved, so the gate cannot tell *"not applicable"* from *"never
collected"*. Sufficiency separates them by reading `status === 'waived'` — and
no seed file carried a waived validation, so the distinction could only ever be
shown from the "never collected" side.

The waivers are **derived, not drawn**. Two S06-gate rules are written into the
catalogue as construct-dependent — `VAL-INT-12` is *"(co-applicant salaried)"*
and `VAL-INT-13` is *"(co-app SE)"*. Exactly one is inapplicable on every file,
and which one is decided by the income branch. A salaried co-applicant has no
P&L to reconcile; a self-employed one files no Form 16. **101 of 214** files now
carry a not-applicable. Decidability and gating are unaffected: waived already
counted as resolved for the gate, which is the point — the gate says resolved
and sufficiency says *not applicable*, which are different facts.

### Added — `/__dev/agents` sections for both orchestrators

Following the existing probe pattern: a pure probe per file, a flat interface, a
banner per property and a row per application.

- **Onboarding** — sufficiency-is-not-approvability (decision forced to APPROVE
  and DECLINE, all three outputs byte-identical), determinism, no credit
  spillover, no customer leak (`audience: 'bank'` on every finding, and
  `planRun(…, { forCustomer: true })` planning 0 lanes).
- **Credit** — independence of the onboarding verdict, determinism, no
  write-back.

**Both carry a negative control**, because this repo has already shipped a
guardrail that could not fail (see the `assessmentFingerprint` note under
`2.3.0`). Seed files carry no `onboardingVerdict` at all, so an independence
test run on them compares two identical inputs and passes on anything: the
credit probe now **attaches** a verdict first, and asserts that a payload which
*does* read it comes out different. The onboarding control asserts that forcing
the decision genuinely changes the raw record and that only `sufficiencyView`
neutralises it. If a control goes red, the test beside it has stopped meaning
anything.

### Verified

| Check | Result |
|---|---|
| `tsc --noEmit` · `npm run build` · standalone | clean · clean · 0.95 MB |
| `scan-vocabulary` | `leaks: []` (31 files, 8 patterns) |
| Applications | 214, unchanged |
| **Curated 14 byte-identical** | `sha256 f00319c0…4aa227` before and after both seed changes |
| Closure/history contradictions | 27 → **0** across all 37 closed files |
| Onboarding guardrail | 0 breaches / 214 |
| Sufficiency ⊥ outcome | 214 / 214 byte-identical under forced APPROVE and DECLINE |
| Credit guardrail | 0 breaches / 214 |
| Credit ⊥ onboarding verdict | 214 / 214 byte-identical with and without |
| Swarm determinism | 0 non-deterministic / 214, both orchestrators |
| Onboarding findings not `audience: 'bank'` | 0 |
| Live gate walk | APP-2713 at S05 → `ONBOARDING HELD` (8 unanswered) → `moveForward` refused → `ONBOARDING OVERRIDDEN` audited with officer and reason, verdict still `ready: false` → advances to S06 |
| `resetDemo` | restores S05 and clears the verdict |
| Analytics | Overview, funnel and Rejections & closures render; no console errors |

ACCEPTANCE items 4 and 5 rest on APP-2605 and APP-2608, both curated — covered
by the byte-identical hash above, which is a stronger check than a re-walk.
Item 12's funnel moves as tabulated.

### Known / open

- **The funnel numbers in any screenshot taken before this version are wrong**,
  and the corrected ones are lower at every stage from S03 down.
- `notApplicable` is 0 on the curated 14 and the `/__dev/agents` table shows it
  as such — those are `seed.ts` literals and carry no waivers. The section says
  so and prints the book-wide count beside it.
- The credit probe's negative control proves the two inputs are
  *distinguishable*; it does not run a deliberately leaking agent. A rigged
  agent would be the stronger control and is not built.
- Not tagged or pushed. `package.json` is bumped and this entry is written;
  the tag, commit and GitHub Release are the owner's call.

---

## [2.3.1] — 2026-08-18

Documentation and marker reconciliation. **No behaviour change** — comments,
docs and one heading rename only.

### Why

The orchestrator work was drafted under a working **"V3"** label. It is not a
third body of work: it is V2's second wave. The entries for `2.1.0`–`2.3.0`
below still read *"V3 groundwork"*, *"V3 Phase 2"* and *"V3 Phase 3"*; those are
published in GitHub Releases and are **left as written** rather than rewritten,
per `RELEASING.md` §5.

### Fixed — a marker collision I introduced

`docs/VERSIONS.md` warns that `§v2` and `§v3` in the source are the **console's**
own history and have nothing to do with the V1/V2 split. The orchestrator work
was then marked **`§V3`** — differing from the console's `§v3` only by case, and
landing in `src/components/App360/tabs.tsx`, a file that already contained four
of them. Exactly the misreading the document exists to prevent.

All 20 occurrences across 11 files are now **`§v5`**, the established marker for
V2 agent work. `grep -rc '§V3' src/` returns nothing.

### Changed

- **`docs/VERSIONS.md` rewritten** as the definitive V1/V2 demarcation. V2 now
  covers both waves: the six assisting developments *and* the two orchestrators.
  Adds the release history end to end, the two anti-goal properties with how
  each is enforced and proven, and the full table of optional fields V2 added to
  V1 types.
- **README** gains a V2 section to sit alongside V1, and two headings are
  disambiguated: `## v2 — reviewer feedback build` becomes **`## Console v2`**
  with a note that it predates the split, and `## v4` becomes **`## V1 (§v4)`**.
  Both previously contradicted the summary two screens above them.
- Two stale README figures corrected: the standalone build is ~0.94 MB, not
  0.74 MB, and App-360 now has 15 tabs rather than the 10 listed.

### Verified

`tsc --noEmit` · `npm run build` · standalone 0.94 MB · `scan-vocabulary`
`leaks: []` · every document cross-link resolves · no `§V3` remaining.

---

## [2.3.0] — 2026-08-18

**V3 Phase 3 — the credit decisioning orchestrator.** Five agents that assess a
file from its own facts, with the sales side's conclusions structurally removed.
Completes the two-orchestrator split.

### Added — `src/lib/agents/credit.ts`

- **Fresh assessment** — reads the file from parties, validations, documents and
  extracted figures. Produces a *position*, never a recommendation:
  `finalDecision` and `countersign` remain the only writes to `app.decision`,
  guarded by DoA band and maker-checker.
- **Geography history** — branch, city and region cohorts, narrowest basis that
  has evidence behind it.
- **College and course history** — university, university+programme and
  programme cohorts via `peersOf`.
- **Policy fit** — the **first officer-side computation of policy** in this
  codebase. `eligibility.ts:quote()` runs only in the customer pre-qualification
  journey; a bank-side file's tier, overlay, FOIR and LTV are seed literals or
  extracted fields, never computed.
- **Independence check** — the guardrail.

Every cohort rate carries `adequate | thin | absent` evidence and is quoted
against the book's own rate, so "80% adverse" can be read against a book that
also runs at 81%. Below three closed comparables no rate is emitted at all.

### Eight policy parameters get their first reader

`coaTolerancePct`, `netAskGapPct`, `lrsCapUsd`, `incomeConvergenceGapPct`,
`itrMatchTolerancePct`, `forexBandPct` and the FD/LIC/MF rows of `ltvPolicy`
were declared in POLICY and read by no code at all — their thresholds existed
only as prose inside validation messages. A number in a message is
documentation; a number a test reads is policy.

Nothing is hard-coded to a loan type. Each test states the parameter, the file's
actual figure and whether it sits inside — and reports **unassessable** where
the file does not carry the figure, rather than assuming a pass. Absence is not
compliance.

### Independence, enforced and proven

`fresh_assessment` receives a `CreditView` — the application with
`onboardingVerdict` removed. It cannot be influenced by what sales concluded
because it cannot see it. The guardrail runs the whole assessment twice, once
with the verdict present and once without, and requires **byte-identical**
output. It also asserts no agent mutated the record it was reading.

### Fixed — before shipping, a guardrail that proved nothing

The first version of `assessmentFingerprint` called `creditView()` internally,
so **both sides of the independence comparison had the verdict stripped**. It
was comparing two identical inputs and passed on every file — including one
deliberately rigged to leak.

Caught by a negative control: an agent was temporarily patched to read the
verdict, and the guardrail did not notice. The fingerprint now passes the
application through unstripped, so an agent reaching around the type shows up as
a difference. Re-run against the same rigged agent, it catches **32 of 40**
files. A guardrail that cannot fail is not a guardrail.

### Verified

| Check | Result |
|---|---|
| Negative control — rigged leaking agent | **caught on 32/40 files** |
| Real code, all 214 files with a verdict attached | 0 breaches · 0 not-independent · 0 write-backs · 0 non-deterministic |
| Live | assessment recorded, audited, five lanes render with the independence chip |
| `tsc` · `build` · standalone · vocabulary scan | clean · clean · 0.94 MB · `leaks: []` |

### Known / open

- The assessment runs on demand from the console; it is not triggered on entry
  to S06, so a stale position is possible.
- Geography learns on the **servicing branch**, not applicant residence — the
  only geography the record carries. CJ-08 now stores the applicant's city and
  PIN, but no closed file has one yet, so there is nothing to learn from on that
  basis. The agent states its basis rather than substituting one quietly.
- Cohorts remain small: many read `thin`, and `college_cohort` frequently
  returns "no institution history to read". That is the honest answer for a
  214-file book across 30 universities.

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
