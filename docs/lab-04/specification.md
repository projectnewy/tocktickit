# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal
Complete the core TokTickIT service-desk workflow: IT Staff and Administrators record Actions Taken under a
Ticket, the Ticket lifecycle (including a backend-enforced resolution gate) is finalized, Requesters and IT
Staff get concise role-appropriate dashboards, and the whole application is hardened so every Lab 1–3
behavior keeps working under one coherent Zen Green UI.

## 2. Stakeholder Request Interpretation
The service desk needs a reliable way to plan and track the actual work on a Ticket. Each Ticket gets many
Actions Taken lines; the primary Ticket Owner still coordinates the Ticket, but any IT Staff member can do
and record work. A Requester can still say "the problem appears resolved", but that is only advice — IT Staff
must review the work and formally resolve the Ticket. Requesters and IT Staff each get a short dashboard that
points into the detailed screens instead of replacing them. Finally the product must be polished and safe:
two users must never silently overwrite each other, and nothing from earlier labs may regress.

## 3. Scope

**Included:** Actions Taken (create, edit, complete, cancel, assign); final Ticket status-transition matrix
and resolution gate; optimistic-concurrency (stale-update) handling; Requester dashboard; IT Staff dashboard
(reused by Administrator); role-based landing and navigation; migration, backfill, and idempotent seed;
shared accessible UI foundations; removal of obsolete/duplicate UI; README, regression, E2E, screenshots.

