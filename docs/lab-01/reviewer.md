# Lab 1 — Peer Review Record

**Author:** <FILL IN: your real name> — <FILL IN: your student ID> — GitHub: @projectnewy
**Peer reviewer:** <FILL IN: partner's real name> — <FILL IN: partner's student ID> — GitHub: @phittayanan

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#5](https://github.com/projectnewy/tocktickit/pull/5) | feature/1-project-foundation | Approved & merged |
| [#6](https://github.com/projectnewy/tocktickit/pull/6) | feature/2-health-check | Approved & merged |
| [#7](https://github.com/projectnewy/tocktickit/pull/7) | feature/3-category-seed | Approved & merged |
| [#8](https://github.com/projectnewy/tocktickit/pull/8) | feature/4-category-list | Approved & merged |

**Reviewer comment received (PR #5, from @phittayanan):**
Approved after independently verifying each Issue 1 acceptance criterion against the branch (not just
the description). Called out the `noEmit` fix as the most valuable part of the diff. Raised three
non-blocking follow-ups: (1) `server/tsconfig.json` had the same class of bug as the client's `noEmit`
fix — its `include` list made TypeScript infer `rootDir` as `server/`, so `npm run build && npm start`
failed with `ERR_MODULE_NOT_FOUND`; (2) `ai_use.md` had 5 prompts, the labsheet asks for 6–10; (3)
`tests.md` replaced the "paste real terminal output" instruction with prose instead of actual output.

**How I responded:** Fixed all three on `feature/2-health-check` (PR #6): added `rootDir: "src"` and
narrowed `include` to `["src"]` in `server/tsconfig.json`, verified `npm run build && npm start` now
serves `/api/health` correctly; added prompt rows to `ai_use.md`; replaced the prose in `tests.md`
with real pasted `npm test` output for both `client/` and `server/`.

**Reviewer comment received (PR #6, from @phittayanan):** Confirmed the `npm start` fix by re-running
the compiler. Raised: (1) narrowing `include` to `["src"]` silently dropped type-checking for
`prisma/` and `tests/`; (2) the thrown error message in `api.ts` was dead code since `App.tsx` caught
it with a bare `catch` and rendered its own hard-coded string; (3) the "Unable to connect" message was
inaccurate for a live-API/dead-DB case; (4) `reviewer.md` still had placeholder names and an empty
"reviewed for partner" table even though I had already reviewed and approved two of his PRs.

**How I responded:** Acknowledged the feedback; the type-checking and error-message-accuracy points
were carried forward and addressed while implementing Issue 4 (PR #8). This file's "reviewed for
partner" table (below) now records the two-way review evidence he flagged as missing.

**Reviewer comment received (PR #7, from @phittayanan):** Verified all five Issue 3 criteria against
the branch, including running the migration SQL and confirming the seed's sequential (not
`Promise.all`) upsert loop avoids nondeterministic ID ordering. Flagged a real merge conflict he tested
in advance between PR #6 and PR #7 on `docs/lab-01/ai_use.md` and `docs/lab-01/tests.md`, with a
suggested resolution order, and noted the seed's success log doesn't distinguish "created" from
"already existed" rows.

**How I responded:** Merged PR #6 first as suggested, then resolved the `ai_use.md`/`tests.md`
conflicts by keeping PR #6's pasted terminal output and appending the Issue 3 status section below it,
rather than letting either side get silently dropped.

**Reviewer comment received (PR #8, from @phittayanan):** Approved — six criteria met, five tests
green, live `curl` transcript against a seeded DB included. Flagged that both fetch failure paths in
`checkSystem()` threw the identical error string, defeating the purpose of checking health and
categories separately; that the categories route's `catch {}` silently dropped the error for logging
purposes; and that the Supertest categories test asserted hard-coded serial IDs (`1`–`4`) against the
live dev DB, which is fragile since `SERIAL` never reuses values after a delete.

**How I responded:** Acknowledged all three; these are recorded here as known non-blocking follow-ups
for the next sprint's cleanup pass.

## Pull Requests I reviewed for my partner
Partner's repo: https://github.com/phittayanan/toktickit

| PR | My comment | Partner's response |
|----|------------|---------------------|
| [toktickit#5](https://github.com/phittayanan/toktickit/pull/5) | "good job bro" (Approved) | Flagged that two of his own tests weren't actually proving anything — swapping the categories route for a hard-coded array still left every server and UI test green, so neither was truly checking data came from the DB. Fixed both in a follow-up PR (#10) with two new tests, and asked whether a test that inserts/deletes a temp row in the dev DB felt too fragile. |
| [toktickit#6](https://github.com/phittayanan/toktickit/pull/6) | "It's look good setup and works." (Approved) | Explained a design choice not obvious from the diff: `/api/health` deliberately never touches the database, only reporting that the API process is up, so the UI can distinguish "backend down" from "backend up, DB down." Asked whether that was the right call or whether health should also ping the DB. |
| [toktickit#7](https://github.com/phittayanan/toktickit/pull/7) | "It working well it pretty good." (Approved) | — |
| [toktickit#8](https://github.com/phittayanan/toktickit/pull/8) | "Last step issue for this i think you did a pretty good job." (Approved) | — |
