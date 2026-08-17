# Horizon Bank · EduLoan Orchestrator + Glib.money Journeys (Prototype)

Front-end-only prototype of an Education Loan origination system — Abroad
Postgraduate (US-only), ticket size up to ₹1 crore. Built for an internal
product-clearance committee. No backend, no auth, no persistence beyond
in-memory state with a demo-reset.

Two halves, one codebase and one store:

| | | |
|---|---|---|
| **Back-office dashboard** | `/console` | Queues, gates, deviations, maker-checker, SLA, audit |
| **Customer journey** | `/` | The student applies, supplies documents, tracks, acts |
| **Co-applicant portal** | `/co/:token` | The parent — own session, own consents, own documents |
| **Collateral portal** | `/security/:token` | Property owner (Tier-3 only) |
| **Assisted journey** | `/rm` | Sales officer / RM, with a handoff primitive |

The demo moment: **apply as a student → invite a parent → the parent grants
Account Aggregator consent on their own device → documents vanish from the task
list → switch to the console and find the file in the Ops queue with an audit
trail naming who did what.**

## Two bodies of work — V1 and V2

This prototype was built in two distinct commissions, and they are not the same
kind of thing. **Read [docs/VERSIONS.md](docs/VERSIONS.md) first** — it is the
short version of what each one is and how to tell them apart in the code.

| | What it is | Shipped |
|---|---|---|
| **V1** | The origination **journeys** — the surfaces people touch | `v1.0.0` |
| **V2** | **Agentic origination** — parallel agents on every upload, self-declared data with a disbursement gate, and a generated sanction pack | `v1.1.0` (item 6) + `v2.0.0` (items 1–5) |

Two traps worth knowing before you read any comment in `src/`:

- **"V2" is a body of work, not a version number.** Its sixth development
  shipped early, inside `v1.1.0`.
- **`§v2` and `§v3` in comments are the *console's* history**, not this split.
  V1 is marked `§v4`; V2 is marked `§v5` and `§Phase A`–`§Phase E`.

The V2 build record, including the sixteen defects found while building it, is
in [docs/V2-BUILD-NOTES.md](docs/V2-BUILD-NOTES.md).

## Run

```bash
npm install
npm run dev      # Vite dev server — journeys at /, dashboard at /console
npm run build    # typecheck + production build

node scripts/build-standalone.mjs   # → one self-contained 0.74 MB HTML file
```

The dashboard is desktop-first (1440px reference); the journeys are mobile-first
and usable at 320px. **Reset demo data** in the console header restores the seed
exactly — 214 applications, every session and link cleared.

> **No persistence.** A page reload — including a Vite hot-reload after a source
> edit — resets everything. Don't edit source mid-walkthrough.

## Where to start reading

| Document | What it is |
|---|---|
| `HANDOFF.md` | The dashboard: map, reasoning, open items. **Read first.** |
| `HANDOFF-JOURNEYS.md` | The journeys: same, and assumes you've read the above |
| `docs/ACCEPTANCE.md` | Dashboard checklist — 14 items |
| `docs/ACCEPTANCE-JOURNEYS.md` | Journeys checklist — 18 items, plus every defect found and fixed |
| `docs/API-CONTRACT.md` | The contract for a real LOS. Documented, nothing implemented |
| `DECISIONS.md` | Every choice made where the spec was silent, and why |
| `CHANGELOG.md` | What shipped in each version, what was verified, what is open |
| `docs/RELEASING.md` | **No push without a version.** The procedure, and why |

## Stack
Vite · React 18 · TypeScript (strict) · Tailwind v3 · Zustand · lucide-react.
No router — sidebar/tab navigation. Charts are dependency-free SVG/CSS.

The internal UI is styled as a premium fintech-ops console: a dark navy nav rail
over light content surfaces, a cohesive design-token system, and consistent
component states throughout.

## What it demonstrates
- **Four independent dimensions** per application (stage · status · owner ·
  blocker) — never collapsed.
- **13-stage journey** (S01–S13) + terminals, with **parallel lanes** (Applicant
  / Co-applicant / Collateral) converging into the S07→S10 spine.
- **Document engine** — profile-driven checklist (income branch / NRI overlay /
  security construct), per-doc lifecycle, tier-flip regeneration.
- **60-rule validation catalogue** (Tier-1/2/3) rendered verbatim, with Waive
  (WARN) and Retry (EXT) actions.
- **Orchestration verbs** with the §5 role × verb transition matrix,
  **maker-checker**, an **append-only audit trail**, forward-gating, DoA bands
  and the Credit-Committee path.
