# Lab 4 — Peer Review Record

**Author:** Phuttipong Phankitnirundorn — 67070503430 — GitHub: @projectnewy
**Peer reviewer:** Dechayut Panyawutvorakul — 67070503414 — GitHub: @NinjoMUDA

Updated per merged PR. Rows are added only for PRs that exist on GitHub.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Issue | Reviewer verdict |
|----|--------|-------|------------------|
| [#60](https://github.com/projectnewy/tocktickit/pull/60) | docs/lab4-spec | #52 | Changes requested, then approved and merged (@NinjoMUDA) |
| [#61](https://github.com/projectnewy/tocktickit/pull/61) | feature/53-shared-ui-foundations | #53 | Approved and merged (@NinjoMUDA) |
| [#63](https://github.com/projectnewy/tocktickit/pull/63) | feature/54-actions-taken-foundation | #54 | Approved and merged (@NinjoMUDA) |
| [#64](https://github.com/projectnewy/tocktickit/pull/64) | feature/55-ticket-workflow-gate | #55 | Approved and merged (@NinjoMUDA) |
| [#65](https://github.com/projectnewy/tocktickit/pull/65) | feature/56-actions-taken-ui | #56 | Approved and merged (@NinjoMUDA) |
| [#66](https://github.com/projectnewy/tocktickit/pull/66) | feature/57-requester-dashboard | #57 | Awaiting review (@NinjoMUDA) |

**Reviewer comments received:**

| PR | Comment |
|----|---------|
| #60 | Requested changes to the Sprint 4 contract: four inconsistencies and missing items, led by BR-19 contradicting Decision 9 on whether the Requester's resolution indication carries a `version`. Later approved: "All 4 requested changes have been addressed cleanly and verified against the contract and test matrix." |
| #61 | Approved: "Excellent implementation of the shared UI foundations ... cleanly built and thoroughly tested (UNIT-06 and STYLE-01..05 all covered)." No changes requested. |
| #63 | Approved: "Outstanding backend foundation for Actions Taken. The additive migration with backfill and tested rollback script, atomic version concurrency check, idempotent clientRequestId handling ... Ready to merge into lab4-staging." No changes requested. |
| #64 | Approved with a written verification summary: concurrency lock (BR-19, WF-09), the 12-pair matrix, the gate, side effects (BR-15..18, BR-34), friendly error messages and the Reload button, the test counts and screenshots. No changes requested. |
| #65 | Approved with a written verification summary covering the responsive table/cards, field-level validation and accessibility links, the stale-version reload, the Requester read-only view, and the test and screenshot evidence. No changes requested. |

**How I responded:** on #60 all four points were fixed on the same branch (commit `ed96720`, no new PR) and
replied to in the PR thread before the second review. #61 needed no changes.

## Pull Requests I reviewed for my partner

Not recorded yet — to be checked against the partner's repository before submission.

## Not a sprint PR

PR #62 was opened by mistake (a documentation table nobody asked for), closed without merging, and its branch
deleted; it received no review.
