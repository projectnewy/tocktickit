# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5), via the Claude Code CLI.

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read all Lab 1 files (labsheet, glossary, cheat sheet, starter scaffold) in full detail and plan the steps to do all the tasks. | Used it to build a complete implementation roadmap covering all 4 Issues, the Git Flow, and the docs/submission requirements before writing any code. |
| 2 | Create a GitHub repo connection for the project. | Initialized the local git repo, added the `origin` remote, and worked through GitHub authentication (Git Credential Manager) to push `main`. |
| 3 | Merge the GitHub auto-generated README with the starter scaffold's README. | Resolved the trivial merge conflict, keeping the scaffold's `# TokTickIT` title. |
| 4 | Stand up local PostgreSQL and install dependencies for Issue 1. | Ran a `postgres:16-alpine` Docker container matching `server/.env.example`, then `npm install` in both `client/` and `server/`. |
| 5 | Verify the frontend/backend actually build and boot, then fix whatever's broken, for Issue 1. | Running `npm run build` on the client surfaced a real scaffold bug: `client/tsconfig.json` was missing `noEmit`, so `tsc` emitted stray `.js` files next to the `.tsx`/`.ts` sources. Fixed the config and re-verified. |
| 6 | Create GitHub Issues 1–4, the Project board (with the exact Backlog/Specified/Started/PR Review/Fixing/Done columns), and open the PR for Issue 1. | Installed and authenticated the `gh` CLI (browser login, no tokens pasted in chat), then used it to create the Issues, reconfigure the Project's Status field options via a GraphQL mutation, and open PR #5. |
| 7 | After PR #5 was approved and merged, act on the reviewer's (phittayanan) feedback and implement Issue 2. | Fixed the `server/tsconfig.json` `rootDir` bug they flagged (broke `npm run build && npm start`), implemented `GET /api/health`, wired the client's `checkSystem()`/`App.tsx` to show Online/Offline based on a real API call, and re-ran both test suites to confirm nothing broke. |

## Reflection
Early prompts worked best when I first had the assistant read every requirement document literally
before planning, which avoided speculative or out-of-scope work later. The main correction needed was
security-related: I initially misunderstood that pasting a GitHub Personal Access Token into the chat
was safe — the assistant flagged it immediately and had it revoked, which was the right call. Two
scaffold bugs (the client's missing `noEmit`, and the server's `rootDir` inference breaking `npm start`)
were things the agent only caught by actually running the build/start commands and by reading the
reviewer's real feedback, not something I would have known to ask about in advance.
