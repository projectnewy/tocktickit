# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5), via the Claude Code CLI.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read the Lab 2 labsheet in full detail; understand the requester ticketing MVP scope, Spec-DD requirements, and grading breakdown before planning. | Identified that 30/60 points are process/documentation, and that `specification.md` must exist before implementation PRs (Part 2) — this drove the whole build order. |
| 2 | Explore the existing Lab 1 codebase (server and client) to find exact patterns already in use — Prisma setup, test conventions, API shape, import style — before designing anything new. | Ran two parallel research agents to read every real file; used the findings (`.js`-extension ESM imports, `getPrisma()` lazy singleton, `vi.spyOn` test pattern, no validation/upload libs installed) as hard constraints on the design instead of guessing. |
| 3 | Design the full technical approach: Prisma schema, ticket-number generation strategy, server architecture refactor, file upload design, API contract, client architecture, test strategy, and dependencies — with tradeoffs justified, not just decisions stated. | Produced a full design covering all of the above; adopted it into the sprint specification with the reasoning kept (e.g. why a header instead of a cookie for requester context, why 404 instead of 403 for cross-requester access, why a counter table instead of `MAX()+1`). |
| 4 | Write `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` per the labsheet's required sections, then set up GitHub Issues and the Project board for the sprint decomposition. | Produced all four documents with numbered FR/BR/AC, a 38-row planned-test table with AC traceability, the full Zen Green UI spec, and the complete 12-endpoint API contract — committed and PR'd before any implementation branch, per Part 2's requirement. Created 10 Issues (spec + 9 implementation areas) and added them to the board. |
| 5 | Implement Issue 6: schema, migrations, seed data, the ticket-number generator, and a dedicated test-DB harness. | Added `RequesterUser`/`Ticket`/`Attachment`/`RelatedSystem`/`TicketCounter` to `schema.prisma`; built `nextTicketNumber()` (row-locked `INSERT ... ON CONFLICT`) with a unit test firing 20 concurrent calls — 20 distinct numbers, passed first try; set up `.env.test`, `resetDb()`, and idempotent `seedReference()`/`seedDemoTickets()`. |
| 6 | Implement Issues 7–8: refactor `app.ts` into routers/services, add reference endpoints, then build the tickets API (create/list/detail) with ownership and query validation. | Kept `/api/health` and `/api/categories` byte-identical (verified via `curl` against the built `dist/` app). The test suite caught a real bug: mounting `requesterContext` as bare router-level middleware made it fire on an unrelated 404 route (401 instead of 404) — fixed by mounting at a `/tickets` path prefix. |
| 7 | Implement Issue 9: attachments API — multer upload with magic-byte verification, the 5-active-attachment cap under concurrency, soft removal, ownership-gated download. | 21 new tests passing first run, including cross-requester rejection on all 5 operations. Manual `curl -F` verification hit an unrelated environment snag (MSYS `curl` can't resolve `/tmp/...` for `-F file=@...`) that looked like a server bug until isolated to the test file's path. |
| 8 | Implement Issue 10: client router shell, `RequesterContext` with localStorage persistence/re-validation, Zen Green `theme.css`, and the Requester Selection screen. | Moved Lab 1's `App.tsx` body verbatim into `pages/SystemCheck.tsx` so the router shell didn't break the 3 existing tests. Opened the app in a real browser and confirmed the header's *computed* background color is exactly `rgb(0, 107, 60)` — not just that a CSS class was present. |
| 9 | Implement Issues 11–12: Create Ticket (two-phase ticket+attachment creation) and My Tickets (URL-driven search/filter/sort/pagination, desktop table + mobile card list). | Caught two tooling gotchas via the test suite: `userEvent.upload()` silently respects the file input's `accept` attribute and drops non-matching files (switched to `fireEvent.change`); and jsdom doesn't evaluate the `d-none`/`d-lg-table` responsive classes, so both list representations exist in the test DOM at once (fixed by scoping to `within(getByRole("table"))`). Verified real submitted tickets and real search/pagination against the live backend in a browser. |
| 10 | Implement Issue 13 (Ticket Detail + Attachments) and Issue 14 (Playwright E2E at 3 viewports, screenshots, doc finalization). | Verified the literal Part 8 security evidence through the real UI: switched the selected requester via `localStorage` to someone who doesn't own a ticket and confirmed the identical safe "Ticket not found" message appears, with real `404`s in the network tab. Playwright's `e2e/` folder living outside `client/`'s `node_modules` tree broke module resolution entirely (`Cannot find module '@playwright/test'`) until a `node_modules` junction was added at the repo root. A second Playwright issue — `getByText()` matching both the hidden table row and the visible card for the same ticket, since Bootstrap only toggles CSS `display` rather than removing DOM nodes — required a viewport-aware locator helper. |

## Reflection

Early prompts worked best when the assistant read the actual Lab 1 code and the full labsheet before
proposing any design, rather than guessing at conventions — this caught real constraints (the
`.js`-extension ESM import style, the `getPrisma()` lazy singleton, `rootDir`/`include` boundaries) that
would have caused avoidable rework if assumed instead. Writing `specification.md`, `tests.md`,
`ui-spec.md`, and `api-spec.md` before any implementation branch, with reasoning kept for each
non-obvious decision, made every later branch faster to build and review because the hard calls were
already made and justified once instead of re-litigated per PR.

The automated test suite and live manual verification each caught real, non-obvious bugs neither of us
would have thought to check for in advance: a middleware mounted unprefixed silently intercepting an
unrelated route (caught by a test written for a completely different case), `userEvent.upload()`
silently honoring the `accept` attribute, jsdom not evaluating responsive CSS classes so two "hidden"
list representations both matched a query, and a Playwright module-resolution failure from `e2e/` living
outside any `node_modules` tree. None of these were things I would have known to ask about — they only
surfaced from actually running the build, the tests, and the app itself, which is exactly the discipline
the labsheet's "no fabricated evidence" rule is asking for. The one thing I'd flag for next time: I let
the AI-use prompt log grow past the labsheet's stated 6–10 range mid-sprint (it reached 15 entries before
being consolidated at the end) — worth trimming as I go next time rather than as a final cleanup pass.