- **4 views**: Pipeline (Kanban) · Queues · Application 360 (10-tab strip) ·
  Analytics (computed live).

## v2 — reviewer feedback build

| # | Feedback | Where it lives |
|---|---|---|
| 1 | CRM: email / SMS / WhatsApp / call at any stage | Global composer drawer (6 entry points) + **Comms** tab |
| 2 | Per-stage anomaly rules → actions | **Automation → Stage rules** (17 rules, incl. the two named examples verbatim) |
| 3 | Add co-applicant; waive a document | **Add co-applicant** action (DEV-10) and doc **Waive** (DEV-09) |
| 4 | "Other applicants for this course/university" | App-360 **Peers** tab, 4 cohort scopes |
| 5 | Batch mode by branch / city / amount | **Batches** view + branch × stage cross-tab |
| 6 | Value alongside counts | Every Analytics rollup shows ₹ and count |
| 7 | Export standard reports | **Reports** — 12 reports, CSV (Excel-safe BOM) + print-to-PDF |
| 8 | Rejection insights: who / when / why | **Analytics → Rejections & closures** |
| 9 | Filter every stage | Per-column filter popover on each Kanban column |
| 10 | 48h escalation to manager | **Automation → Escalation matrix**, 26-officer org hierarchy |

Portfolio: **214 applications** (the 14 curated acceptance scenarios + ~200
procedurally generated across 8 branches). The generator is deterministic, so
`Reset demo data` reproduces it exactly.

**The clock is frozen** at 2026-07-20 so ageing is deterministic. Use the
+24h / +48h control in Automation to watch an SLA trip.

## Views
- **Pipeline** — Kanban by stage, cards with tier / DoA / aging / blocker /
  deviation / covenant / checker / sanction-expiry badges, saved-filter chips.
- **Queues** — per-department work-lists, sortable, bulk nudge/reassign (Admin),
  round-robin auto-assign on forward-move.
- **Application 360** — header band (customer-facing mirror), role-filtered
  action bar, parallel-lane timeline, and the tabs: Documents · Extracted data ·
  Validations · Decision (CAM-lite) · Covenants · Tranches · Comms ·
  Integrations · Audit · Notes.
- **Analytics** — funnel + drop-off, TAT median/p90, approval rate, rejection
  Pareto, blocker split, aging RAG, DoA depth, deviations, sanction-expiry risk,
  channel conversion.

See `DECISIONS.md` for the smallest-sensible choices made where the spec left a
detail unspecified. Domain data lives in `src/data/*` kept pure and typed so a
production orchestrator can lift it unchanged.

---

## v4 — Glib.money origination journeys

Four customer-facing surfaces in front of the dashboard, feeding the same store.
**Glib.money** is the platform brand; **Horizon Bank** is the lender and appears
as a co-brand. `src/data/*` is not forked — the journeys read the same 22
buckets, 126 document templates, 73 validations and 7 consents.

**The projection** (`lib/customerTasks.ts`) is the heart: it turns that
catalogue into a short ordered list a person can finish. One task per *consent
artifact* rather than per document, uploads collapsed by bucket, documents the
bank fetches itself producing no task at all — and a live headline,
*"We've already collected 34 of 41 documents for you"*, that reconciles exactly
against the dashboard's own document-sourcing-mix analytic.

**The handoff primitive** (`lib/handoff.ts`) is what makes the assisted journey
honest. An RM may enter data, upload documents and progress a file, but may
**not** perform any act bound to the customer's identity — Aadhaar, Account
Aggregator, e-sign, NACH. Those controls render *disabled with an explanation*
and one action: hand it to the customer, in branch or by link. The audit line
then names both people.

Three things the build holds hard:

- **The customer never sees internal vocabulary** — no stage IDs, rule codes,
  bucket codes or department names. A scanner over 28 customer routes enforces
  it (see `HANDOFF-JOURNEYS.md` §7).
- **No party sees another party's documents.** Enforced inside the projection,
  proved continuously at `/__dev/tasks`.
- **The journey is not a side door.** A customer-initiated submit runs the same
  `FORWARD_GATES` as an Ops officer's move-forward; when it blocks, the customer
  sees the blocking task, never an error.

Two dev-only surfaces make this reviewable: **`/__dev/tasks`** (the projection
inspector, which goes red if isolation or the headline reconciliation ever
breaks) and the **persona switch** top-right, which jumps between Student /
Parent / Security owner / RM / Back office on the same application and carries
the tray of every invite and handoff link the prototype would have sent by SMS.
