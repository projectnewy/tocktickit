# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal
Replace the temporary Development Requester selector with real authentication and role-based
authorization, and deliver the first operational IT Staff ticketing workflow and a minimalist
Administrator user-management screen — without breaking any completed Lab 2 Requester functionality.

## 2. Stakeholder Request Interpretation
The system now needs real users instead of a dev-only identity switcher. Requesters keep using the
Lab 2 ticket functions, but under their authenticated account. IT Staff need a queue to find and work
tickets: claim ownership, set IT Priority, move status forward, and communicate through Public Comments
(shared with the Requester) and Internal Notes (staff-only). Administrators need a simple screen to
create accounts, assign one role, and manage activation — not a full identity-management suite.
Authorization must be enforced by the backend; a hidden button is not a security control.

## 3. Scope

**Included:** email/password login, mandatory first-login password change, logout, role-based
navigation and server-side authorization, migration of Lab 2 Development Requesters into real Users,
Requester regression (Public Comments + "Problem Appears Resolved"), IT Staff Ticket Queue, IT Staff
Ticket Detail (ownership, IT Priority, status, Public Comments, Internal Notes), minimalist
Administrator User Management (list/create/edit/activate/deactivate/reset-password), Zen Green UI
extensions.

**Excluded (per handout §4.2):** email invitations/password-reset email, MFA, social login/SSO,
self-registration, Actions Taken, SLA/escalation/notifications, dashboards/KPI analytics, multi-tenant
orgs, production deployment changes, multiple roles per user, user deletion/bulk ops/import-export,
account-history screens, department/profile-photo management, mandatory pagination/multi-sort/multiple
simultaneous filters on the user list.

## 4. Functional Requirements

- **FR-01** A user can log in with email and password and receive an authenticated session.
- **FR-02** A user whose account requires a password change cannot reach any other screen until a new
  password is saved.
- **FR-03** A user can log out, which invalidates the authenticated session immediately.
- **FR-04** An authenticated user's navigation shows only the destinations permitted for their role.
- **FR-05** A Requester can create, list, search, filter, sort, and view their own Tickets and manage
  Attachments — identical to Lab 2, scoped to their authenticated identity.
- **FR-06** A Requester can post a Public Comment on their own Ticket.
- **FR-07** A Requester can mark a Ticket as "Problem Appears Resolved" without changing its formal
  status.
- **FR-08** IT Staff can view a shared Ticket Queue with search, filters, sort, and pagination.
- **FR-09** IT Staff can open Ticket Detail for any Ticket, regardless of owner.
- **FR-10** IT Staff can claim an unassigned Ticket or reassign an already-assigned Ticket to themselves
  or another active IT Staff/Administrator.
- **FR-11** IT Staff can set IT Priority independently of Requested Priority.
- **FR-12** IT Staff can change Ticket status along the permitted transition matrix (§6).
- **FR-13** IT Staff can post Public Comments and Internal Notes on any Ticket.
- **FR-14** An Administrator can view a searchable, role-filterable list of Users.
- **FR-15** An Administrator can create a User with one role, an initial password, and an active state.
- **FR-16** An Administrator can edit a User's name, email, role, and active state.
- **FR-17** An Administrator can set a new initial password for a User, forcing a change at next login.
- **FR-18** An Administrator cannot deactivate their own account or remove the last active Administrator.
- **FR-19** Internal Notes are never returned to a Requester, at the API level, under any request shape.
- **FR-20** Every protected screen and endpoint enforces role and ownership on the backend, independent
  of what the frontend shows or hides.

## 5. Business Rules

- **BR-01** Only an active user with a valid email+password combination may authenticate.
- **BR-02** A user marked `mustChangePassword` cannot access any endpoint except `/auth/me`,
  `/auth/change-password`, and `/auth/logout` until the password is changed.
- **BR-03** The authenticated user's identity (from the session, not a client-supplied id) determines
  ownership for every Requester operation.
- **BR-04** Public Comments are visible to the Requester who owns the Ticket, IT Staff, and
  Administrator. Internal Notes are visible only to IT Staff and Administrator.
- **BR-05** A Requester may set a "problem appears resolved" flag but cannot set Ticket status to
  Resolved or Closed directly.
- **BR-06** Failed login attempts return a generic "invalid email or password" message — never reveal
  whether the email exists.
- **BR-07** An inactive user cannot authenticate, even with correct credentials; the response is
  identical in shape to a bad-credentials response (no account-existence leak).
- **BR-08** Passwords are stored only as a bcrypt hash; plaintext is never logged, returned, or
  committed.
