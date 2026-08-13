# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| Test File | Tool | Test Description | Result |
|---|---|---|---|
| API-01 | Supertest | Health endpoint returns 200 and expected JSON | Passing |
| API-02 | Supertest | Categories endpoint returns the four seeded categories | Pending (Issue 3 + 4) |
| UI-01 | Vitest | TokTickIT heading renders | Passing |
| UI-02 | Vitest | Loading state changes to category list | Pending (Issue 4) |
| UI-03 | Vitest | API failure displays a useful error message | Pending (Issue 4) |

## Passing terminal output (as of Issue 2)

`cd server && npm test`
```
> toktickit-server@1.0.0 test
> vitest run

 ↓ tests/lab-01/categories.test.ts (1 test | 1 skipped)
 ✓ tests/lab-01/health.test.ts (1 test) 18ms

 Test Files  1 passed | 1 skipped (2)
      Tests  1 passed | 1 todo (2)
```

`cd client && npm test`
```
> toktickit-client@1.0.0 test
> vitest run

 ✓ tests/lab-01/App.test.tsx (3 tests | 2 skipped) 22ms

 Test Files  1 passed (1)
      Tests  1 passed | 2 todo (3)
```

`categories.test.ts` (API-02) and the two Issue-4 UI tests (UI-02/UI-03) remain `.todo` until Issues 3
and 4 are implemented; this table and the output above will be updated again once they pass.
