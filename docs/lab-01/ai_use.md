# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5), via the Claude Code CLI.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read all Lab 1 files (labsheet, glossary, cheat sheet, starter scaffold) in full detail and plan the steps to do all the tasks. | Used it to build a complete implementation roadmap covering all 4 Issues, the Git Flow, and the docs/submission requirements before writing any code. |
| 2 | Create a GitHub repo connection for the project. | Initialized the local git repo, added the `origin` remote, and worked through GitHub authentication (Git Credential Manager) to push `main`. |
| 3 | Merge the GitHub auto-generated README with the starter scaffold's README. | Resolved the trivial merge conflict, keeping the scaffold's `# TokTickIT` title. |
| 4 | Stand up local PostgreSQL and install dependencies for Issue 1. | Ran a `postgres:16-alpine` Docker container matching `server/.env.example`, then ran `npm install` in both `client/` and `server/`. |
| 5 | Verify the frontend/backend actually build and boot, then fix whatever is broken for Issue 1. | Running `npm run build` on the client surfaced a scaffold bug: `client/tsconfig.json` was missing `noEmit`, so `tsc` emitted stray `.js` files next to the `.tsx`/`.ts` sources. Fixed the config and re-verified the build and startup. |
| 6 | Write README setup instructions per Issue 1's acceptance criteria, create GitHub Issues 1–4 and the required Project board, and open the PR for Issue 1. | Documented prerequisites, Docker PostgreSQL setup, client/server install and run steps, testing commands, and environment-variable handling. Installed and authenticated the `gh` CLI, created the Issues, configured the Project's Status options, and opened PR #5. |
| 7 | After PR #5 was approved and merged, act on reviewer `phittayanan`'s feedback and implement Issue 2. | Fixed the `server/tsconfig.json` `rootDir` bug that broke `npm run build && npm start`, implemented `GET /api/health`, wired the client's `checkSystem()`/`App.tsx` to display Online/Offline from the real API, and re-ran both test suites. |
| 8 | Implement Issue 3: add the Prisma Category model, run the migration, and write an idempotent seed. | Added the model exactly as specified in the labsheet, ran `prisma migrate dev --name init`, implemented the seed with `prisma.category.upsert`, and verified idempotency by running it twice and confirming the row count stayed at 4. |
| 9 | After PR #6 and PR #7 merged, implement Issue 4: GET /api/categories and wire the client to display the seeded categories. | Added the route, replaced the `describe.todo`/`it.todo` stubs with real Supertest/Vitest tests (using `vi.spyOn` on the api module for the success/error UI cases), extended `checkSystem()` to fetch categories, and verified the full stack live with `curl` against the running server. |

## Reflection

Early prompts worked best when I first had the assistant read every requirement document literally before planning, which avoided speculative or out-of-scope work later. The main correction needed was security-related: I initially misunderstood that pasting a GitHub Personal Access Token into the chat was safe — the assistant flagged it immediately and had it revoked, which was the right call. Two scaffold bugs (the client's missing `noEmit`, and the server's `rootDir` inference breaking `npm start`) were things the agent only caught by actually running the build/start commands and by reading the reviewer's real feedback, not something I would have known to ask about in advance.