- **BR-09** A new password (self-change or Administrator-issued) must be 8–72 characters.
- **BR-10** Logout invalidates the auth cookie immediately; a reused cookie after logout returns 401.
- **BR-11** Email addresses are unique (case-insensitive) across all Users regardless of role.
- **BR-12** `GET /auth/me` returns the current user's id, name, email, role, and `mustChangePassword` —
  never the password hash.
- **BR-13** A Ticket's `requesterId` is fixed at creation from the authenticated Requester and never
  changes (unchanged from Lab 2, now sourced from the session instead of a header).
- **BR-14** A Ticket may have zero or one `ownerId` (IT Staff or Administrator); claiming an unassigned
  Ticket sets it, reassigning changes it, neither requires the previous owner's consent.
- **BR-15** Only active IT Staff or Administrator accounts may be set as a Ticket's owner.
- **BR-16** `requestedPriority` is fixed at creation by the Requester. `itPriority` defaults to the same
  value at creation and can only be changed afterward by IT Staff or Administrator.
- **BR-17** Ticket status transitions follow the matrix in §6; any other transition is rejected with 409.
- **BR-18** Only IT Staff or Administrator may set status to Resolved, Closed, or Reopened.
- **BR-19** A Comment or Note body is required, trimmed, and 1–2000 characters; empty/whitespace-only is
  rejected.
- **BR-20** Comments and Notes are append-only — no edit or delete endpoint exists in Lab 3.
- **BR-21** Every Comment/Note records its author and server-generated timestamp; the client cannot set
  either.
- **BR-22** A Requester requesting an Internal Note endpoint (directly, bypassing the UI) receives 403
  with no note content in the body.
- **BR-23** An Administrator creates a User with exactly one role; no multi-role assignment exists.
- **BR-24** Creating or editing a User with a duplicate (case-insensitive) email is rejected with 409.
- **BR-25** An Administrator cannot set their own account to inactive.
- **BR-26** The system rejects any operation that would leave zero active Administrators.
- **BR-27** Setting a new initial password for a User also sets `mustChangePassword = true`.
- **BR-28** Deactivating a User does not delete their historical Tickets, Comments, Notes, or ownership
  records — those remain intact and attributed.
- **BR-29** All Lab 2 Requester ownership rules (cross-requester Ticket/Attachment access → 404, upload
  limits, soft-removal) continue to apply unchanged under the new authenticated identity.

## 6. Ticket Status Transition Matrix

| From | To | Who |
|---|---|---|
| New | Open | IT Staff/Admin (implicit on claim) |
| Open | In Progress | IT Staff/Admin |
| In Progress | Waiting for Requester | IT Staff/Admin |
| Waiting for Requester | In Progress | IT Staff/Admin |
| In Progress / Waiting for Requester | Resolved | IT Staff/Admin |
| Resolved | Closed | IT Staff/Admin |
| Resolved / Closed | Reopened | IT Staff/Admin |
| Reopened | In Progress | IT Staff/Admin |
| New / Open | Cancelled | IT Staff/Admin |

Any transition not listed above is rejected (409 Conflict). A Requester's "Problem Appears Resolved"
action does not move this matrix — it sets a separate boolean flag IT Staff can see in Ticket Detail.

## 7. UI Specification Summary
Full detail in `ui-spec.md`. New screens: Login, Change Password, IT Staff Ticket Queue (desktop table +
responsive card list, same pattern as Lab 2 My Tickets), IT Staff Ticket Detail (Lab 2 Ticket Detail +
ownership/priority/status controls + Public Comments/Internal Notes sections, visually distinct —
Internal Notes get a shaded background and a "Staff only" badge so private content is never mistaken for
public), Administrator User Management (single-screen list + create/edit forms, no pagination). App
shell replaces "Selected Requester + Switch requester" with "Signed in as {name} ({role}) + Logout."

## 8. Data Changes
`RequesterUser` is renamed/extended to `User`: adds `email` (unique), `passwordHash`, `role` (enum
Requester/ItStaff/Administrator), `mustChangePassword` (boolean, default false), keeps `fullName` and
`isActive`. Existing rows become `role = Requester`; `Ticket.requesterId` keeps pointing at the same
table, so no Ticket data moves. `Ticket` gains `ownerId` (nullable FK → User) and `resolutionIndicated`
(boolean, Requester-settable). `TicketStatus` enum is redefined to New/Open/InProgress/
WaitingForRequester/Resolved/Closed/Reopened/Cancelled (replaces Lab 2's Assigned/InProgress/Resolved/
Closed/Cancelled shape). New models `Comment` and `InternalNote`: `id`, `ticketId`, `authorId`, `body`,
`createdAt`, each indexed on `[ticketId, createdAt]`. Full migration/seed decisions land in the
Authentication & Authorization Issue.

