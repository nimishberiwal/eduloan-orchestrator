# API contract — Glib.money journeys → the real LOS

**Documented, not implemented (§17).** There is no client, no `fetch`, and no
mock that pretends to be a network call anywhere in this build. This file exists
so that when the journeys are wired to a real loan origination system, the shape
of the conversation is already agreed.

Everything below is what the *front end* needs. It is deliberately silent on how
the LOS stores any of it.

---

## 0. Conventions

These four are not optional details; each one exists because the prototype
proved the front end cannot be trusted with the alternative.

### `Idempotency-Key` header, required on every POST

Every journey action can be replayed — a double-tap on a slow connection, a
browser back into a submitted form, a handoff link opened twice on two devices.
The prototype handles this with `JourneyEvent.idempotencyKey` and a
`journeyKeys` ledger in the store (§16.3). The server must do the same:

```
Idempotency-Key: CONSENT_GRANTED:APP-2901:account_aggregator:grant
```

Same key + same body ⇒ return the original response, do not re-apply.
Same key + different body ⇒ `409 Conflict`.

### The server owns the task projection

`GET /v1/applications/:id/tasks` returns the list. **The client must not
re-derive it in production.** `lib/customerTasks.ts` exists in the prototype
because there is no server; shipping that logic to a phone would mean the
customer's list and the bank's checklist could disagree after any policy change,
and the customer's copy would be a second source of truth for what is owed.

The prototype's projection is the *specification* for the server's — §10 of the
build spec plus `lib/customerTasks.ts` as the reference implementation.

### Documents upload direct to storage

The API never receives file bytes:

1. `POST /v1/applications/:id/documents/:docId/upload` returns a pre-signed URL
   and a `reference`.
2. The client PUTs the file straight to storage.
3. `POST /v1/applications/:id/documents/:docId/confirm` sends the `reference`
   plus the confirmed extraction fields.

### Webhooks flow LOS → journeys

The journeys never poll. The LOS pushes:

| Event | Fires when |
|---|---|
| `application.status_changed` | Stage, status, owner or blocker changes |
| `document.sent_back` | Ops rejects a document — becomes a send-back task |
| `sanction.issued` | S11 reached — unlocks CJ-22 |
| `tranche.released` | Money actually moves |

---

## 1. Sessions

```
POST /v1/sessions/otp
  { mobile, email, partyRole, displayName? }
  → { challengeId, expiresAt, resendAfterSec }

POST /v1/sessions/otp/verify
  { challengeId, code }
  → { sessionToken, session: { id, partyRole, appIds[] } }
  → 429 when locked, with { lockedUntil }
```

The lock belongs to the **mobile number**, not the challenge. The prototype
originally locked the challenge, and re-entering the same number minted a fresh
one — which made the "this number is locked for 15 minutes" copy a lie. Fixed in
`sessionStore.issueOtp`; the server must not repeat it.

## 2. Applications

```
POST  /v1/applications                      → { appId }
GET   /v1/applications/:id                  → full state
PATCH /v1/applications/:id                  → partial capture updates
POST  /v1/applications/:id/eligibility      → IndicativeOffer
GET   /v1/applications/:id/tasks            → CustomerTask[]  (server-computed)
POST  /v1/applications/:id/submit
POST  /v1/applications/:id/sanction/accept
POST  /v1/applications/:id/tranches/:n/request
```

`POST /submit` runs the **same forward gates** as an officer's move-forward. It
must not be a side door. When gating blocks it, return the blocking tasks, not
an error — the customer sees work to do, never a rule that failed:

```json
{ "accepted": false, "blockedBy": [ { "taskId": "...", "title": "..." } ] }
```

`POST /tranches/:n/request` **queues**. It never releases. Release stays a bank
action under maker-checker.

## 3. Consents

```
POST /v1/applications/:id/consents/:consentId/grant
  { artifact }                       → { granted, documentsFetched[] }
POST /v1/applications/:id/consents/:consentId/decline
  { reason }                         → { affectedDocuments[] }   // now manual_upload
POST /v1/applications/:id/consents/:consentId/revoke
```

Grant writes **one** audit line naming the consent, not one per document.
Decline never blocks the application.

