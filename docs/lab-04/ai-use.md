# Lab 4 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5.5), via the Claude desktop app's Code tab. It was used for the Sprint 4
specification (the documents) and for the implementation (code and tests).

Eight representative prompts are listed below, selected from the whole sprint. The complete history of Issues, commits and
pull requests is in git and in `reviewer.md`.

## Selected key prompts

| # | Prompt (summary) | What I did with the result |
|---|------------------|----------------------------|
| 1 | Read the Lab 4 labsheet and turn the UI checklist into something known up front. | The agent could not render the PDF, so it read all 11 pages through the browser pane and derived 28 checks mapped to the Issues that must satisfy them. It applied them while building each Issue, and every PR carried the per-Issue checklist. |
| 2 | Start Issue #54: add the `ActionTaken` model with an additive migration, backfill and a tested rollback. | Hand-extended the generated SQL; `migration.test.ts` rolls back, re-applies and compares every Lab 3 row. The first run failed on my own wrong assertion, which I fixed. |
| 3 | Implement the Actions Taken API from `api-spec.md`, tests first. | 36 API tests were written and run (31 failed), then the code made them pass. The version check sits inside `UPDATE ... WHERE` so two writers cannot both win. |
| 4 | (AI overstep) The agent opened docs PR #62 without saying it uses a shared Issue/PR number. | I objected; the PR was closed and its branch deleted. New rule: no unrequested branches, PRs or Issues, and say up front when an action uses a shared number. |
| 5 | Implement the workflow and the resolution gate. | Gate and action writes take the same row lock; WF-09 races them for 12 rounds and never ends Resolved with a Planned action. Seven Lab 3 tests were changed on purpose and documented. |
| 6 | (Process finding) A scripted multi-file edit silently skipped three files. | The files use CRLF line endings. The failing tests exposed it; the script was rewritten to normalise line endings and to throw when a pattern is not found. |
| 7 | Implement the Requester Dashboard (written before its tests). | To check the tests were real, I broke the ownership filter and the window comparison: 4 of 16 API tests failed, then the code was restored. |
| 8 | Final hardening with an all-screens audit (console, links, focus, scroll). | Found a real defect: every signed-out page load logged a 401. Fixed with a 200 session probe instead of hiding the console message. |

## My Reflection

**Specification agent.** I used the agent to turn the labsheet into a contract: business rules, the 8x8 status matrix, the API
shapes and a test matrix traced to acceptance criteria. It was fast and thorough, but it was not enough on its own: my reviewer
found four contradictions in the contract (for example BR-19 against Decision 9 about the version field), so a human read of the
specification was needed before any code was written. The specification paid off later, because every implementation PR could be
checked against fixed rules instead of memory.

**Coding agent.** The agent was strongest when it worked test-first and when it tried to break its own work: deliberate faults in
the dashboard filters and in the hardening audit showed the tests could really fail. It was weakest on scope and on silent
failures: it opened PR #62 that nobody asked for, a CRLF problem made a script report success while skipping three files, and it
could not fix a stopped Docker engine. I kept control by reading each PR against the specification, running the suites myself, and
recording these mistakes honestly in this file.

**What I would change.** Ask the agent to state before acting when an action uses a shared number or touches files outside the
Issue, and review the specification with my partner before the first implementation branch rather than during it.
