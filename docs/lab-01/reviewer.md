# Lab 1 — Peer Review Record

**Author:** <your name> — <student id> — GitHub: @projectnewy
**Peer reviewer:** <partner name> — <student id> — GitHub: @phittayanan

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#5](https://github.com/projectnewy/tocktickit/pull/5) | feature/1-project-foundation | Approved & merged |
|    | feature/2-health-check | |
|    | feature/3-category-seed | |
|    | feature/4-category-list | |

**Reviewer comment I received (PR #5, from @phittayanan):**
Approved the PR after independently verifying each Issue 1 acceptance criterion against the branch
(not just the description) — React/TS/Vite/Bootstrap, Express/TS, Prisma datasource, Vitest/Supertest
config, `.gitignore`/secrets, and README setup steps all checked out. Called out the `noEmit` fix as
the most valuable part of the diff. Raised three non-blocking follow-ups:
1. `server/tsconfig.json` had the same class of bug as the client's `noEmit` issue — its `include`
   list made TypeScript infer `rootDir` as `server/`, so `npm run build && npm start` actually failed
   with `ERR_MODULE_NOT_FOUND` (`dist/src/index.js` vs. the `start` script's `dist/index.js`).
2. `docs/lab-01/ai_use.md` had 5 prompts; the labsheet asks for 6–10.
3. `docs/lab-01/tests.md` replaced the "paste real terminal output" instruction with prose instead of
   actual output.

**How I responded:** Fixed all three on the `feature/2-health-check` branch (see PR for that Issue):
added `rootDir: "src"` and narrowed `include` to `["src"]` in `server/tsconfig.json`, verified
`npm run build && npm start` now serves `/api/health` correctly; added prompt rows 6–7 to
`docs/lab-01/ai_use.md`; replaced the prose in `docs/lab-01/tests.md` with real pasted `npm test`
output for both `client/` and `server/`.

## Pull Requests I reviewed for my partner
| PR | My comment | Partner's response |
|----|------------|---------------------|
|    |            |                     |
