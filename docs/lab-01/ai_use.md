# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5), via the Claude Code CLI.

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read all Lab 1 files (labsheet, glossary, cheat sheet, starter scaffold) in full detail and plan the steps to do all the tasks. | Used it to build a complete implementation roadmap covering all 4 Issues, the Git Flow, and the docs/submission requirements before writing any code. |
| 2 | Create a GitHub repo connection for the project. | Initialized the local git repo, added the `origin` remote, and worked through GitHub authentication (Git Credential Manager) to push `main`. |
| 3 | Merge the GitHub auto-generated README with the starter scaffold's README. | Resolved the trivial merge conflict, keeping the scaffold's `# TokTickIT` title. |
| 4 | Auto-continue the setup and Issue 1 work without asking for approval at every step, stopping only where peer review is required. | Stood up PostgreSQL via Docker, installed client/server dependencies, verified the frontend builds and backend boots, ran the test suites, and fixed a scaffold bug (`tsc` emitting stray `.js` files next to `.tsx`/`.ts` sources because `client/tsconfig.json` was missing `noEmit`). |
| 5 | Write README setup instructions per Issue 1's acceptance criteria. | Documented prerequisites, Docker Postgres setup, client/server install & run steps, testing commands, and env var handling. |
| 6 | Implement Issue 3: add the Prisma Category model, run the migration, and write an idempotent seed. | Added the model exactly as specified in the labsheet, ran `prisma migrate dev --name init`, implemented the seed with `prisma.category.upsert`, and verified idempotency by running it twice and checking the row count stayed at 4. |

## Reflection
Early prompts worked best when I first had the assistant read every requirement document literally
before planning, which avoided speculative or out-of-scope work later. The main correction needed was
security-related: I initially misunderstood that pasting a GitHub Personal Access Token into the chat
was safe — the assistant flagged it immediately and had it revoked, which was the right call. The
`tsconfig.json` `noEmit` bug was something the agent caught on its own by actually running the build,
not something I would have known to ask about in advance.
