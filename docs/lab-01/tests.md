# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| Test File | Tool      | Test Description                                       | Result            |
| --------- | --------- | ------------------------------------------------------ | ----------------- |
| API-01    | Supertest | Health endpoint returns 200 and expected JSON          | Passing           |
| API-02    | Supertest | Categories endpoint returns the four seeded categories | Pending (Issue 4) |
| UI-01     | Vitest    | TokTickIT heading renders                              | Passing           |
| UI-02     | Vitest    | Loading state changes to category list                 | Pending (Issue 4) |
| UI-03     | Vitest    | API failure displays a useful error message            | Pending (Issue 4) |

## Passing terminal output (as of Issue 3)

`cd server && npm test`

```text
> toktickit-server@1.0.0 test
> vitest run

 ↓ tests/lab-01/categories.test.ts (1 test | 1 skipped)
 ✓ tests/lab-01/health.test.ts (1 test) 18ms

 Test Files  1 passed | 1 skipped (2)
      Tests  1 passed | 1 todo (2)
```

`cd client && npm test`

```text
> toktickit-client@1.0.0 test
> vitest run

 ✓ tests/lab-01/App.test.tsx (3 tests | 2 skipped) 22ms

 Test Files  1 passed (1)
      Tests  1 passed | 2 todo (3)
```

## Issue 3 status (category seed)

* `server/prisma/schema.prisma` has the `Category` model (`id`, unique `name`, `createdAt`); migration `20260813164813_init` creates the table.
* `npx tsx prisma/seed.ts` was run twice against a fresh database. Both runs printed `Seeded 4 categories.`
* `SELECT id, name FROM "Category" ORDER BY id` afterward showed exactly four rows:

  1. Account and Access
  2. Hardware
  3. Software
  4. Network
* No duplicate rows were created, confirming that the `upsert`-based seed is idempotent.
* No automated test is required for Issue 3 itself. API-02 remains pending until Issue 4 implements `GET /api/categories` so the seeded data can be read through the API.

`categories.test.ts` (API-02) and the two Issue 4 UI tests (UI-02/UI-03) remain `.todo` until Issue 4 is implemented. The table and terminal output will be updated once those tests pass.