**Excluded (per handout §4.2):** SLA clocks/escalation/on-call/breach notifications; email/SMS/LINE/push
notifications; inventory, spare parts, purchasing, cost accounting; time-sheet billing/payroll/labor cost;
multi-level approvals and e-signatures; BI tools, custom report builders, export warehouses; multi-tenant
organizations and production-scale cloud operations; any feature not approved in this contract. Also not
included: deleting an Action Taken (it is cancelled instead), file upload on an Action Taken (Attachment
Notes is free text describing which file to look for; real files stay on the Ticket's Attachments).

## 4. Functional Requirements

- **FR-01** IT Staff/Administrator can create an Action Taken on an accessible, actionable Ticket.
- **FR-02** IT Staff/Administrator can update an Action Taken's content, assignee, and status.
- **FR-03** IT Staff/Administrator can complete or cancel a Planned Action Taken.
- **FR-04** Ticket Detail lists a Ticket's Actions Taken: IT Staff/Administrator can add/edit; the owning
  Requester sees all Actions Taken on their Ticket read-only.
- **FR-05** An action's assignee is chosen only from active IT Staff/Administrator accounts.
- **FR-06** The Ticket Owner coordinates the Ticket, but any IT Staff/Administrator may act on and record
  Actions Taken for it.
- **FR-07** IT Staff/Administrator change Ticket status only along the final transition matrix (§5.3), and a
  Ticket reaches Resolved only through the resolution gate (BR-14).
- **FR-08** A Requester can indicate "problem appears resolved"; this is advisory and never changes status.
- **FR-09** Concurrent/stale writes to a Ticket workflow field or an Action Taken are detected and rejected
  with a safe 409 instead of silently overwriting.
- **FR-10** A Requester dashboard summarizes only the authenticated Requester's Tickets.
- **FR-11** An IT Staff dashboard summarizes operational work; the Administrator uses the same dashboard plus
  concise user-account counts.
- **FR-12** Login, forced password change, and the root path land on the correct Dashboard for the user's
  role; navigation shows only permitted destinations with a clear active-page indication.
- **FR-13** Every dashboard card/count links to the detailed screen it summarizes, and the destination shows
  the same set of Tickets that the count was computed from.
- **FR-14** The migration preserves all earlier data (Users, Tickets, Attachments, Comments, Notes).
- **FR-15** The seed is idempotent and produces Tickets across all statuses/priorities, owned and unassigned,
  with zero, one, and many Actions Taken, giving both zero and non-zero dashboard metrics.
- **FR-16** All Lab 1–3 behavior (authentication, role navigation, ownership, Requester, IT Staff,
  Administrator, comments, notes, attachments, user management) continues to work.
- **FR-17** An expired or invalid session returns the user to Login with a clear message.
- **FR-18** Shared UI foundations are used everywhere: accessible modals, keyboard-operable rows/headers,
  visible focus on every interactive element, friendly labels instead of raw enum values, below-field
  validation.
- **FR-19** Repeated clicks or a network retry cannot create duplicate Actions Taken or duplicate changes.
- **FR-20** Obsolete or duplicate UI is removed (e.g. the Lab 1 `/system` page) and the README is current.
- **FR-21** Loading, empty/no-results, validation, success, forbidden, conflict, not-found, and safe-failure
  states are consistent across screens.

## 5. Business Rules

### 5.1 Actions Taken
- **BR-01** An Action Taken belongs to exactly one Ticket.
- **BR-02** The Ticket Owner coordinates the Ticket, but an Action Taken may be created, assigned to, or
  completed by a different IT Staff member.
- **BR-03** Only IT Staff and Administrator may create or change an Action Taken; a Requester never can. This
  is enforced by the backend (403), not by hiding controls.
- **BR-04** A Requester sees all fields of all Actions Taken on a Ticket they own; for a Ticket they do not
  own, or one that does not exist, the response is the same 404.
- **BR-05** An Action Taken may be created or changed only while the Ticket is Open, In Progress, Waiting for
  Requester, or Reopened; otherwise the API returns 409 `TICKET_NOT_ACTIONABLE`. (A New Ticket must be
  claimed first; Resolved/Closed/Cancelled Tickets are read-only until reopened.)
- **BR-06** Action status is Planned, Completed, or Cancelled. Allowed changes: Planned → Completed and
  Planned → Cancelled. Completed and Cancelled are terminal for status.
- **BR-07** Field rules: Description is required, 1–2000 characters; Result is required (1–2000) when
  Completed and optional (≤2000) otherwise; Action Date/Time is required and defaults to now; a Completed
  action's date/time may not be in the future (5-minute clock tolerance); Follow-Up Required is a boolean;
  Follow-up Note is required (1–1000) when Follow-Up Required is true and is discarded when false; Attachment
  Notes is optional (≤500) free text saying what file to look for.
- **BR-08** The assignee defaults to the creator, must be an active IT Staff or Administrator, and may be
  changed only while the action is Planned; an inactive or non-staff assignee is rejected with 422.
- **BR-09** `createdBy` is set automatically and never changes. `performedBy` is set automatically to the
  authenticated user who completes the action (or to the creator when created already Completed) and is empty
  until then. Clients cannot set either.
- **BR-10** A Cancelled action is read-only. A Completed action's content (description, result, follow-up,
  attachment notes) may still be corrected, but its status and assignee may not change.
- **BR-11** There is no delete endpoint; Actions Taken are append-only and are cancelled instead.
- **BR-12** Actions Taken are always returned ordered by Action Date/Time ascending, then id ascending.
- **BR-21** Create accepts an optional `clientRequestId`; a repeated create with the same id on the same
  Ticket returns the original Action Taken instead of making a second one.

### 5.2 Ownership and concurrency
- **BR-19** Tickets and Actions Taken carry an integer `version` starting at 0. Every write to an existing row
  (Ticket claim, priority, status, resolution indication; Action Taken update) must send the `version` it
  last read; a mismatch returns 409 `STALE_VERSION` with the current version, and a successful write
  increments it by 1. Creating an Action Taken does not change the Ticket's version.
- **BR-20** Claiming a New Ticket still moves it to Open implicitly (Lab 3), and only active IT Staff or
  Administrator may own a Ticket (Lab 3 BR-14/15).

