# Lab 2 Test Plan and Results

## 1. Test Strategy

Six levels, matching the labsheet minimum: **unit** (ticket number generator, validation schemas),
**API/integration** (Supertest against Express, against a dedicated `toktickit_test` database — not the
dev database, to keep tests deterministic and repeatable), **UI component** (Vitest + Testing Library,
mocking the API layer at the module boundary with `vi.spyOn`, following the existing Lab 1 pattern),
**UI style** (structural/semantic assertions in Vitest — class names, attributes, DOM position of error
messages — since jsdom cannot reliably resolve CSS custom properties or computed colors), **responsive**
and **E2E** (Playwright, run against the real dev server and dev database at three viewports: desktop
1280×800, tablet 768×1024, mobile 375×812).

The test database is truncated and reseeded with reference data (`resetDb()`) before every test file via
`beforeEach`, so no test — including the retrofitted Lab 1 `categories.test.ts` — depends on
accumulated state from a previous run. `server/vitest.config.ts` runs test files serially
(`fileParallelism: false`) because parallel truncation across files is not safe.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01, BR-01, BR-02 | Create a valid ticket | 201; ticket saved with status NEW; unique ticketNumber returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | BR-01 | 20 concurrent ticket creations | All 20 succeed with 201 and 20 distinct ticketNumbers | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | BR-07, BR-08, BR-09, AC-04 | Create ticket with missing/invalid fields | 400 with field-level validation details; no row created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-04 | API | BR-09 | Create ticket referencing an inactive category | 400; ticket not created | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-05 | API | BR-06, AC-03, AC-18 | Create ticket without requester context, and with an inactive requester's id | 401 in both cases | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-06 | API | FR-06, BR-10 | List tickets for the selected requester, default paging | 200; only that requester's tickets; sorted createdAt desc; correct pagination metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-07 | API | FR-07 | Search tickets by ticketNumber and by summary substring | 200; only matching tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-08 | API | FR-08 | Filter by status, category, relatedSystem, requestedPriority (individually and combined) | 200; results match filter combination exactly | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-09 | API | FR-09 | Sort by ticketNumber, summary, requestedPriority (asc/desc) | 200; items ordered correctly | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-10 | API | AC-09 | Search/filter combination matching zero tickets | 200; `items: []`, `totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-11 | API | BR-10 | Invalid query params (`page=abc`, `pageSize=10000`, unknown `sort`) | 400 for each, never silently coerced | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-12 | API | FR-10, AC-01 | Retrieve one owned ticket by id | 200; full detail incl. attachments | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-13 | API | FR-12, BR-06, BR-21, AC-03 | Retrieve a ticket owned by a different requester | 404; response body has no ticket fields | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-14 | API | AC-03 | Retrieve a ticket by a nonexistent id | 404; identical shape to the ownership-rejection case | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-15 | API | BR-13, BR-14, AC-10, AC-11 | Upload valid JPG/PNG/WEBP/PDF; upload disallowed type; upload >5MB | 201 for valid types; 415 for disallowed type; 413 for oversized | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-16 | API | BR-13 | Upload a file with an allowed extension but mismatched magic bytes | 415; file not persisted as an attachment | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-17 | API | BR-15, AC-06 | Upload a 6th active attachment to a ticket that already has 5 | 409; 6th file rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-18 | API | BR-15 | Remove one attachment then upload a new one on a full ticket | 201; slot freed by removal is reusable | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-19 | API | BR-16, BR-17, AC-07, AC-17 | Soft-remove an attachment with a reason; attempt without a reason | 200 with reason recorded when provided; 400 when reason missing | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-20 | API | BR-16, AC-07 | Download a removed attachment | 410; bytes not served | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-21 | API | FR-12, BR-06, AC-03 | Requester B attempts to view/list/download/remove Requester A's attachment | 404 for every operation; no file bytes or metadata returned | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-22 | API | FR-01 | Retrieve active categories, related systems, and development requesters | 200; inactive rows excluded from each list | `server/tests/lab-02/reference.api.test.ts` | Pass |
| UNIT-01 | Unit | BR-01 | Ticket number generator produces `TKT-<year>-<6 digits>` format | Format matches exactly; zero-padded | `server/tests/lab-02/ticketNumber.unit.test.ts` | Pass |
| UI-01 | UI | AC-13, AC-14, BR-20 | Requester Selection screen: loading, failure, empty, and populated states | Correct state rendered for each mocked API result | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-02 | UI | FR-01, FR-02 | Selecting a requester and continuing persists the selection and navigates to My Tickets | Selection stored; navigation occurs | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| UI-03 | UI | AC-01 | CreateTicket initial render shows all required fields and disabled submit until valid | Fields present; submit disabled with empty form | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-04 | UI | AC-04, BR-07, BR-08 | Submitting with missing/invalid fields shows validation messages below each field | Messages appear; no API call made | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-05 | UI | AC-01, BR-11 | Submitting a valid form shows a busy/submitting state, then success with the returned Ticket Number | Submit disabled while pending; success view shows ticketNumber | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-06 | UI | AC-05, BR-12 | API failure on submit shows a safe error and preserves entered values | Error shown; field values unchanged | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-07 | UI | AC-10, AC-11 | Selecting an invalid-type or oversized file shows a client-side rejection message | Rejection message shown; file not added to the upload list | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-08 | UI | FR-06, AC-08 | MyTickets renders a populated, paginated list with correct columns | List and pagination controls render from mocked data | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-09 | UI | FR-07, FR-08, FR-09 | Changing search/filter/sort controls updates the query and re-fetches | API called with updated query params | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-10 | UI | AC-09 | Empty list vs. no-results-from-filter render distinct messaging | Two visibly different empty states | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-11 | UI | AC-12 | Switching requester triggers a My Tickets reload | New API call fired with the new requester context | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-12 | UI | FR-10 | RequesterTicketDetail renders all ticket fields as read-only | Fields present and non-editable | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-13 | UI | AC-03 | Detail screen handles a 404 (not found / not owned) with a safe message | Error state shown, no partial data rendered | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-14 | UI | FR-11, BR-13, BR-14 | AttachmentSection: upload valid file, reject invalid type and oversized file client-side | Correct accept/reject behavior and messaging | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-15 | UI | BR-16, BR-17, AC-07, AC-17 | AttachmentSection: remove flow requires a reason and updates the list to show removed state | Dialog requires reason; removed attachment shown as inactive | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-16 | UI | BR-15, AC-06 | AttachmentSection disables upload when 5 active attachments already exist | Upload control disabled/blocked with explanatory text | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| E2E-01 | E2E | AC-01, AC-08, AC-16 | Full flow: select requester → create ticket → find it in My Tickets → open Detail, at desktop/tablet/mobile | Ticket created, located, and viewable at all 3 viewports; no horizontal scroll | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-12 | Switch requester mid-session and confirm ticket list changes | List updates to the new requester's tickets only | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-03, UI-05, E2E-01 |
| AC-02 | UI-11 (guard redirect), E2E-01 (route guard) |
| AC-03 | API-13, API-14, API-05, UI-13, E2E-02 |
| AC-04 | API-03, UI-04 |
| AC-05 | UI-06 |
| AC-06 | API-17, UI-16 |
| AC-07 | API-19, API-20, UI-15 |
| AC-08 | API-06, UI-08, E2E-01 |
| AC-09 | API-10, UI-10 |
| AC-10 | API-15, UI-07 |
| AC-11 | API-15, UI-07 |
| AC-12 | UI-11, E2E-02 |
| AC-13 | UI-01 |
| AC-14 | UI-01 |
| AC-15 | (attachment-failure-after-ticket-create path) API-01 + API-15 combined; UI covered in CreateTicket success-with-partial-failure case, added during implementation of Issue 11 |
| AC-16 | E2E-01 |
| AC-17 | API-19, UI-15 |
| AC-18 | API-05 |

## 4. Responsive and Visual Checklist

Verified via Playwright at desktop (≥992px), tablet (768–991px), and mobile (<768px) for Create Ticket,
My Tickets, and Ticket Detail:
- No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names at any size.
- My Tickets renders a table at desktop/tablet-where-practical and a card list at mobile — never a
  horizontally scrolling table.
- Touch targets (buttons, inputs, selects) are at least 44px tall on mobile.
- Zen Green primary color (`#006B3C`) verified as the actual computed background of the app header via
  `toHaveCSS`, not just a class-name assertion.
