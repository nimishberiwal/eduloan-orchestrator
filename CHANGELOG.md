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
