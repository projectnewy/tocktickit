# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5), via the Claude Code CLI.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read the Lab 2 labsheet in full detail; understand the requester ticketing MVP scope, Spec-DD requirements, and grading breakdown before planning. | Used it to identify that 30/60 points are process/documentation, and that specification.md must exist before implementation PRs (Part 2) — this drove the whole build order. |
| 2 | Explore the existing Lab 1 codebase (server and client) to find exact patterns already in use — Prisma setup, test conventions, API shape, import style — before designing anything new. | Ran two parallel research agents to read every real file; used the findings (`.js`-extension ESM imports, `getPrisma()` lazy singleton, `vi.spyOn` test pattern, no validation/upload libs installed) as hard constraints on the design instead of guessing. |
| 3 | Design the full technical approach: Prisma schema, ticket-number generation strategy, server architecture refactor, file upload design, API contract, client architecture, test strategy, and dependencies — with tradeoffs justified, not just decisions stated. | Produced a full design covering all of the above; adopted it into the sprint specification with the reasoning kept (e.g. why a header instead of a cookie for requester context, why 404 instead of 403 for cross-requester access). |
| 4 | Write `docs/lab-02/specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` following the labsheet's required sections, based on the approved design. | Produced all four documents with numbered FR/BR/AC, a 38-row planned-test table with AC traceability, the full Zen Green UI spec, and the complete 12-endpoint API contract — committed and PR'd before any implementation branch, per Part 2's requirement. |
| 5 | Set up GitHub Issues for the sprint decomposition and add them to the existing Project board, mirroring the required Kanban workflow from Lab 1. | Created 10 Issues (spec + 9 implementation areas) covering schema, server refactor, tickets API, attachments API, client shell, three UI screens, and E2E/docs; added all to the board. |
| 6 | Implement Issue 6 (schema, migrations, seed data): add the new Prisma models per the approved schema design, generate the migration, and build idempotent reference + demo seed functions. | Added `RequesterUser`, `Ticket`, `Attachment`, `RelatedSystem`, `TicketCounter`, and two enums to `schema.prisma`; ran `prisma migrate dev`; refactored the seed into an importable `seedData.ts` with separate `seedReference()`/`seedDemoTickets()` functions. |
| 7 | Set up a dedicated test database and reset/reseed harness so API tests stop depending on the shared dev database, and retrofit the fragile Lab 1 `categories.test.ts` to use it. | Added `.env.test`, `dotenv-cli`-based scripts, `global-setup.ts` (migrate deploy once), and a `resetDb()` helper called from `beforeEach`; verified the existing `categories.test.ts` assertion is now genuinely deterministic instead of accidentally-true. |
| 8 | Implement the ticket-number generator as its own service and verify it's correct under concurrency, since it's the single most convincing piece of evidence in this sprint. | Implemented `nextTicketNumber()` using a row-locking `INSERT ... ON CONFLICT` against a counter table inside a transaction; wrote a unit test that fires 20 concurrent calls and asserts 20 distinct numbers — it passed on the first run. |

## Reflection

_To be completed at the end of the sprint, after all nine implementation Issues are merged, alongside a
review of what the agent caught that wouldn't have been obvious to check for in advance._
