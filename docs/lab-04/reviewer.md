# Lab 4 — Peer Review Record

**Author:** Phuttipong Phankitnirundorn — 67070503430 — GitHub: @projectnewy
**Peer reviewer:** Dechayut Panyawutvorakul — 67070503414 — GitHub: @NinjoMUDA
**Partner whose pull requests I reviewed:** Garunyapas Danpitakkul — 67070503404 — GitHub: @vienggg

Rows are added only for PRs that exist on GitHub.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Issue | Reviewer verdict |
|----|--------|-------|------------------|
| [#60](https://github.com/projectnewy/tocktickit/pull/60) | docs/lab4-spec | #52 | Changes requested, then approved and merged (@NinjoMUDA) |
| [#61](https://github.com/projectnewy/tocktickit/pull/61) | feature/53-shared-ui-foundations | #53 | Approved and merged (@NinjoMUDA) |
| [#63](https://github.com/projectnewy/tocktickit/pull/63) | feature/54-actions-taken-foundation | #54 | Approved and merged (@NinjoMUDA) |
| [#64](https://github.com/projectnewy/tocktickit/pull/64) | feature/55-ticket-workflow-gate | #55 | Approved and merged (@NinjoMUDA) |
| [#65](https://github.com/projectnewy/tocktickit/pull/65) | feature/56-actions-taken-ui | #56 | Approved and merged (@NinjoMUDA) |
| [#66](https://github.com/projectnewy/tocktickit/pull/66) | feature/57-requester-dashboard | #57 | Approved and merged (@NinjoMUDA) |
| [#67](https://github.com/projectnewy/tocktickit/pull/67) | feature/58-staff-dashboard-landing | #58 | Approved and merged (@NinjoMUDA) |
| [#68](https://github.com/projectnewy/tocktickit/pull/68) | feature/59-final-hardening | #59 | Approved and merged (@NinjoMUDA) |

**Reviewer comments received:**

| PR | Comment |
|----|---------|
| #60 | Requested changes to the Sprint 4 contract: four inconsistencies and missing items, led by BR-19 contradicting Decision 9 on whether the Requester's resolution indication carries a `version`. Later approved: "All 4 requested changes have been addressed cleanly and verified against the contract and test matrix." |
| #61 | Approved: "Excellent implementation of the shared UI foundations ... cleanly built and thoroughly tested (UNIT-06 and STYLE-01..05 all covered)." No changes requested. |
| #63 | Approved: "Outstanding backend foundation for Actions Taken. The additive migration with backfill and tested rollback script, atomic version concurrency check, idempotent clientRequestId handling ... Ready to merge into lab4-staging." No changes requested. |
| #64 | Approved with a written verification summary: concurrency lock (BR-19, WF-09), the 12-pair matrix, the gate, side effects (BR-15..18, BR-34), friendly error messages and the Reload button, the test counts and screenshots. No changes requested. |
| #65 | Approved with a written verification summary covering the responsive table/cards, field-level validation and accessibility links, the stale-version reload, the Requester read-only view, and the test and screenshot evidence. No changes requested. |
| #66 | Approved with a written verification summary covering the Bangkok window, ownership scoping, the drill-down checks, the Requester Dashboard screen, and the test evidence. No changes requested. |
| #67 | Approved with a written verification summary covering the single-transaction metrics, capped lists, the drill-down checks, role landing and guards, and the test and screenshot evidence. No changes requested. |
| #68 | Approved with a written verification summary covering session expiry (BR-33, AC-22) and the 200 session probe, removal of the Lab 1 `/system` screen, the performance test (PERF-01), the all-screens hardening audits, and the finalized documents (test table, UI checklist, README). No changes requested. |

**How I responded:** on #60 all four points were fixed on the same branch (commit `ed96720`, no new PR) and replied to in the
PR thread before the second review. On #61 and #63-#68 the reviewer requested no changes, and I acknowledged each approval with a
reply in the PR thread.

## Pull Requests I reviewed for my partner

Partner: Garunyapas Danpitakkul — 67070503404 — GitHub: @vienggg, repository `vienggg/toktickit`. I reviewed and merged all 12 of
their Lab 4 pull requests, listed below (checked on GitHub on 2026-11-01).

| PR | Title | Base | My review | Merged (UTC) |
|----|-------|------|-----------|--------------|
| [#84](https://github.com/vienggg/toktickit/pull/84) | docs(lab4): Sprint 4 engineering contract and test plan (I-1) | lab4-staging | Approved, with 4 non-blocking notes | 2026-10-31 17:12 |
| [#85](https://github.com/vienggg/toktickit/pull/85) | docs(lab4): address I-1 review notes (follow-up to #84) | lab4-staging | Approved | 2026-10-31 18:23 |
| [#86](https://github.com/vienggg/toktickit/pull/86) | feat(lab4): Actions Taken and status history data foundation (I-2) | lab4-staging | Changes requested, then approved | 2026-10-31 18:05 |
| [#87](https://github.com/vienggg/toktickit/pull/87) | feat(lab4): Actions Taken API and Ticket workflow (I-3) | lab4-staging | Approved | 2026-10-31 18:16 |
| [#88](https://github.com/vienggg/toktickit/pull/88) | feat(lab4): Actions Taken and workflow UI (I-4) | lab4-staging | Approved, with one non-blocking note | 2026-10-31 18:32 |
| [#89](https://github.com/vienggg/toktickit/pull/89) | feat(lab4): role dashboards, routing and drill-down (I-5) | lab4-staging | Approved | 2026-11-01 05:54 |
| [#90](https://github.com/vienggg/toktickit/pull/90) | L4 I-6: Hardening, README and row-action locking | lab4-staging | Approved | 2026-11-01 05:55 |
| [#91](https://github.com/vienggg/toktickit/pull/91) | L4 I-7: Responsive, accessibility and visual inspection | lab4-staging | Approved | 2026-11-01 06:27 |
| [#92](https://github.com/vienggg/toktickit/pull/92) | L4 I-8: Lab 4 release (lab4-staging to main) | main | Approved | 2026-11-01 06:29 |
| [#93](https://github.com/vienggg/toktickit/pull/93) | L4 I-9: Final report evidence | lab4-staging | Approved, with 2 non-blocking notes | 2026-11-01 09:16 |
| [#94](https://github.com/vienggg/toktickit/pull/94) | L4 I-9 follow-up: reviewer.md row and tsc output | lab4-staging | Approved, with 1 non-blocking note | 2026-11-01 09:17 |
| [#95](https://github.com/vienggg/toktickit/pull/95) | L4 I-9: Final report release (lab4-staging to main) | main | Approved | 2026-11-01 09:18 |

**Comments I gave and how they were resolved:**
- #84: four non-blocking notes (for example AC-22's count parity does not hold for a capped list); the partner fixed them in #85,
  which I approved.
- #86: migration 5 declared six relations in `schema.prisma` but the SQL created only one foreign key. I requested changes; the
  partner fixed it in commit `20ecbbf`, added tests MIG-07/08/09, and I approved the re-review.
- #88: Edit and Complete stayed enabled while a status change was in flight. The partner tracked it for the hardening issue and
  fixed it in #90, which I approved.
- #93 and #94: non-blocking notes about a wrong row description and a missing tsc output file; the partner fixed them in #94 and
  #95.
- #92 and #95 are release pull requests into `main`: I checked that their contents were exactly the earlier, already reviewed pull
  requests (#84-#91, and #93-#94).

**Depth of review, stated honestly:** in my comments on #89 to #93 and #95 I wrote that I read the diff and did not run the tests or
open the screenshots.

## Not a sprint PR

PR #62 was opened by mistake (a documentation table nobody asked for), closed without merging, and its branch deleted; it received
no review.