### 5.3 Ticket status transitions and resolution
Final matrix (roles: IT Staff and Administrator only; a Requester never changes status):

| From | To | Gate / side effects |
|---|---|---|
| New | Open | Implicit on claim |
| New / Open | Cancelled | All Planned actions on the Ticket become Cancelled in the same transaction (BR-16) |
| Open | In Progress | — |
| In Progress | Waiting for Requester | — |
| Waiting for Requester | In Progress | — |
| In Progress / Waiting for Requester | Resolved | Resolution gate (BR-14); sets `resolvedAt` |
| Resolved | Closed | Keeps `resolvedAt` |
| Resolved / Closed | Reopened | Clears `resolvedAt` and `resolutionIndicated` (BR-17) |
| Reopened | In Progress | — |

Any other transition returns 409 `INVALID_TRANSITION` and leaves the Ticket unchanged.

- **BR-13** Only IT Staff/Administrator change status, along exactly the matrix above, enforced by the backend
  even if a client bypasses the screen.
- **BR-14** Resolution gate: a Ticket can move to Resolved only if it has at least one Completed Action Taken
  and no Planned Action Taken. The check runs on the server at write time inside a transaction with the Ticket
  row locked, so it holds even against concurrent action changes. A failure returns 409 `RESOLUTION_GATE`
  with `unmet` listing `NO_COMPLETED_ACTION` and/or `OPEN_PLANNED_ACTIONS`.
- **BR-15** A Requester's "problem appears resolved" indication only sets `resolutionIndicated`; it never
  changes status and never satisfies or bypasses the gate. It is accepted only while the Ticket is Open, In
  Progress, Waiting for Requester, or Reopened (else 409).
- **BR-16** Cancelling a Ticket cancels all its Planned actions atomically.
- **BR-17** Reopening clears `resolvedAt` and `resolutionIndicated`.
- **BR-18** `resolvedAt` is set when status becomes Resolved, kept through Closed, and cleared on reopen.

### 5.4 Dashboards
- **BR-22** Metrics are computed by the backend from authoritative data in one request. Responses contain
  counts and short lists (at most 5 Tickets each), never whole Ticket collections.
- **BR-23** Time zone is Asia/Bangkok (fixed UTC+7, no daylight saving). "Recent" means from 00:00 Bangkok
  time six days before today through now (7 calendar days inclusive); responses echo `timeZone` and
  `windowStart`.
- **BR-24** Active statuses are New, Open, In Progress, Waiting for Requester, Reopened. Open-work metrics use
  only active statuses.
- **BR-25** Requester dashboard (only Tickets whose requester is the session user): `openTickets` = count in
  active statuses; `waitingForRequester` = count in Waiting for Requester; `recentlyUpdated` = up to 5 Tickets
  updated in the window, newest first; `recentlyResolved` = up to 5 Tickets with `resolvedAt` in the window,
  newest first.
- **BR-26** IT Staff dashboard: `unassigned` = active Tickets with no owner (only New Tickets can be ownerless);
  `ownedByMe` = active Tickets owned by the current user; `byStatus` = active-ticket counts per active status;
  `byItPriority` = active-ticket counts per IT Priority (Low, Medium, High, Urgent); `urgentTickets` = up to 5
  active Urgent Tickets, newest-updated first; `recentlyUpdated` = up to 5 Tickets updated in the window;
  `myPlannedActions` = count and up to 5 of the current user's Planned actions, earliest Action Date/Time
  first.
- **BR-27** The Administrator uses the IT Staff dashboard response plus `userCounts` (active users per role and
  total inactive). A Requester calling the staff dashboard, or staff calling the Requester dashboard, gets 403.
- **BR-28** Empty behavior: counts are 0 and lists are `[]` — never null and never an error; the UI shows an
  explicit empty message.
- **BR-29** Every count with a drill-down links to an existing screen with query parameters, and the
  destination's total equals the dashboard count for that same filter.
