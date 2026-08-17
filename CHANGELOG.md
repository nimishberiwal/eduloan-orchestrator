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
