# Acceptance checklist (v1 — must stay green through all v2 phases)

APP-2601..2614 are hand-written seed literals. They back this checklist and the
clearance-committee demo. **Re-walk this list at every phase checkpoint**, not
just at the end.

| # | Check | How to verify |
|---|---|---|
| 1 | `npm install && npm run dev` clean; **Reset demo data** restores the seed exactly | Reset after mutating APP-2610; it returns to S10 `pending_checker` |
| 2 | Kanban shows all 14 with RAG, blocker badges, deviation/covenant/checker badges, expiry chips | Pipeline view, scan columns S01–S13 |
| 3 | **APP-2603** timeline: applicant lane green, co-applicant lane failed at eKYC | App360 → Journey timeline, Lane B KYC shows ✗ |
| 4 | **APP-2605** Validations shows `VAL-CRS-01` + `VAL-INT-06` fail messages **verbatim** with seeded values | Validations tab: similarity `0.91`, PAN "Kabir Singh" vs I-20 "Kabir Sing"; COA Δ `$1,200` |
| 5 | **APP-2608** Documents shows C1–C4 + regeneration banner; Audit contains `CHECKLIST_REGENERATED` | Documents tab banner; Audit tab entry |
| 6 | As Credit, approving **APP-2610** is blocked from self-countersign; switching role countersigns; both events audited; app advances to S11 | Countersign as Credit-Regional (blocked toast) → switch to Risk-Central → countersigns → S11 |
| 7 | **APP-2611**: forward to S13 blocked by COV-01; clearing COV-01+COV-04 unblocks; expiry chip amber | Move forward modal lists covenant failures; Covenants tab Clear |
| 8 | **APP-2612**: Tranche 2 shows failing gates; setting `endorsement_verified=true` + verifying E10 flips VAL-CRS-23/EXT-18 and enables Release | Extracted tab "flip" button → Tranches tab |
| 9 | **APP-2607** final decision routes to Committee (Risk + Admin countersign) because DEV-05 is open in Band-2 | Decision tab shows Committee; DoA chip = Committee |
| 10 | **APP-2609** PEP hit clearable only as Compliance; no role sees a skip control on S03/S08 | Move-forward modal shows "⛔ Non-overridable gate" |
| 11 | Send-back anywhere demands an SB code; customer mirror flips to the "Action needed" string | ActionBar → Send back |
| 12 | Rejecting any app updates the Analytics Pareto/funnel live | Analytics after a DECLINE |
| 13 | Role switcher hides/disables verbs exactly per the §5 matrix | Switch roles, compare ActionBar buttons |
| 14 | Every verb writes an audit event with who/role/when/from→to/reason | Audit tab after any action |

## v2 guards protecting this list

- The 14 `mkApp({...})` literals in `src/data/seed.ts` are **never edited**; new
  `Application` fields are defaulted inside `mkApp()`.
- `buildSeed()` returns legacy-first: `[...the14, ...buildBulkSeed()]`.
- Generated IDs start at `APP-2701` — no collision with `APP-26xx`.
- `matchRules()` hard-skips terminal stages, so no rule can fire on APP-2613/2614.
- `autoRunEnabled` defaults **false**: first load behaves exactly like v1.
- Destructive rule actions never auto-apply — they queue for approval.
- `roundRobinOfficer()` is left unchanged so `moveForward` still assigns the
  expected legacy officer.