- **BR-30** Landing: Requester → Requester Dashboard; IT Staff and Administrator → IT Staff Dashboard. A user
  cannot reach a Dashboard of another role.

### 5.5 Preserved and hardening rules
- **BR-31** All Lab 3 business rules remain in force (authentication, 404-not-403 cross-owner, Internal Notes
  never visible to Requesters, attachment limits, user-management protections).
- **BR-32** The migration never drops or rewrites earlier data; Tickets without Actions Taken behave as having
  zero actions and are counted normally by dashboards.
- **BR-33** A 401 from any API call clears the client session and redirects to Login with a message.
- **BR-34** Lab 3 BR-16 said IT Priority defaults to Requested Priority, but the implementation left it null.
  Lab 4 aligns the code with that rule: new Tickets default `itPriority` to `requestedPriority`, and the
  migration backfills existing null values the same way.

## 6. UI Specification Summary
Full detail in `ui-spec.md`. New screens: Requester Dashboard (`/dashboard`), IT Staff Dashboard
(`/staff/dashboard`), and an Actions Taken area on both Ticket Detail screens (staff: table on desktop, cards
on mobile, create/edit in the shared modal; Requester: read-only list). Navigation becomes role-aware with
Dashboard as the first item and active-page indication. Shared foundations (accessible modal, keyboard
rows/headers, visible focus everywhere, friendly status/priority/role labels, below-field validation) are
built once and reused. Ticket status controls show only permitted transitions and refresh the summary on
success. Dashboard cards have a label, a value, and an accessible drill-down action, with loading, empty,
forbidden, and safe-failure states.

## 7. Data Changes
New enum `ActionStatus { PLANNED, COMPLETED, CANCELLED }` and model `ActionTaken`:

| Field | Type | Notes |
|---|---|---|
| id | Int PK | |
| ticketId | Int FK → Ticket | cascade delete with Ticket |
| createdById | Int FK → User | immutable |
| assigneeId | Int FK → User | active staff at write time |
| performedById | Int? FK → User | set on completion |
| status | ActionStatus | default PLANNED |
| actionDateTime | DateTime | client-supplied, default now |
| description | String(2000) | required |
| result | String(2000)? | required when COMPLETED |
| followUpRequired | Boolean | default false |
| followUpNote | String(1000)? | required when followUpRequired |
| attachmentNotes | String(500)? | free text |
| clientRequestId | String? | unique per ticket (idempotent create) |
| version | Int | default 0 |
| createdAt / updatedAt | DateTime | |

`Ticket` gains `version Int @default(0)` and `resolvedAt DateTime?`.
Indexes: `ActionTaken [ticketId, actionDateTime, id]`, `[assigneeId, status, actionDateTime]`, unique
`[ticketId, clientRequestId]`; `Ticket [status, updatedAt desc]` and `[requesterId, updatedAt desc]` for
dashboard queries (existing `[ownerId, status]` is reused).

**Migration/backfill:** one additive migration — create enum and table, add the two Ticket columns, backfill
`resolvedAt = updatedAt` for Tickets already Resolved or Closed, backfill `itPriority = requestedPriority`
where null (BR-34). No existing column is dropped or altered; legacy Tickets simply have zero Actions Taken.
**Rollback/recovery:** a documented, tested down script drops the new table, enum, columns, and indexes;
because the migration is purely additive and only backfills new columns, rollback loses no earlier data.
**Seed:** `seedDemoTickets` (dev database only, guarded) adds Tickets in all statuses and priorities, owned
and unassigned, with 0/1/many Actions Taken including Planned ones for different staff, plus at least one
Requester with all-zero dashboard metrics and one with non-zero waiting/resolved metrics. Test-database
helpers never run the demo seed.

