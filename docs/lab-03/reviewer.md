# Lab 3 — Peer Review Record

**Author:** Phuttipong Phankitnirundorn — 67070503430 — GitHub: @projectnewy
**Peer reviewer:** Dechayut Panyawutvorakul — 67070503414 — GitHub: @NinjoMUDA

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#38](https://github.com/projectnewy/tocktickit/pull/38) | docs/lab3-spec | Approved & merged (@NinjoMUDA) |
| [#39](https://github.com/projectnewy/tocktickit/pull/39) | feature/32-auth-authz | Approved & merged (@NinjoMUDA) |
| [#40](https://github.com/projectnewy/tocktickit/pull/40) | feature/33-login-requester-regression | Approved & merged (@NinjoMUDA) |
| [#41](https://github.com/projectnewy/tocktickit/pull/41) | feature/34-staff-ticket-queue | Approved & merged (@NinjoMUDA) |
| [#42](https://github.com/projectnewy/tocktickit/pull/42) | feature/35-staff-ticket-detail | Changes requested, then merged after fixes (@NinjoMUDA) |
| [#43](https://github.com/projectnewy/tocktickit/pull/43) | feature/36-admin-user-management | Changes requested, then merged after fixes (@NinjoMUDA) |

**Reviewer comments received:**

| PR | Comment |
|----|---------|
| #38 | "Nice I Will Merged" |
| #39 | "Wow That Great" |
| #40 | "OH wow you did it very well" |
| #41 | "OH wow Amazing" |
| #42 | Requested changes: implement the "Reassign" dropdown from ui-spec.md §4 (only self-claim existed), switch `requireStaffForNotes` from a deny-list to an allow-list (fail-closed on an undefined role), and fix a WCAG contrast issue on the Internal Notes submit button. |
| #43 | Requested changes: wrap the User Management table in `.table-responsive` for mobile, add success feedback after create/edit/reset (only errors were shown), and add a UI hint (not just a server error) before a self-deactivation attempt. |

**How I responded:** #38–#41 were approved without changes requested — each PR description already included
the verification evidence (test counts, a real-browser walkthrough, and for #39 the concurrent-migration
and seed-data-drift issues found and fixed during development) before review. #42 and #43 each came back
with concrete, specific feedback; I addressed every point in a follow-up commit (`60c918b` for #42,
`be98419` for #43), added or updated tests for each fix rather than only patching the visible symptom, and
re-verified every fix in a live browser before replying in the PR thread with what changed and why. Both
were merged after that follow-up — no formal second "Approve" review was submitted for either, but the
reviewer merged directly after seeing the reply.

## Pull Requests I reviewed for my partner

<!-- To be filled in once the partner-swap review is complete — partner's name/repo and the specific
     PRs reviewed with real verdicts/comments, following the same format as the table above. -->
