# Lab 2 API Contract

## 1. Requester Context

All ticket- and attachment-scoped endpoints require the header:

```
X-Requester-Id: <positive integer>
```

**Why a header, evaluated against the alternatives:** a query parameter must be repeated on every
GET/POST/DELETE, leaks into server logs and any screenshot of the URL bar, and is trivially forgotten on
one endpoint. A body field is impossible on GET and awkward on multipart uploads. A cookie/session implies
real authentication semantics — exactly the line the labsheet draws between Lab 2 and Lab 3. A single
header, set in one place (`client/src/api/client.ts`) and read in one place
(`server/src/http/requesterContext.ts`), is uniform across every verb and content type, and in Lab 3 it
is replaced by `Authorization: Bearer <token>` without touching any route, service, or ownership check.

**Missing, non-numeric, unknown, or inactive requester id → `401 { "error": "No requester selected" }`.**
This is not authentication, but it is designed to become authentication cleanly — the client's "on 401,
clear selection and redirect to /select-requester" logic is written once and survives Lab 3 verbatim.

**CORS:** a custom header triggers a preflight `OPTIONS` on every request. `cors()` is configured
explicitly with `allowedHeaders: ["Content-Type", "X-Requester-Id"]` and `exposedHeaders:
["Content-Disposition"]` (the latter needed to read the attachment filename client-side).

## 2. Endpoint Summary

| # | Method | Path | Requires context | Purpose |
|---|---|---|---|---|
| 1 | GET | `/api/health` | No | Health check (unchanged from Lab 1) |
| 2 | GET | `/api/categories` | No | Active ticket categories |
| 3 | GET | `/api/related-systems` | No | Active related systems |
| 4 | GET | `/api/requesters` | No | Active development requesters (for the selector) |
| 5 | POST | `/api/tickets` | Yes | Create a ticket |
| 6 | GET | `/api/tickets` | Yes | List the selected requester's tickets (search/filter/sort/paginate) |
| 7 | GET | `/api/tickets/:ticketId` | Yes | Retrieve one owned ticket, with its attachments |
| 8 | POST | `/api/tickets/:ticketId/attachments` | Yes | Upload an attachment to an owned ticket |
| 9 | GET | `/api/tickets/:ticketId/attachments` | Yes | List all attachments (active + removed) for an owned ticket |
| 10 | GET | `/api/attachments/:attachmentId` | Yes | Retrieve one attachment's metadata |
| 11 | GET | `/api/attachments/:attachmentId/download` | Yes | Download an active attachment's bytes |
| 12 | DELETE | `/api/attachments/:attachmentId` | Yes | Soft-remove an attachment (requires a reason) |

Endpoints 2–4 and 5–12 comfortably exceed the labsheet's ≥10-capability requirement and cover every
named capability (categories, related systems, requesters, ticket create/list/detail, attachment
upload/metadata/download/soft-removal).

## 3. Reference Endpoints

### `GET /api/categories`
- 200: `[{ "id": 1, "name": "Hardware" }, ...]` — active only, ordered by `id` ascending (unchanged
  shape from Lab 1).
- 500 on unexpected failure.

### `GET /api/related-systems`
- 200: `[{ "id": 1, "name": "Email" }, ...]` — active only, ordered by `name` ascending.
- 500 on unexpected failure.

### `GET /api/requesters`
- 200: `[{ "id": 1, "fullName": "Jennifer Anderson", "email": "jennifer.a@example.com", "department": "Sales" }, ...]`
  — **active only**, ordered by `fullName` ascending. Inactive requesters never appear here (BR-05).
- 500 on unexpected failure.

## 4. Create Ticket

### `POST /api/tickets`
Requires `X-Requester-Id`.

**Request body:**
```json
{
  "categoryId": 2,
  "relatedSystemId": 5,
  "summary": "Laptop battery drains quickly",
  "description": "The battery drains much faster than usual even when the system is idle.",
  "requestedPriority": "MEDIUM"
}
```

**Validation (400 on failure, with field-level `details`):**
- `categoryId`, `relatedSystemId`: required, must reference an active row
- `summary`: required, trimmed, 5–150 characters
- `description`: required, trimmed, 10–4000 characters
- `requestedPriority`: required, one of `LOW | MEDIUM | HIGH | URGENT`