## 9. API Contract
Full detail in `api-spec.md`. New/changed endpoints: `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/me`, `POST /api/auth/change-password`; `GET /api/staff/tickets` (queue),
`GET /api/staff/tickets/:id`, `PATCH /api/staff/tickets/:id/claim`, `PATCH .../priority`,
`PATCH .../status`; `GET/POST /api/tickets/:id/comments`, `GET/POST /api/tickets/:id/notes`,
`PATCH /api/tickets/:id/resolution-indication`; `GET/POST /api/admin/users`,
`PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`. Auth via a signed, httpOnly,
`SameSite=Lax` JWT cookie (8h expiry) — chosen over a server-side session table to avoid a new stateful
model for a single-course-project scope, and over a client-stored token (localStorage) because that's
readable by any injected script (XSS exposure) where an httpOnly cookie is not.

## 10. Acceptance Criteria

- **AC-01** Given valid credentials for an active user, when they log in, then a session is established
  and `/auth/me` returns their identity and role.
- **AC-02** Given a user with `mustChangePassword = true`, when login succeeds, then every non-auth
  screen/endpoint returns 403 until a valid new password is saved.
- **AC-03** Given an authenticated Requester, when they open My Tickets, then only their own Tickets
  appear, sourced from the session identity, not any client-supplied id.
- **AC-04** Given a Requester, when they call an Internal Notes endpoint directly, then the response is
  403 with no note content.
- **AC-05** Given an inactive account, when login is attempted with correct credentials, then the
  response is indistinguishable from a bad-password response.
- **AC-06** Given an unassigned Ticket, when IT Staff claims it, then `ownerId` is set and the Queue
  reflects the new owner.
- **AC-07** Given a Ticket in a status with no valid transition to the requested target, when IT Staff
  attempts the change, then the API returns 409 and the status is unchanged.
- **AC-08** Given a Ticket, when a Requester posts a Public Comment, then IT Staff and Administrator can
  see it in Ticket Detail.
- **AC-09** Given a Ticket, when IT Staff posts an Internal Note, then the Requester's view of the same
  Ticket never includes it.
- **AC-10** Given the Administrator creates a user with an email already in use, then the request is
  rejected with 409 and no user is created.
- **AC-11** Given the sole active Administrator, when they attempt to deactivate their own account, then
  the request is rejected.
- **AC-12** Given an Administrator resets a user's password, when that user next logs in with the new
  password, then they are routed to the mandatory Change Password screen.
- **AC-13** Given a logged-out session, when a direct API call is made with the old cookie, then the
  response is 401.
- **AC-14** Given the IT Staff Queue with no matching Tickets for the current filters, then a
  distinct "no results" state is shown (not the same as a genuinely empty queue).
- **AC-15** Given a non-IT-Staff, non-Administrator user, when they call any `/api/staff/*` endpoint,
  then the response is 403.
- **AC-16** Given a non-Administrator user, when they call any `/api/admin/*` endpoint, then the
  response is 403.
- **AC-17** Given all Lab 2 Requester regression scenarios (create/list/detail/attachments, ownership
  isolation), when run against the authenticated identity instead of the header, then they all still
  pass unchanged.

## 11. Definition of Done
All FR/BR above implemented and covered by a passing automated test; every protected endpoint enforces
role+ownership server-side (verified by direct API calls, not just UI); all Lab 2 regression tests still
pass; all four Lab 3 screens conform to `ui-spec.md`; `tests.md` test files all pass from a documented
command on the final `main` branch; migration is idempotent and documented; no plaintext password
anywhere in the repo or logs; PR'd through `feature/*`/`docs/*` branches into `lab3-staging`, reviewed
and merged by the peer reviewer, never self-merged; `reviewer.md` and `ai-use.md` complete.

## 12. Assumptions and Decisions
JWT-in-httpOnly-cookie over server sessions (§9). `RequesterUser` extended in place rather than a
parallel `User` table, to avoid a second migration moving existing Ticket ownership data. IT Staff
"claim" and "reassign" are the same endpoint (`PATCH .../claim` accepts an optional target user id;
omitted = claim for self). The Requester "Problem Appears Resolved" action is a boolean flag, not a
status transition, since only IT Staff/Administrator may set Resolved/Closed per BR-18. No CSRF token
implemented — `SameSite=Lax` on the auth cookie plus same-origin-only API calls close the practical CSRF
risk for this course's local-dev deployment shape.
