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
`client/tests/lab-03/{Login,ChangePassword,StaffTicketQueue,StaffTicketDetail,UserManagement}.test.tsx`,
`e2e/lab-03/{authentication,staff-ticket-flow,user-administration}.spec.ts`.

## Final status
To be filled in once tests are written and run on `main` — do not report Pass before the exact command
output has actually been captured.
