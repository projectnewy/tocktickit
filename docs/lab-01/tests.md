# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| Test File | Tool      | Test Description                                       | Result  |
| --------- | --------- | ------------------------------------------------------ | ------- |
| API-01    | Supertest | Health endpoint returns 200 and expected JSON          | Passing |
| API-02    | Supertest | Categories endpoint returns the four seeded categories | Passing |
| UI-01     | Vitest    | TokTickIT heading renders                              | Passing |
| UI-02     | Vitest    | Loading state changes to category list                 | Passing |
| UI-03     | Vitest    | API failure displays a useful error message            | Passing |

## Passing terminal output (as of Issue 4 — all tests pass)

`cd server && npm test`

```text
> toktickit-server@1.0.0 test
> vitest run

 ✓ tests/lab-01/health.test.ts (1 test) 17ms
 ✓ tests/lab-01/categories.test.ts (1 test) 50ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
```

`cd client && npm test`

```text
> toktickit-client@1.0.0 test
> vitest run

 ✓ tests/lab-01/App.test.tsx (3 tests) 204ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## Live end-to-end check (Issue 4)

With the server running (`npm run dev`) against the seeded database:

```text
$ curl http://localhost:3000/api/health
{"status":"ok","service":"TokTickIT API"}

$ curl http://localhost:3000/api/categories
[{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},{"id":3,"name":"Software"},{"id":4,"name":"Network"}]
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

## Issue 4 status (category list)

* `GET /api/categories` reads via `getPrisma().category.findMany(...)`, ordered by `id`, returning `{ id, name }` pairs; 500 with a safe message on failure.
* `categories.test.ts` (API-02) now asserts the exact four seeded categories in id order — passing.
* Client `checkSystem()` now fetches both `/api/health` and `/api/categories`; `App.tsx` renders the category list on success.
* `App.test.tsx`'s two Issue-4 tests are implemented (`vi.spyOn(api, "checkSystem")` for success/failure) — both passing (UI-02, UI-03).