## 4. Documents

```
POST /v1/applications/:id/documents/:docId/upload    (pre-signed, see §0)
POST /v1/applications/:id/documents/:docId/confirm
  { reference, fields, classification }
```

`fetched` and `uploaded` sit at the same standing. Neither is verification, and
the customer-facing word for both is **Received**.

## 5. Invites and handoffs

```
POST /v1/invites                     { kind, appId, name, relationship, mobile, email, channel }
                                     → { inviteId, token, expiresAt }
POST /v1/handoffs                    { appId, forParty, reason, mode, channel?, returnTo }
                                     → { handoffId, token, expiresAt }
POST /v1/handoffs/:token/complete    { underlyingEvent }
```

A handoff token authorises **exactly one act** on **exactly one application**
for **exactly one party**. It must not be exchangeable for a general session.
The completion carries both actor identities — the party who acted and the
officer who issued the link — because the audit trail has to answer *who
actually clicked this*.

## 6. Assisted

```
GET  /v1/rm/leads
POST /v1/rm/leads                    → dedupes on mobile
POST /v1/rm/leads/:id/convert        → { appId }
```

## 7. Actor block on every write

Every mutating call carries who did it:

```json
{
  "actor": {
    "kind": "co_applicant",
    "sessionId": "SES-0002",
    "viaHandoff": "HO-00001",
    "officerId": "OFF-OPS-01"
  }
}
```

`kind` is the party who *actually acted*. `officerId` alongside `viaHandoff`
names the officer who issued the link. An assisted entry is `kind: "rm"` with
`onBehalfOf`. These three cases must stay distinguishable in the audit trail —
collapsing them is how "the customer consented" becomes unprovable.

## 8. University intelligence

```
GET  /v1/applications/:id/university-brief
  → { brief } | 404 when never crawled

POST /v1/applications/:id/university-brief/crawl
  Idempotency-Key: UNIVERSITY_CRAWL:APP-2901:2026-07-21T11:00:00.000Z
  { university, universityShort, programme }
  → { brief, refreshed: boolean }
```

**The fetch is modelled in this build, not live.** There is no crawler, no HTTP
client and no mock pretending to be one: `lib/agents/university.ts` selects from
a researched corpus in `src/data/universityIntel.ts` and stamps the prototype
clock. That is not a shortcut taken under time pressure — **zero network calls is
a design constraint of this prototype, and the standalone HTML build must work
offline**, which a live crawl cannot. A real crawl therefore needs this endpoint;
the front end's half of the conversation is already the shape above.

### The server owns the 24-hour cycle

The prototype treats a brief older than **24 hours** as stale and re-crawls when
the file is opened. In production the *server* owns that TTL, for the same reason
it owns the task projection (§0): a client-side clock means two officers looking
at the same file can disagree about whether the brief in front of them is
current, and "the brief was fresh when I approved it" stops being provable.

`GET` returns whatever is on file and never crawls. `POST /crawl` is the only
thing that fetches, and it returns `refreshed: false` with the existing brief
when the TTL has not elapsed — so a client that opens a file ten times causes one
crawl, not ten. The `Idempotency-Key` carries the **TTL window**, not the
wall-clock instant; keying on the instant would make every request unique and
defeat the collapse.

### The brief is bank-only

It weighs funding cuts, leadership churn and adverse coverage about the
institution the customer is about to attend. Both endpoints must be refused to a
customer-scoped session token (§1) and to a handoff token (§5) — not filtered
down to a safe subset, refused. There is no customer-facing projection of a
university brief, and inventing one is not a small change.

This is the same rule as fraud findings, one level up: the prototype expresses it
as `FindingAudience = 'bank'` in the type system, and `/__dev/agents` asserts the
brief reaches no customer route.

### Webhook

| Event | Fires when |
|---|---|
| `university.brief_refreshed` | A crawl produced a brief that differs from the one on file |

It fires on a **material change**, not on every TTL tick — otherwise every file
emits one a day and the channel becomes noise nobody reads.

---

## Not in this contract

No endpoint lets a client set a validation to `pass`, clear a covenant, approve a
deviation, release a tranche, or change a stage other than through `/submit`.
Those are bank actions and they live in the back office.
