# Lab 3 Test Plan

## Test Levels
Unit (password hashing, status-transition validator), API/integration (Supertest against
`toktickit_test`, same harness as Lab 2), UI component (Vitest + Testing Library), UI style (structural
Vitest assertions), responsive + E2E (Playwright, desktop/tablet/mobile), security/authorization
(direct API calls per role, asserting 401/403 without UI), migration/regression (Lab 2 test suite
re-run unchanged against the new authenticated flow).

## Planned Test Matrix (AC traceability)

| ID | Type | AC/BR | What it tests | Expected result |
|---|---|---|---|---|
| API-01 | API | AC-01 | Valid login | 200, cookie set, user+role returned |
| API-02 | API | BR-06,07 | Bad password / inactive account | 401, identical generic message both cases |
| API-03 | API | AC-02,BR-02 | mustChangePassword gate | 403 on any other endpoint until changed |
| API-04 | API | BR-09 | Password length boundary | 400 outside 8–72 chars |
| API-05 | API | AC-13,BR-10 | Logout then reuse cookie | 401 |
| API-06 | API | AC-03,BR-03 | Requester ticket list uses session identity | Only own tickets, ignores any spoofed id |
| API-07 | API | AC-06,BR-14,15 | Claim unassigned ticket | ownerId set; inactive staff rejected |
| API-08 | API | AC-07,BR-17 | Invalid status transition | 409, status unchanged |
| API-09 | API | AC-08,BR-04 | Public Comment visible to all 3 roles | 200 for Requester/Staff/Admin reads |
| API-10 | API | AC-04,AC-09,BR-04,22 | Internal Note hidden from Requester | 403 direct call; absent from Requester's ticket view |
| API-11 | API | BR-19 | Empty/whitespace comment or note | 400 |
| API-12 | API | AC-15 | Non-staff calls /api/staff/* | 403 |
| API-13 | API | AC-16 | Non-admin calls /api/admin/* | 403 |
| API-14 | API | AC-10,BR-24 | Duplicate email on create/edit | 409 |
| API-15 | API | AC-11,BR-25,26 | Self-deactivate / remove last admin | 422 both cases |
| API-16 | API | AC-12,BR-27 | Reset password sets mustChangePassword | true on next `/auth/me` |
| API-17 | API | — | Staff queue search/filter/sort/pagination | Matches Lab 2 pattern, invalid params → 400 |
| UNIT-01 | Unit | BR-17 | Status-transition validator, all matrix pairs | Valid pairs pass, all others rejected |
| UNIT-02 | Unit | BR-08 | Password hash never equals plaintext, verifies correctly | bcrypt round-trip |
| UI-01 | UI | AC-01,AC-05 | Login form states | validation, busy, failure-with-message |
| UI-02 | UI | AC-02 | Change Password form | validation, mismatch, success redirect |
| UI-03 | UI | FR-08 | Ticket Queue renders/filters | Correct rows from mocked API |
| UI-04 | UI | FR-10,11,12 | Ticket Detail staff controls | Claim/priority/status only for staff role |
| UI-05 | UI | BR-04 | Comments vs Notes render distinctly | Different container class/background asserted |
| UI-06 | UI | FR-14,15,16 | User Management list/create/edit | Correct API calls, validation messages |
| UI-07 | UI | AC-11 | Self-deactivate blocked in UI | Inline error shown, no API call for own id |
| REGR-01..N | API | AC-17,BR-29 | Full Lab 2 API suite re-run | All still pass unchanged |
| E2E-01 | E2E | AC-01,02 | Login → forced password change → app | 3 viewports |
| E2E-02 | E2E | FR-08,09,10 | Staff claims ticket, sets priority/status, comments | 3 viewports |
| E2E-03 | E2E | AC-04 | Requester cannot see Internal Notes in real browser | No note content in DOM/network response |
| E2E-04 | E2E | FR-14,15 | Admin creates user, new user logs in and is forced to change password | End-to-end across two sessions |

## Test files
`server/tests/lab-03/{auth,authorization,staff-queue,staff-ticket-detail,comments-notes,users-admin}.api.test.ts`,
`server/tests/lab-03/{password,statusTransitions}.unit.test.ts`,
`client/tests/lab-03/{Login,ChangePassword,StaffTicketQueue,StaffTicketDetail,UserManagement}.test.tsx`,
`e2e/lab-03/{authentication,staff-ticket-flow,user-administration}.spec.ts` (plus the Lab 2 regression spec,
`e2e/lab-02/requester-ticket-flow.spec.ts`, updated to authenticate via real login instead of the retired
Development Requester selector — BR-29/AC-17 applies to the E2E level too, not just the API suite).

## Final status
Captured on `feature/37-e2e-and-docs` (branched from `lab3-staging`) on 2026-09-17, from these exact commands:

- `cd server && npm test` → **165/165 passed**, 16 files (14 Lab 3 files spanning API-01..17,
  UNIT-01/UNIT-02 as their own standalone files, and REGR-01..N above, plus the unchanged Lab 1/Lab 2 suites)
- `cd server && npm run typecheck` → clean
- `cd client && npm test` → **54/54 passed**, 10 files (5 Lab 3 component files above, plus the unchanged
  Lab 1/Lab 2 suites)
- `cd client && npx tsc --noEmit` → clean
- `cd client && npm run e2e` (`playwright.config.ts`, `workers: 1` — see the file's comment: running every
  viewport project's worker concurrently against the single dev Postgres container intermittently hit
  `P1001 Can't reach database server`, confirmed transient by re-running the failed project alone;
  serializing eliminated it) → **18/18 passed** across desktop/tablet/mobile (E2E-01/02/03/04 above, plus
  the 2 Lab 2 regression tests, each × 3 viewports); screenshots captured under
  `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/` and
  `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`

UI-01..07 above are covered by the `client/tests/lab-03/*.test.tsx` files already counted in the 54; there
are no separate UI-0N-numbered test files — each ID maps to one or more `it()` blocks within the listed
files, not a 1:1 filename. UNIT-01 (`statusTransitions.unit.test.ts`) checks `staff.service.ts`'s exported
`STATUS_TRANSITIONS` table against an independently-transcribed copy of specification.md §6, for every one
of the 8×8 status pairs (65 cases, including the "CANCELLED is terminal" case). UNIT-02
(`password.unit.test.ts`) round-trips `hashPassword`/`verifyPassword` with no database involved.