**Success — `201`:**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "summary": "Laptop battery drains quickly",
  "description": "...",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "status": "NEW",
  "ticketDate": "2026-08-21T09:14:00.000Z",
  "requester": { "id": 3, "fullName": "Jennifer Anderson" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 5, "name": "Corporate Laptop" },
  "ticketOwner": null,
  "attachments": []
}
```

**Errors:** `400` validation or inactive-reference; `401` missing/invalid requester context; `500`
unexpected (includes ticket-number generation exhausting its retry budget).

**Ticket number generation:** inside the same database transaction as the insert,
`INSERT INTO "TicketCounter"(year,"lastNumber") VALUES ($year,1) ON CONFLICT(year) DO UPDATE SET
"lastNumber"="TicketCounter"."lastNumber"+1 RETURNING "lastNumber"` — the row-level lock this statement
takes serializes concurrent creates for the same year, so two requests can never receive the same number.
`Ticket.ticketNumber` carries a database `@unique` constraint as a backstop; a `P2002` conflict triggers
up to 3 retries before failing with `500`.

## 5. Ticket List

### `GET /api/tickets`
Requires `X-Requester-Id`.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | non-integer/≤0 → `400` |
| `pageSize` | `10 \| 20 \| 50` | `10` | any other value → `400` (allowlist, not clamped) |
| `q` | string, ≤100 chars | – | case-insensitive `contains` on `ticketNumber` and `summary` only |
| `status` | `TicketStatus`, repeatable | – | invalid value → `400` |
| `categoryId` | integer | – | – |
| `relatedSystemId` | integer | – | – |
| `requestedPriority` | `Priority`, repeatable | – | invalid value → `400` |
| `dateFrom` / `dateTo` | `YYYY-MM-DD` | – | `dateTo` is inclusive through end-of-day; malformed date → `400` |
| `sort` | allowlisted string | `createdAt:desc` | see below; anything else → `400` |

`sort` allowlist: `createdAt:desc`, `createdAt:asc`, `ticketNumber:asc`, `ticketNumber:desc`,
`requestedPriority:desc`, `requestedPriority:asc`, `summary:asc`, `summary:desc`. A single validated
parameter matched against a literal allowlist is used instead of separate `sortBy`/`sortOrder` params so
an unvalidated column name can never reach the query builder.

A `page` beyond the last page returns `200` with `items: []` and correct metadata (not an error) —
keeps the empty-state UI simple and matches standard pagination behavior.

**Success — `200`:**
```json
{
  "items": [
    {
      "id": 42, "ticketNumber": "TKT-2026-000042", "ticketDate": "2026-08-21T09:14:00.000Z",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 5, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM", "status": "NEW", "activeAttachmentCount": 1
    }
  ],
  "page": 1, "pageSize": 10, "totalItems": 14, "totalPages": 2,
  "hasPreviousPage": false, "hasNextPage": true,
  "sort": "createdAt:desc"
}
```
List items are a projection (no `description`, keeping the payload small and avoiding leaking long free
text through a list endpoint). `items` and `totalItems` are read from one `$transaction([findMany,
count])` so the total always matches the returned page.

**Errors:** `400` any invalid query parameter; `401` missing/invalid requester context.

## 6. Ticket Detail

### `GET /api/tickets/:ticketId`
Requires `X-Requester-Id`. Same shape as the `POST /api/tickets` success response, with `attachments`
populated (active and removed).

**Errors:** `400` non-numeric `ticketId`; `401` missing/invalid context; `404` — used both when the
ticket does not exist **and** when it exists but belongs to a different requester (BR-06, BR-21): the
response is byte-identical in both cases (`{ "error": "Ticket not found" }`), so no response can be used
to infer that another requester's ticket exists.

## 7. Attachments

### `POST /api/tickets/:ticketId/attachments`
Requires `X-Requester-Id`. `multipart/form-data`, single field `file`.

**Fixed rules (labsheet, non-negotiable):** allowed types JPG/JPEG/PNG/WEBP/PDF; max 5 MB; max 5
*active* attachments per ticket.

**Enforcement layers:**
1. Before the multipart body is even accepted: verify the ticket exists, is owned by the context
   requester, and currently has fewer than 5 active attachments (fail-fast, not authoritative).
2. `multer` `limits.fileSize` streams-aborts anything over 5 MB and `fileFilter` rejects any
   MIME type/extension outside the allowlist.
3. After the file is written, its first 12 bytes are checked against known magic numbers (JPEG `FF D8
   FF`, PNG `89 50 4E 47`, WEBP `RIFF...WEBP`, PDF `%PDF`) — declared `Content-Type` is client-supplied
   and not trusted alone.
4. The authoritative 5-active-attachment check happens inside a transaction that row-locks the ticket,
   so two simultaneous uploads cannot both observe "4 active" and both succeed.

**Success — `201`:**
```json
{
  "id": 7, "ticketId": 42, "originalFilename": "battery-report.pdf",
  "mimeType": "application/pdf", "sizeBytes": 182933,
  "uploadedAt": "2026-08-21T09:16:00.000Z",
  "uploadedBy": { "id": 3, "fullName": "Jennifer Anderson" },
  "isRemoved": false, "removedAt": null, "removedReason": null, "removedBy": null
}
```

**Errors:** `400` no file / malformed request; `401` missing/invalid context; `404` ticket not
found/not owned; `409` already at the 5-active limit; `413` file exceeds 5 MB; `415` disallowed type
(by declared type, extension, or magic-byte mismatch).

**On partial failure (BR-18):** the ticket itself is created independently of any attachment upload —
there is no combined create-with-files endpoint. If an upload fails, the ticket remains valid; the
client surfaces which file failed and lets the requester retry from Ticket Detail.

### `GET /api/tickets/:ticketId/attachments`
Requires `X-Requester-Id`. Returns all attachments (active and removed) for an owned ticket, same shape
as the create response, as an array. `404` if the ticket doesn't exist or isn't owned.

### `GET /api/attachments/:attachmentId`
Requires `X-Requester-Id`. Returns one attachment's metadata (same shape). `404` if it doesn't exist or
its ticket isn't owned by the context requester.

### `GET /api/attachments/:attachmentId/download`
Requires `X-Requester-Id`. On success: `200`, binary body, `Content-Type: <mimeType>`,
`Content-Disposition: attachment; filename*=UTF-8''<url-encoded originalFilename>`. Never served via
`express.static` — the route itself is the ownership and soft-removal gate.

**Errors:** `401`; `404` not found/not owned; `410 { "error": "This attachment has been removed" }` if
`removedAt` is set — bytes are never deleted from disk, only made unreachable through this route.

### `DELETE /api/attachments/:attachmentId`
Requires `X-Requester-Id`. **Request body:**
```json
{ "reason": "Wrong file" }
```
`reason` required, 1–200 characters (a fixed preset list is offered client-side per `ui-spec.md`, plus
"Other" for free text — the API accepts any non-empty string ≤200 chars, validation of the preset list
is a client concern).

**Success — `200`**, same attachment shape with `isRemoved: true`, `removedAt` set, `removedReason` and
`removedBy` populated.

**Errors:** `400` missing/empty reason; `401`; `404` not found/not owned; `409` already removed.

## 8. Status Code Reference

| Status | Meaning here |
|---|---|
| 200 | Successful retrieval, list, download, or removal |
| 201 | Ticket or attachment created |
| 400 | Invalid input — validation failure, invalid query parameter, malformed request |
| 401 | Missing, non-numeric, unknown, or inactive requester context |
| 404 | Resource not found, **or** found but not owned by the context requester (indistinguishable) |
| 409 | Conflict — 5-active-attachment limit reached, or attachment already removed |
| 410 | Attachment exists but has been removed; bytes are gone from the response, not from disk |
| 413 | Uploaded file exceeds 5 MB |
| 415 | Uploaded file's declared type, extension, or content doesn't match the allowed set |
| 500 | Unexpected server error — logged server-side, safe generic message to the client, never a stack |

## 9. Error Response Shape

All error responses share one shape:
```json
{ "error": "Human-readable summary", "details": [ { "field": "summary", "message": "Required" } ] }
```
`details` is present only for `400` validation failures; omitted otherwise. Malformed JSON bodies
(`express.json()` parse failures) are caught centrally and also return this shape rather than Express's
default HTML error page.
