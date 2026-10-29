# Lab 4 Test Plan

## Test Levels
Unit (action field rules, resolution gate, dashboard time window, label helpers), API/integration (Supertest
against `toktickit_test`, same harness as Labs 2–3), UI component (Vitest + Testing Library), UI style
(structural assertions: focus ring, labels, badges, form-state markup), responsive and keyboard/accessibility
(Playwright at desktop/tablet/mobile), authorization (direct API calls per role, no UI), workflow and
concurrency (stale updates, resolution gate), migration/regression (Lab 1–3 suites re-run, migration applied to
a copy of Lab 3 data), performance-smoke (dashboards on a larger seeded dataset), and end-to-end (Playwright).
Tests are written alongside or before the code they cover (TDD for rules, gates, and metrics). **Final**
status is `Pending` until the commands in "Final status" have been run and their output captured.

## Planned Test Matrix

| ID | Type | Req / AC | What it tests | Expected result | Automated test file | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-07, AC-05 | Action field rules: description length, result required when Completed, follow-up note required only when follow-up is true, future date rejected for Completed | Valid inputs pass; each violation reports the right field | `server/tests/lab-04/actionRules.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-06, BR-10 | Action status transition table (all 9 pairs) | Only Planned→Completed/Cancelled allowed | `server/tests/lab-04/actionRules.unit.test.ts` | Pending |
| UNIT-03 | Unit | BR-14, AC-10 | Resolution gate evaluator over (completed, planned) counts | Passes only with ≥1 completed and 0 planned; reports `unmet` reasons | `server/tests/lab-04/resolutionGate.unit.test.ts` | Pending |
| UNIT-04 | Unit | BR-13 | Final status matrix, all 8×8 pairs vs an independent copy of the spec table | Only the 12 listed pairs allowed | `server/tests/lab-04/ticketTransitions.unit.test.ts` | Pending |
| UNIT-05 | Unit | BR-23 | Dashboard window: Bangkok day boundary, `windowStart` for several instants incl. 00:00/23:59 Bangkok and UTC rollover | Correct start; 7 inclusive days | `server/tests/lab-04/dashboardWindow.unit.test.ts` | Pending |
| UNIT-06 | Unit | FR-18 | Label helpers for Status/Priority/Role | Every enum value maps to a friendly label; unknown value falls back safely | `client/tests/lab-04/labels.test.ts` | Pending |
| API-01 | API | AC-01, BR-01 | Create valid Action Taken on an Open Ticket | 201; saved under the Ticket with authenticated `createdBy` and assignee | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-02 | API | BR-02, FR-06 | A non-owner IT Staff creates and completes an action on another staff member's Ticket | Succeeds; `performedBy` is the completer, Owner unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-03 | API | BR-09 | Client-supplied `createdBy`/`performedBy` ignored | Server-set values only | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-04 | API | AC-04, BR-04, BR-12 | List actions as owning Requester | All actions, all fields, ordered by date then id | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-05 | API | AC-04, BR-04 | List actions for another Requester's / nonexistent Ticket | Identical 404, no data | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-06 | API | AC-05, BR-07 | Missing result (Completed), missing follow-up note, bad lengths/dates | 400, nothing written | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-07 | API | AC-06, BR-08 | Inactive / Requester / nonexistent assignee on create and reassign | 422, nothing written | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-08 | API | AC-07, BR-05 | Create/update on New, Resolved, Closed, Cancelled Tickets | 409 `TICKET_NOT_ACTIONABLE` | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-09 | API | AC-08, BR-19 | Two clients update one action with the same version | Second gets 409 `STALE_VERSION`; first change preserved; version +1 | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-10 | API | AC-21, BR-21 | Same `clientRequestId` twice, and parallel creates | Exactly one row; second returns the original | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-11 | API | BR-06, BR-10 | Edit a Cancelled action; revert a Completed action; reassign a Completed action; edit a Completed action's content fields including `actionDateTime` (past ok, future rejected) | 409 `INVALID_ACTION_STATE` for status/assignee/Cancelled edits; content edits of Completed succeed | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| API-12 | API | BR-11 | DELETE on an action | 404/405, action unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| AUTHZ-01 | Authorization | AC-03, BR-03 | Requester POST/PATCH action (own and other Tickets) | 403, nothing written | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| AUTHZ-02 | Authorization | FR-12, BR-30 | Unauthenticated and password-change-required calls to every new endpoint | 401 / 403 | `server/tests/lab-04/actions-taken.api.test.ts` | Pending |
| AUTHZ-03 | Authorization | AC-17, BR-27 | Requester → staff dashboard; staff → Requester dashboard | 403 | `server/tests/lab-04/requester-dashboard.api.test.ts`, `staff-dashboard.api.test.ts` | Pending |
| WF-01 | Workflow | AC-09, BR-19 | Two staff change status/owner/priority with the same Ticket version | Second gets 409 `STALE_VERSION`; nothing changes | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-02 | Workflow | AC-09 | Concurrent claim by two staff | Exactly one wins; the other gets 409 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-03 | Workflow | AC-10, BR-14 | Resolve with no Completed action; with a Planned action; both | 409 `RESOLUTION_GATE` with correct `unmet`; status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-04 | Workflow | AC-11, BR-18 | Resolve with ≥1 Completed and 0 Planned; then Close | Succeeds; `resolvedAt` set and kept | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-05 | Workflow | BR-13 | Every invalid transition via direct API (incl. Requester) | 409 `INVALID_TRANSITION` / 403; unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-06 | Workflow | AC-12, BR-15 | Requester indicates resolved (no body, no `version`); also on Resolved/Closed/Cancelled Tickets; a staff client holding the old version then writes | Only flag changes on allowed states and the Ticket `version` increments; 409 otherwise; status never changes; the stale staff write gets 409 `STALE_VERSION` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-07 | Workflow | AC-13, BR-16 | Cancel a New/Open Ticket with Planned actions | Planned actions become Cancelled atomically | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-08 | Workflow | BR-17, BR-18 | Reopen from Resolved and from Closed | `resolvedAt` and `resolutionIndicated` cleared; Reopened | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-09 | Workflow | BR-14 | Gate under concurrency: add a Planned action while another request resolves | Never ends Resolved with a Planned action | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| WF-10 | Workflow | BR-34 | New Ticket defaults `itPriority` to `requestedPriority` | Equal at creation | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| API-20 | API | AC-02, BR-25 | Requester dashboard scoping with several Requesters' data | Only own metrics/lists | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-21 | API | AC-14, BR-26 | Staff dashboard metrics vs direct DB queries on a fixed dataset | Every count/list equals the DB result | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-22 | API | AC-15, BR-28 | Dashboards for a user/dataset with nothing | Counts 0, lists `[]`, never null/error | `server/tests/lab-04/requester-dashboard.api.test.ts`, `staff-dashboard.api.test.ts` | Pending |
| API-23 | API | AC-16, BR-29 | For each card link, query the destination list with the link's params | Destination total equals the card count | `server/tests/lab-04/staff-dashboard.api.test.ts`, `requester-dashboard.api.test.ts` | Pending |
| API-24 | API | BR-27 | Administrator gets `userCounts`; IT Staff does not | Present only for Administrator, counts correct | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pending |
| API-25 | API | BR-23 | Tickets just inside/outside the recent window | Included/excluded correctly | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pending |
| API-26 | API | FR-13 | `itPriority` filter and `updatedAt` sort on Staff Queue; `updatedAt` sort on My Tickets; invalid values | Works; invalid → 400 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pending |
| PERF-01 | Performance-smoke | BR-22 | Both dashboards with ≥300 Tickets and ≥600 actions | Responds < 1000 ms; payload lists capped at 5 | `server/tests/lab-04/dashboard-performance.api.test.ts` | Pending |
| MIG-01 | Migration | AC-19, BR-32 | Apply the Lab 4 migration to a database holding Lab 3 data | Every User/Ticket/Attachment/Comment/Note row unchanged | `server/tests/lab-04/migration.test.ts` | Pass |
| MIG-02 | Migration | AC-19, BR-18 | Backfill `resolvedAt` and `itPriority` | Resolved/Closed Tickets get `resolvedAt`; null priorities filled | `server/tests/lab-04/migration.test.ts` | Pass |
| MIG-03 | Migration | BR-32 | Legacy Tickets without actions | List returns `[]`; dashboards count them normally | `server/tests/lab-04/migration.test.ts` | Pass |
| MIG-04 | Migration | Spec §7 | Apply rollback script, re-apply migration | Earlier data intact; migration re-applies cleanly | `server/tests/lab-04/migration.test.ts` | Pass |
| MIG-05 | Migration | AC-20, FR-15 | Run the demo seed twice | No duplicates; all statuses and 0/1/many actions present | `server/tests/lab-04/migration.test.ts` | Pending |
| REGR-01..N | Regression | AC-23, FR-16 | Full Lab 1–3 API suites re-run (only `version` added to claim/priority/status calls) | All pass | `server/tests/lab-01..03/**` | Pending |
| REGR-UI | Regression | AC-23 | Full Lab 1–3 component suites re-run | All pass | `client/tests/lab-01..03/**` | Pending |
| UI-01 | UI | AC-01, FR-04 | Staff Ticket Detail Actions Taken list renders table/cards, empty state, ordering | Correct rows from mocked API | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-02 | UI | FR-01, BR-07 | Create modal: required fields, follow-up note appears/required, result required to complete | Messages below fields; no API call when invalid | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-03 | UI | BR-08, AC-06 | Assignee select lists only active staff; 422 shown inline | Correct options; inline error; data kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-04 | UI | BR-10 | Cancelled action read-only; Completed allows content fields (incl. date/time) but status/assignee read-only | Controls disabled/absent as specified | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-05 | UI | AC-04, BR-04 | Requester Ticket Detail shows all actions read-only | No add/edit/complete/cancel controls | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-06 | UI | AC-08 | 409 stale version on action save | "Changed by someone else" + Reload; data kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-07 | UI | AC-21, FR-19 | Double click Submit | One API call; button busy/disabled | `client/tests/lab-04/ActionsTaken.test.tsx` | Pending |
| UI-08 | UI | FR-07, AC-10 | Status control offers only permitted transitions; gate error shown in plain language; success refreshes summary | As specified | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pending |
| UI-09 | UI | AC-09 | 409 stale version on status/claim/priority | Message + "Reload ticket" | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pending |
| UI-10 | UI | AC-02, AC-15 | Requester dashboard cards, lists, empty states, "Waiting for You" highlight with text/icon | Correct render from mocked API | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pending |
| UI-11 | UI | AC-14, AC-15 | Staff dashboard cards, status/priority panels, lists, combined "My Planned Actions" card (count header + up to 5 items + empty text), Administrator `userCounts` card | Correct render; card only for Admin | `client/tests/lab-04/StaffDashboard.test.tsx` | Pending |
| UI-12 | UI | AC-18, FR-12, BR-30 | Navigation items and landing per role; active item indicated; wrong-role route redirects | As specified for all 3 roles | `client/tests/lab-04/RoleLanding.test.tsx` | Pending |
| UI-13 | UI | FR-13 | Dashboard card links point to the documented filtered routes | Exact hrefs | `client/tests/lab-04/StaffDashboard.test.tsx`, `RequesterDashboard.test.tsx` | Pending |
| UI-14 | UI | AC-22, BR-33 | 401 from any call | Session cleared; redirected to Login with message | `client/tests/lab-04/SessionExpiry.test.tsx` | Pending |
| UI-15 | UI | FR-21 | Dashboards: loading, forbidden, safe-failure + Retry | Distinct states, no raw error | `client/tests/lab-04/StaffDashboard.test.tsx`, `RequesterDashboard.test.tsx` | Pending |
| STYLE-01 | UI style | AC-24, FR-18 | Shared Modal: focus in, Escape closes, Tab trapped, focus restored, ARIA attributes | All hold | `client/tests/lab-04/SharedUi.test.tsx` | Pending |
| STYLE-02 | UI style | AC-24, FR-18 | Clickable rows/sortable headers keyboard-operable; `aria-sort` | Enter/Space work | `client/tests/lab-04/SharedUi.test.tsx` | Pending |
| STYLE-03 | UI style | AC-24 | No raw enum text rendered in filters, dropdowns, badges, messages | None found | `client/tests/lab-04/SharedUi.test.tsx` | Pending |
| STYLE-04 | UI style | FR-18 | Login/Change Password show below-field messages | Messages below the field, associated by `aria-describedby` | `client/tests/lab-04/SharedUi.test.tsx` | Pending |
| STYLE-05 | UI style | AC-24 | Focus-ring rule covers links, nav links, buttons, row/card buttons, modal close | Rule present for each selector | `client/tests/lab-04/SharedUi.test.tsx` | Pending |
| RESP-01 | Responsive | AC-24 | Dashboards, Actions Taken, Ticket Detail, Users at 1280/768/375 | No horizontal page scroll; no clipping/overlap | `e2e/lab-04/dashboards.spec.ts`, `actions-taken-flow.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, FR-01..03 | Staff adds a Planned action for another staff, that staff completes it; Requester sees both read-only | Flow completes; different Performed By on one Ticket | `e2e/lab-04/actions-taken-flow.spec.ts` | Pending |
| E2E-02 | E2E | AC-08, AC-21 | Two sessions edit one action; double-click Submit | Stale conflict shown; one row only | `e2e/lab-04/actions-taken-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-10, AC-11, AC-12 | Requester indicates resolved; staff blocked by gate, completes work, resolves, closes; reopen | Gate message shown; lifecycle correct | `e2e/lab-04/ticket-resolution.spec.ts` | Pending |
| E2E-04 | E2E | AC-13 | Cancel a Ticket with Planned actions | Actions become Cancelled | `e2e/lab-04/ticket-resolution.spec.ts` | Pending |
| E2E-05 | E2E | AC-14, AC-16 | Dashboard card → drill-down list total equals the card count (both roles) | Equal | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-06 | E2E | AC-18 | Login as each role lands on the right Dashboard with correct nav | As specified | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-07 | E2E | AC-22 | Delete the session cookie mid-use, then act | Redirect to Login with message | `e2e/lab-04/dashboards.spec.ts` | Pending |
| E2E-08 | E2E | AC-24 | Keyboard-only: open a Ticket from the table, open/close a modal, drill down from a card; focus visible | All operable | `e2e/lab-04/dashboards.spec.ts`, `actions-taken-flow.spec.ts` | Pending |
| E2E-09 | E2E | AC-23 | Representative Lab 1–3 flows (login, My Tickets, Ticket Detail, Attachments, Comments, Notes, Queue, Users) | Still work | `e2e/lab-02/**`, `e2e/lab-03/**` re-run | Pending |

## Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-20, UI-10 |
| AC-03 | AUTHZ-01 |
| AC-04 | API-04, API-05, UI-05 |
| AC-05 | UNIT-01, API-06, UI-02 |
| AC-06 | API-07, UI-03 |
| AC-07 | API-08 |
| AC-08 | API-09, UI-06, E2E-02 |
| AC-09 | WF-01, WF-02, UI-09 |
| AC-10 | UNIT-03, WF-03, UI-08, E2E-03 |
| AC-11 | WF-04, E2E-03 |
| AC-12 | WF-06, E2E-03 |
| AC-13 | WF-07, E2E-04 |
| AC-14 | API-21, UI-11, E2E-05 |
| AC-15 | API-22, UI-10, UI-11 |
| AC-16 | API-23, E2E-05 |
| AC-17 | AUTHZ-03 |
| AC-18 | UI-12, E2E-06 |
| AC-19 | MIG-01, MIG-02, MIG-03 |
| AC-20 | MIG-05 |
| AC-21 | API-10, UI-07, E2E-02 |
| AC-22 | UI-14, E2E-07 |
| AC-23 | REGR-01..N, REGR-UI, E2E-09 |
| AC-24 | STYLE-01..05, RESP-01, E2E-08 |

## Test files
`server/tests/lab-04/{actions-taken,ticket-workflow,requester-dashboard,staff-dashboard,dashboard-performance}.api.test.ts`,
`server/tests/lab-04/{actionRules,resolutionGate,ticketTransitions,dashboardWindow}.unit.test.ts`,
`server/tests/lab-04/migration.test.ts`,
`client/tests/lab-04/{StaffDashboard,RequesterDashboard,ActionsTaken,TicketWorkflow,RoleLanding,SessionExpiry,SharedUi}.test.tsx`
and `client/tests/lab-04/labels.test.ts`,
`e2e/lab-04/{actions-taken-flow,ticket-resolution,dashboards}.spec.ts`.

## Final status
To be filled in from the exact output of these commands once the sprint is merged and run on the final branch —
no row is marked Pass before its command output has actually been captured:
`cd server && npm test`, `npm run typecheck`, `npm run build`; `cd client && npm test`, `npx tsc --noEmit`,
`npm run build`, `npm run e2e`.