## 8. API Contract
Full detail in `api-spec.md`. New/changed endpoints: `GET/POST /api/tickets/:ticketId/actions`,
`PATCH /api/tickets/:ticketId/actions/:actionId`, `GET /api/dashboard/requester`,
`GET /api/dashboard/staff`. Changed: Ticket `claim`, `priority`, and `status` PATCH bodies now require
`version`; status enforces the resolution gate; resolution indication is restricted by Ticket status; Staff
Queue and My Tickets accept additional filters/sorts needed for drill-down (`itPriority`, `updatedAt` sort).
Errors: 400 validation, 401 unauthenticated, 403 wrong role, 404 not found/not owned, 409 conflict
(`STALE_VERSION`, `INVALID_TRANSITION`, `RESOLUTION_GATE`, `TICKET_NOT_ACTIONABLE`), 422 business-rule
violation (inactive assignee), always `{ error, code? }` — never a stack trace.

## 9. Acceptance Criteria

- **AC-01** Given a permitted IT Staff user and valid data on an actionable Ticket, when an Action Taken is
  created, then it is saved under that Ticket with the authenticated creator and the approved assignee.
- **AC-02** Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent
  Tickets owned by that Requester are returned.
- **AC-03** Given a Requester, when they call any create/update Action Taken endpoint, then the response is 403
  and nothing is written.
- **AC-04** Given a Requester who owns a Ticket, when they list its Actions Taken, then they see all of them
  and all fields; for a Ticket they do not own the response is 404.
- **AC-05** Given a Follow-Up Required action without a Follow-up Note, or a Completed action without a
  Result, when it is saved, then the API returns 400 and nothing is written.
- **AC-06** Given an inactive or non-staff assignee, when an action is created or reassigned, then the API
  returns 422.
- **AC-07** Given a Ticket that is New, Resolved, Closed, or Cancelled, when an action is created, then the API
  returns 409 `TICKET_NOT_ACTIONABLE`.
- **AC-08** Given two users who loaded the same Action Taken, when the second saves with the old `version`,
  then the API returns 409 `STALE_VERSION` and the first user's change is preserved.
- **AC-09** Given two staff members who loaded the same Ticket, when the second changes status, ownership, or
  priority with the old `version`, then the API returns 409 `STALE_VERSION` and nothing changes.
- **AC-10** Given a Ticket with no Completed action or with a Planned action, when status is set to Resolved
  (including by a direct API call), then the API returns 409 `RESOLUTION_GATE` listing what is unmet and the
  status is unchanged.
- **AC-11** Given a Ticket with a Completed action and no Planned actions, when IT Staff sets Resolved, then it
  succeeds, `resolvedAt` is set, and a Requester's earlier indication was not required for it.
- **AC-12** Given a Requester who indicates "problem appears resolved", then only `resolutionIndicated` changes
  and the status does not.
- **AC-13** Given a New or Open Ticket with Planned actions, when it is Cancelled, then all its Planned actions
  become Cancelled.
- **AC-14** Given an IT Staff user, when they open the dashboard, then the counts for unassigned, owned-by-me,
  by-status, by-IT-Priority, urgent, recent, and my Planned actions match direct database queries.
- **AC-15** Given a user with no matching data, when a dashboard is retrieved, then counts are 0 and lists are
  empty, with an explicit empty message in the UI.
- **AC-16** Given a dashboard card with a drill-down, when it is followed, then the destination list's total
  equals the card's count.
- **AC-17** Given a Requester calling the staff dashboard or staff calling the Requester dashboard, then the
  response is 403.
- **AC-18** Given each role, when they log in, then they land on their own Dashboard and see only their
  permitted navigation items with the current page indicated.
- **AC-19** Given the migration is applied to a database with Lab 3 data, then every earlier User, Ticket,
  Attachment, Comment, and Note is unchanged, Resolved/Closed Tickets have `resolvedAt`, and legacy Tickets
  show zero Actions Taken.
- **AC-20** Given the seed is run twice, then no duplicates are created and the demo data covers all statuses
  and zero/one/many Actions Taken.