- Badge consistency for Requested Priority and Current Status checked visually against `ui-spec.md`.
- Screenshots captured to `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/` per
  viewport, compared against the approved illustrations rather than personal memory.

## 5. Test Commands

```
# server (against the dedicated test database)
cd server && npm test

# client (component tests)
cd client && npm test

# end-to-end + responsive + visual (against the real dev servers and dev database)
cd client && npx playwright test
```

## 6. Final Results

All test files pass on the final `main` branch, from the documented commands above (real pasted output,
2026-08-20):

```text
$ cd server && npm test
> toktickit-server@1.0.0 test
> dotenv -e .env.test -- vitest run

 ✓ tests/lab-02/my-tickets.api.test.ts (7 tests)
 ✓ tests/lab-02/create-ticket.api.test.ts (6 tests)
 ✓ tests/lab-02/ticket-detail.api.test.ts (4 tests)
 ✓ tests/lab-02/reference.api.test.ts (3 tests)
 ✓ tests/lab-02/attachments.api.test.ts (11 tests)
 ✓ tests/lab-02/ticketNumber.unit.test.ts (4 tests)
 ✓ tests/lab-01/health.test.ts (1 test)
 ✓ tests/lab-01/categories.test.ts (1 test)

 Test Files  8 passed (8)
      Tests  38 passed (38)
```

