# Lab 2 — Peer Review Record

**Author:** Phuttipong Phankitnirundorn — 67070503430 — GitHub: @projectnewy
**Peer reviewer:** Garunyapas Danpitakkul — 67070503404 — GitHub: @vienggg

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#20](https://github.com/projectnewy/tocktickit/pull/20) | docs/lab2-spec | Approved & merged (@vienggg) |
| [#21](https://github.com/projectnewy/tocktickit/pull/21) | feature/5-schema-and-seed | Approved & merged (@vienggg) |
| [#22](https://github.com/projectnewy/tocktickit/pull/22) | feature/6-server-refactor | Approved & merged (@vienggg) |
| [#23](https://github.com/projectnewy/tocktickit/pull/23) | feature/7-tickets-api | Approved & merged (@vienggg) |
| [#24](https://github.com/projectnewy/tocktickit/pull/24) | feature/8-attachments-api | Approved & merged (@vienggg) |
| [#25](https://github.com/projectnewy/tocktickit/pull/25) | feature/9-client-shell-theme | Approved & merged (@vienggg) |
| [#26](https://github.com/projectnewy/tocktickit/pull/26) | feature/10-create-ticket-ui | Approved & merged (@vienggg) |
| [#27](https://github.com/projectnewy/tocktickit/pull/27) | feature/11-my-tickets-ui | Approved & merged (@vienggg) |
| [#28](https://github.com/projectnewy/tocktickit/pull/28) | feature/12-ticket-detail-ui | Approved & merged (@vienggg) |
| [#29](https://github.com/projectnewy/tocktickit/pull/29) | feature/13-e2e-and-docs | Approved & merged (@vienggg) |

**Reviewer comments received:**

| PR | Comment |
|----|---------|
| #20 | "okay good work" |
| #21 | "okay, merged man!" |
| #22 | "good work phut!" |
| #23 | "great job!" |
| #24 | "Great job on the attachments API, magic number verification, and soft-remove flow — tests look solid." |
| #25 | "Great job setting up the client shell, RequesterGuard, Zen Green theme overrides, and routing — clean implementation." |
| #26 | "Nice work on the Create Ticket UI, robust two-phase upload handling, and clean error validation — everything looks great." |
| #27 | "Nice job on the My Tickets screen, URL-based search params, and clean responsive layout — everything passes nicely." |
| #28 | "Nice work on the ticket details and attachments — looks great." |
| #29 | "Awesome job on the E2E tests, screenshots, and docs projectnewy! Everything looks solid." |

**How I responded:** Every PR description already included the verification evidence (test counts,
`curl`/browser walkthroughs, and — for #23 and #24 — the real bugs the test suite caught) before review,
so no PR needed follow-up fixes after merge. No reviewer comment in this sprint requested a change.

## Pull Requests I reviewed for my partner

@phittayanan maintained a separate `toktickit` repository for Lab 2 this sprint. I reviewed and formally
approved (GitHub "Approve" review) 11 of his 12 Lab 2 pull requests; all 12 are merged.

| PR | Title | My verdict |
|----|-------|------------|
| [#31](https://github.com/phittayanan/toktickit/pull/31) | Lab 2 — 01: Author the Lab 2 engineering contract | Approved & merged |
| [#32](https://github.com/phittayanan/toktickit/pull/32) | Lab 2 — 02: Reference-data foundation (schema + seed + read API) | Approved & merged |
| [#33](https://github.com/phittayanan/toktickit/pull/33) | Lab 2 — 03: Development Requester context (client) | Approved & merged |
| [#34](https://github.com/phittayanan/toktickit/pull/34) | Lab 2 — 04: Create Ticket core (fields + Ticket Number) | Approved & merged |
| [#35](https://github.com/phittayanan/toktickit/pull/35) | feat(tickets): add Create Ticket attachments | Approved & merged |
| [#36](https://github.com/phittayanan/toktickit/pull/36) | feat(tickets): add My Tickets list | Approved & merged |
| [#37](https://github.com/phittayanan/toktickit/pull/37) | feat(tickets): add Ticket Detail view mode | Approved & merged |
| [#38](https://github.com/phittayanan/toktickit/pull/38) | feat(tickets): add Ticket Detail attachments | Approved & merged |
| [#39](https://github.com/phittayanan/toktickit/pull/39) | feat(ui): apply Zen Green theme and add Playwright visual QA | Approved & merged |
| [#40](https://github.com/phittayanan/toktickit/pull/40) | test(e2e): add full-stack E2E flows, fix a real attachment bug | Approved & merged |
| [#41](https://github.com/phittayanan/toktickit/pull/41) | Lab 2 release: TokTickIT Requester Ticketing MVP with UI Foundation | Approved & merged |
| [#42](https://github.com/phittayanan/toktickit/pull/42) | docs(lab-02): log AI-use prompts for #23, #24, and the merge/close workflow | Merged (no review requested) |

**Comments I left:**

| PR | Comment |
|----|---------|
| #31 | "Good start, let continuu your work." |
| #32 | "You continue your work well." |
| #33 | "I saw it pretty good and nice." |
| #34 | "Brilliant work! Excellent attention to business rules and edge cases." |
| #35 | "Brilliant work, Excellent edge case handling on the 5-file cap" |
| #36 | "Great job! The code is clean and everything works perfectly. Good catch" |
| #37 | "Excellent work, The screen looks great" |
| #38 | "Great job, the download and soft-remove features work." |
| #39 | "Great job, The new Zen Green theme looks amazing" |
| #40 | "Great job, Finding that file attachment bug" — phittayanan replied explaining the root cause (live `FileList` behavior) |
| #41 | "Excellent work on completing all 10 issues for Lab 2" — phittayanan thanked me for reviewing across all ten |
