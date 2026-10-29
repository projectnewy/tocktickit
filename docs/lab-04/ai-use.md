# Lab 4 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5.5), via the Claude desktop app's Code tab.

This file is updated per Issue. Entries so far cover the Issue #53 review and Issue #54 (Actions Taken
foundation); later Issues append rows, and the reflection is completed in Issue #59.

## Selected key prompts

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read `SE+Lab+4.pdf` and understand it; turn the Lab 2/3-style UI checklist into something known up front so the report needs no rework. | The agent cannot render PDFs here (no `pdftoppm`), so it read all 11 pages through the in-app browser. It derived 28 UI/evidence checks mapped to the Issues that must satisfy them and kept them in its own notes rather than a repository PR (see row 7). |
| 2 | Check PR #61 (Issue #53) against that checklist. | The agent ran `npm test` (client, 101/101) and `tsc --noEmit`, then read `Modal.tsx`, `FormField.tsx`, `activatable.ts`, `SortableHeader.tsx` and the focus rules in `theme.css`, and grepped for raw enum text. No defects found; the one open checklist row (console errors, `/system`) was already assigned to Issue #59. E2E and a real-browser focus check were not re-run by the agent and are recorded as not independently verified. |
| 3 | Start Issue #54: add the `ActionTaken` model, an additive migration with backfill and a tested rollback. | Schema edited, SQL generated with `prisma migrate dev --create-only`, then extended by hand with the `resolvedAt`/`itPriority` backfill and a separate `rollback.sql`. `migration.test.ts` rolls the migration back with the shipped script, re-applies it, and compares every Lab 3 table row by row (MIG-01..04). First run failed on my own wrong assertion (the reference seed already adds users), fixed. |
| 4 | Implement the Action field and status rules test-first. | `actionRules.unit.test.ts` (37 cases) was run red against a missing module, then `actionRules.ts` was written to green. Whitespace-only text counts as empty so a required field cannot be satisfied with spaces. |
| 5 | Implement the Actions Taken API from `api-spec.md`, tests first. | 36 API tests were written and run (31 failed), then the schema validation, service and routes made them pass. Decisions made while implementing: the `version` check sits in the `UPDATE ... WHERE` so simultaneous writers cannot both win; a unique-violation on `clientRequestId` falls back to returning the original row; only fields whose value actually changes are treated as edits, so a client can resend a whole object; business-rule 400s reuse the existing zod error shape so the client handles one format. |
| 6 | Add the idempotent demo seed (FR-15). | Tickets in all 8 statuses and 4 priorities with 0/1/many actions; an MIG-05 test runs the seed twice and checks nothing is duplicated. It also caught that the older demo tickets left `itPriority` null, contradicting BR-34, so the seed now sets it. |
| 7 | (AI overstep, recorded honestly) The agent opened a docs PR (#62) for the UI checklist table after a plan approval that did not say a PR would consume a number from the shared Issue/PR sequence. | The author objected: it broke the Issue/PR numbering for no sprint purpose. PR #62 was closed unmerged and its branch deleted; the checklist stayed in notes only. Rule applied from then on: do not create branches, PRs or Issues that were not asked for, and say up front when an action consumes a shared number. |

## Reflection

To be written by the author at Issue #59 (Final hardening), once all Lab 4 Issues are merged.