```text
$ cd client && npm test
> toktickit-client@1.0.0 test
> vitest run

 ✓ tests/lab-01/App.test.tsx (3 tests)
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (3 tests)
 ✓ tests/lab-02/RequesterSelection.test.tsx (5 tests)
 ✓ tests/lab-02/AttachmentSection.test.tsx (7 tests)
 ✓ tests/lab-02/MyTickets.test.tsx (7 tests)
 ✓ tests/lab-02/CreateTicket.test.tsx (7 tests)

 Test Files  6 passed (6)
      Tests  32 passed (32)
```

```text
$ cd client && npx playwright test
Running 6 tests using 3 workers

  ok 1 [mobile]  › requester-ticket-flow.spec.ts › select requester, create a ticket, find it in My Tickets, open its detail (3.1s)
  ok 2 [tablet]  › requester-ticket-flow.spec.ts › select requester, create a ticket, find it in My Tickets, open its detail (3.0s)
  ok 3 [desktop] › requester-ticket-flow.spec.ts › select requester, create a ticket, find it in My Tickets, open its detail (3.1s)
  ok 4 [tablet]  › requester-ticket-flow.spec.ts › switching requester changes the visible ticket list (AC-12) (777ms)
  ok 5 [desktop] › requester-ticket-flow.spec.ts › switching requester changes the visible ticket list (AC-12) (803ms)
  ok 6 [mobile]  › requester-ticket-flow.spec.ts › switching requester changes the visible ticket list (AC-12) (836ms)

  6 passed (8.1s)
```

**Total: 76 tests passing** (38 API/unit + 32 UI component + 6 E2E across 3 viewports), 0 skipped, 0
disabled.

## 7. Known Limitations or Deferred Tests

- Free-text search is not backed by a trigram/GIN index (see `specification.md` §7); no test asserts
  search performance at scale, only correctness at seed-data volume.
- `itPriority` and "Ticket Owner" have no dedicated tests since they are inert placeholders in Lab 2
  (no IT Staff workflow exists yet to set them).
- Concurrency testing (API-02) covers ticket-number generation only; attachment-count-limit concurrency
  (two simultaneous uploads both observing 4 active attachments) is enforced by a transactional row lock
  per `specification.md` §7 but is not separately load-tested beyond normal sequential API-17/API-18
  coverage.