- **AC-21** Given a repeated create with the same `clientRequestId`, or a double click on Submit, then exactly
  one Action Taken exists.
- **AC-22** Given an expired session, when any screen calls the API, then the user is returned to Login with a
  message.
- **AC-23** Given every Lab 1–3 acceptance scenario, when run against the Lab 4 build, then they all still pass
  (API, component, and E2E levels).
- **AC-24** Given each new or changed screen at desktop, tablet, and mobile widths, then there is no clipping,
  overlap, or horizontal page scroll, every interactive control is keyboard-operable with visible focus, modals
  trap and restore focus and close on Escape, and no raw enum value is shown.

Every AC maps to at least one planned test in `tests.md`.

## 10. Definition of Done
Every FR/BR/AC above is implemented and covered by a passing automated test run from a documented command;
every write endpoint enforces role, ownership, state, and `version` on the backend (proved by direct API
calls, not the UI); Labs 1–3 regression suites pass unchanged except the documented `version` field; the
migration is additive, backfills as specified, and its rollback is documented and tested; the seed is
idempotent; every new screen conforms to `ui-spec.md` and passes the shared UI/accessibility checklist at three
viewports, verified in a real browser; no console errors, broken links, placeholder text, or unfinished
controls remain; README setup/migration/seed/test/E2E/demo instructions are current; dashboard counts are shown
to match database queries; all PRs went `feature/*`/`docs/*` → `lab4-staging` → `main`, each reviewed and
merged by the peer reviewer; `tests.md` final status, `reviewer.md`, and `ai-use.md` are complete with real
command output.

## 11. Assumptions and Decisions
1. **Action fields beyond the handout's seven:** assignee and action status are added because the handout's
   evidence list (assign, complete, cancel, inactive-assignee rejection) requires them. "Performed by (auto)"
   is the user who completes the action; `createdBy` is tracked separately.
2. **Any IT Staff/Administrator can edit any action** (not only the creator), matching BR-02 and the
   shared-work model; the creator is preserved.
3. **Optimistic concurrency via an integer `version` sent in the request body** (not an `If-Match` header,
   not pessimistic row locks held across user think-time). Chosen because the client already sends JSON
   bodies, a 409 can show the user the current state, and no lock can be orphaned. The resolution gate is the
   exception: it is evaluated inside a short transaction with the Ticket row locked, because it depends on
   other rows (actions) that `version` on the Ticket alone cannot cover.
4. **`resolvedAt` column instead of deriving resolution time from history:** there is no status-history table
   (out of scope), and "recently resolved" must be a cheap indexed query. Cost: one nullable column and a
   backfill from `updatedAt` for already-resolved Tickets, which is the best available legacy value.
5. **`ActionStatus` is a Postgres enum, not a reference table:** the three states are fixed by the contract
   and enforced in code, so an enum gives database-level validity without extra joins.
6. **Idempotent create via `clientRequestId`:** a UI double click or network retry returns the original row;
   chosen over client-only button disabling, which cannot cover retries.
7. **Fixed UTC+7 offset for "Asia/Bangkok" day boundaries:** Thailand has no daylight saving, so no tz
   database is needed on the server.
8. **BR-34 (IT Priority default):** treated as a Lab 3 deviation fixed here, so "by IT Priority" is meaningful
   rather than mostly "Not set".
9. **Lab 3 request contract change:** `version` becomes required on claim/priority/status; existing Lab 3 tests
   are updated to send it. This is the only intentional change to an earlier API shape.
10. **Landing and Requester-only screens:** `/` and post-login/post-password-change redirects use the role
    landing (BR-30). My Tickets, Create Ticket, and Requester Ticket Detail become Requester-only routes
    (IT Staff/Administrator are redirected to their Dashboard) — in Lab 3 they were reachable by any signed-in
    role, which showed Requester screens to staff.
