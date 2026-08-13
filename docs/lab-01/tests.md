# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| Test File | Tool | Test Description | Result |
|---|---|---|---|
| API-01 | Supertest | Health endpoint returns 200 and expected JSON | Pending (Issue 2) |
| API-02 | Supertest | Categories endpoint returns the four seeded categories | Pending (Issue 3 + 4) |
| UI-01 | Vitest | TokTickIT heading renders | Passing |
| UI-02 | Vitest | Loading state changes to category list | Pending (Issue 4) |
| UI-03 | Vitest | API failure displays a useful error message | Pending (Issue 4) |

## Issue 1 status (project foundation)

- `cd server && npm test` runs via Vitest/Supertest. `health.test.ts` currently **fails** (expects 200,
  route stub returns 501) — expected until Issue 2 implements the route. `categories.test.ts` is
  `describe.todo` (skipped) — expected until Issue 4.
- `cd client && npm test` runs via Vitest. The heading test (UI-01) **passes**. The two
  Issue-4 UI tests are `it.todo` (skipped) as provided by the scaffold.

This table will be updated with final passing terminal output as each Issue (2, 3, 4) is completed.
