# Lab 4 API Contract

Auth, cookies, and the safe error shape are unchanged from Lab 3 (`tk_session` httpOnly JWT cookie, 8h).
All endpoints below require a valid session; a user who must change their password gets 403
`Password change required` everywhere except the `/api/auth/*` endpoints (Lab 3 BR-02). Errors are always
`{ "error": "<message>", "code"?: "<CODE>" }` — never a stack trace or raw database error.

Status codes: 400 validation · 401 unauthenticated · 403 wrong role · 404 not found / not owned (identical) ·
409 conflict · 422 business-rule violation · 500 unexpected.

## Authorization matrix

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| List Actions Taken on a Ticket | own Tickets only (else 404) | any Ticket | any Ticket |
| Create / update Action Taken | 403 | yes | yes |
| Change Ticket owner, IT Priority, status | 403 | yes | yes |
| Indicate "problem appears resolved" | own Ticket only | 403 | 403 |
| Requester dashboard | yes (own data) | 403 | 403 |
| IT Staff dashboard | 403 | yes | yes (+ `userCounts`) |
| Everything from Labs 2–3 | unchanged | unchanged | unchanged |

## Actions Taken

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/tickets/:ticketId/actions` | Owner Requester, IT Staff, Admin | All Actions Taken, ordered by `actionDateTime` asc then `id` asc |
| POST | `/api/tickets/:ticketId/actions` | IT Staff, Admin | Create; 201 with the action |
| PATCH | `/api/tickets/:ticketId/actions/:actionId` | IT Staff, Admin | Update content, assignee, or status; requires `version` |

There is no DELETE endpoint (Actions Taken are append-only; cancel instead).

**Action Taken object**

```json
{
  "id": 12,
  "ticketId": 42,
  "status": "PLANNED",
  "actionDateTime": "2026-10-30T09:30:00.000Z",
  "description": "Replace the faulty access point",
  "result": null,
  "followUpRequired": true,
  "followUpNote": "Verify signal strength after 24h",
  "attachmentNotes": "See the site-survey PNG on the Ticket",
  "assignee": { "id": 17, "fullName": "Carlos Mendes" },
  "createdBy": { "id": 16, "fullName": "Priya Natarajan" },
  "performedBy": null,
  "version": 0,
  "createdAt": "2026-10-29T08:00:00.000Z",
  "updatedAt": "2026-10-29T08:00:00.000Z"
}
```

**POST body:** `description` (required, 1–2000), `actionDateTime` (ISO 8601, default now),
`assigneeId` (default = caller), `status` (`PLANNED` default, or `COMPLETED`), `result` (required when
`COMPLETED`), `followUpRequired` (default false), `followUpNote` (required when `followUpRequired`, 1–1000;
ignored/null otherwise), `attachmentNotes` (≤500), `clientRequestId` (optional UUID; a repeat on the same
Ticket returns the original action with 200).

**PATCH body:** `version` (required) plus any subset of `description`, `result`, `actionDateTime`,
`assigneeId`, `status`, `followUpRequired`, `followUpNote`, `attachmentNotes`. Rules: status may only go
`PLANNED → COMPLETED` or `PLANNED → CANCELLED`; `assigneeId` changes only while `PLANNED`; a `CANCELLED`
action accepts no changes; a `COMPLETED` action accepts content fields only. Completing sets `performedBy` to
the caller.

**Errors:** 400 invalid fields, missing `result`, missing `followUpNote` when follow-up is required, bad
`version`; 403 Requester; 404 unknown/not-owned Ticket or action not under that Ticket; 409
`STALE_VERSION` (body includes `currentVersion`), 409 `TICKET_NOT_ACTIONABLE` (BR-05), 409 `INVALID_ACTION_STATE`
(terminal action edited); 422 inactive or non-staff assignee.

## Ticket workflow (changed from Lab 3)

| Method | Path | Change |
|---|---|---|
| PATCH | `/api/staff/tickets/:id/claim` | Body `{ version, targetUserId? }`; 409 `STALE_VERSION` on mismatch |
| PATCH | `/api/staff/tickets/:id/priority` | Body `{ version, itPriority }` |
| PATCH | `/api/staff/tickets/:id/status` | Body `{ version, status }`; matrix + gate enforced |
| POST | `/api/tickets/:id/resolution-indication` | 409 unless Ticket is Open/In Progress/Waiting/Reopened |
| GET | `/api/staff/tickets/:id`, `/api/tickets/:id` | Response also includes `version` and `resolvedAt` |

`status` errors: 409 `INVALID_TRANSITION` (pair not in the matrix), 409 `RESOLUTION_GATE`
(`{ "error": "...", "code": "RESOLUTION_GATE", "unmet": ["NO_COMPLETED_ACTION","OPEN_PLANNED_ACTIONS"] }`),
409 `STALE_VERSION`. A successful response is the full updated Ticket detail (so the client refreshes the
summary status). Cancelling cancels the Ticket's Planned actions in the same transaction.

**Queue/list parameters added for drill-down:** `GET /api/staff/tickets` accepts repeated
`itPriority=LOW|MEDIUM|HIGH|URGENT` and `sort=updatedAt:asc|desc` (added to the allowlist);
`GET /api/tickets` accepts `sort=updatedAt:asc|desc`. Invalid values are 400, never coerced.

## Dashboards

Both return concise JSON (no Ticket collections beyond the capped lists) and echo
`"timeZone": "Asia/Bangkok"` and `"windowStart"` (ISO, 00:00 Bangkok six days ago). Ticket list items are
`{ id, ticketNumber, summary, status, itPriority, updatedAt, owner? }`.

### `GET /api/dashboard/requester` (Requester only)

```json
{
  "timeZone": "Asia/Bangkok",
  "windowStart": "2026-10-23T17:00:00.000Z",
  "openTickets": { "count": 4, "link": "/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED" },
  "waitingForRequester": { "count": 1, "link": "/tickets?status=WAITING_FOR_REQUESTER" },
  "recentlyUpdated": { "items": [], "link": "/tickets?sort=updatedAt:desc" },
  "recentlyResolved": { "items": [], "link": "/tickets?status=RESOLVED&status=CLOSED&sort=updatedAt:desc" }
}
```

Calculations: BR-25. Counts and lists only ever include Tickets whose requester is the session user.

### `GET /api/dashboard/staff` (IT Staff, Administrator)

```json
{
  "timeZone": "Asia/Bangkok",
  "windowStart": "2026-10-23T17:00:00.000Z",
  "unassigned": { "count": 3, "link": "/staff/tickets?ownerId=unassigned&status=NEW" },
  "ownedByMe": { "count": 5, "link": "/staff/tickets?ownerId=me&status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED" },
  "byStatus": [ { "status": "OPEN", "count": 4, "link": "/staff/tickets?status=OPEN" } ],
  "byItPriority": [ { "itPriority": "URGENT", "count": 2, "link": "/staff/tickets?itPriority=URGENT&status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED" } ],
  "urgentTickets": { "items": [] },
  "recentlyUpdated": { "items": [], "link": "/staff/tickets?sort=updatedAt:desc" },
  "myPlannedActions": { "count": 2, "items": [ { "id": 12, "ticketId": 42, "ticketNumber": "TKT-2026-000042", "description": "…", "actionDateTime": "…" } ] },
  "userCounts": { "REQUESTER": 4, "IT_STAFF": 3, "ADMINISTRATOR": 1, "inactive": 2 }
}
```

`userCounts` is present only for an Administrator. Calculations: BR-26/BR-27. `byStatus` lists all five
active statuses (count 0 included) and `byItPriority` all four priorities, so empty states are explicit.
Drill-down `link` values are relative app routes; the destination total equals `count` (BR-29).

Errors: 401, 403 (wrong role), 500 with the safe shape; a database failure never returns partial metrics.

## Seed and health
`GET /api/health` is unchanged. Seed behavior and migration are specified in `specification.md` §7.
