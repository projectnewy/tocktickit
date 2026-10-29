# Lab 4 UI Specification

Reuses all Zen Green tokens, typography, spacing, badge, button, form, table/card, loading, empty, and error
conventions from `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`. This file covers only what is new or
changed in Lab 4, plus the shared UI/accessibility checklist every Lab 4 Issue must satisfy.

## 1. App Shell, Navigation, and Landing
- Navigation is role-aware, with **Dashboard** as the first item and the current page clearly indicated
  (underline plus `aria-current="page"`, not color alone):
  - Requester: Dashboard, My Tickets, Create Ticket
  - IT Staff: Dashboard, Ticket Queue
  - Administrator: Dashboard, Ticket Queue, Users
- Landing: after login, after a forced password change, and for `/`, Requesters go to `/dashboard` and IT
  Staff/Administrators go to `/staff/dashboard`. A user opening the other role's Dashboard, or a
  Requester-only screen as staff, is redirected to their own Dashboard (the route guard is the enforcement,
  not just hidden links).
- My Tickets, Create Ticket, and Requester Ticket Detail are Requester-only routes.
- Expired/invalid session (401): the client clears auth and redirects to Login with a short message
  ("Your session has expired. Please sign in again.").
- The Lab 1 `/system` page and any duplicate/obsolete controls are removed.

## 2. Requester Dashboard (`/dashboard`)
Concise summary of the signed-in Requester's own Tickets only; it does not duplicate My Tickets.
- Four metric cards in a responsive grid (4 across on desktop, 2 on tablet, 1 on mobile): **Open Tickets**,
  **Waiting for You** (highlighted when > 0, with an icon and text, not only color), **Recently Updated**,
  **Recently Resolved**.
- Count cards show a large value, a label, and a "View" action link; list cards show up to 5 Tickets (ticket
  number, summary, status badge, last updated) each linking to Ticket Detail, plus a "View all" link.
- States: loading skeleton/spinner; per-card empty message ("No tickets waiting for you"); forbidden
  (redirect to own Dashboard); safe failure banner with a Retry button — never a blank page or raw error.

## 3. IT Staff Dashboard (`/staff/dashboard`; Administrator reuses it)
- Top row of count cards (two): **Unassigned** and **Owned by Me**, each a value, a label, and a "View" link.
- **By Status** and **By IT Priority** panels: one row per active status / priority with a count and a bar or
  badge; each row is a link to the filtered Ticket Queue (zero counts still shown).
- Lists (max 5 each): **Urgent Tickets** and **Recently Updated** (ticket number, summary, status badge, last
  updated → Ticket Detail).
- **My Planned Actions** is one combined card, not a count card plus a separate list: the card header shows
  the label with the total count (from `myPlannedActions.count`), and the body lists up to 5 of the current
  user's Planned actions (description, ticket number, date/time → Ticket Detail), earliest first. When the
  count is 0 the body shows "No planned actions assigned to you." It sits in the lists grid with the other
  lists, not in the top row.
- Administrator additionally sees a compact **Users** card (active per role, inactive total) linking to Users.
- Same loading/empty/forbidden/safe-failure behavior as §2. Responsive: panels stack to one column below
  992px; no horizontal page scroll.

## 4. Actions Taken on Ticket Detail
- **IT Staff/Administrator Ticket Detail:** an "Actions Taken" section below Attachments (above Public
  Comments). Desktop table columns: Date/Time, Description, Result, Assignee, Performed By, Status badge,
  Follow-Up, Attachment Notes, and row actions (Edit, Complete, Cancel). Mobile (<992px): one card per action
  with the same fields. Ordering is Date/Time ascending (BR-12). An **Add Action** button opens the shared
  modal in create mode.
- **Create/Edit modal (shared Modal component):** Description, Action Date/Time, Assignee (select of active
  IT Staff/Administrator only), Status shown read-only in create (Planned by default) with a "Mark completed"
  option, Result (required when completing), Follow-Up Required toggle, Follow-up Note (appears and is
  required when the toggle is on), Attachment Notes. Performed By and Created By are display-only.
  Validation messages appear **below each field**; entered data is kept after a recoverable failure.
  Submit shows a busy state and is disabled while in flight (BR-21).
- **View/edit modes:** a Cancelled action opens read-only; a Completed action allows content edits only (description, result, date/time, follow-up, attachment notes;
  status and assignee are read-only);
  Planned actions are fully editable. Completing/cancelling asks for confirmation in the modal.
- **Feedback:** success banner after save; 409 stale-version shows "This action was changed by someone else"
  with a "Reload" action; ticket-not-actionable and gate messages are shown inline, never as a raw error.
- **Requester Ticket Detail:** the same section, read-only: all actions with all fields, no buttons.
- Empty state: "No actions have been recorded for this ticket yet."

## 5. Ticket Workflow Controls (Staff Ticket Detail)
- The status control offers only transitions permitted from the current status (UI convenience; the backend is
  authoritative). Choosing Resolved when the gate is unmet shows the server's reasons in plain language
  ("Complete or cancel all planned actions" / "Record at least one completed action").
- After any successful change the Ticket summary (status badge, owner, priority) refreshes from the response.
  A 409 stale-version message offers "Reload ticket". When the Requester has indicated the problem looks
  resolved, a clear "Requester says the problem appears resolved" notice is shown to staff (advisory only).
- Staff Queue and My Tickets: "Last Updated" sorts by last updated (not created date), and the Staff Queue has
  an IT Priority filter, so Dashboard drill-down links open the matching list.

## 6. Shared UI Foundations (built once, used everywhere)
- **Modal:** focus moves into the dialog on open, Escape closes it, Tab/Shift+Tab are trapped inside, focus
  returns to the opener on close; `role="dialog"`, `aria-modal`, `aria-labelledby`. Used by every modal.
- **Rows and headers:** clickable table rows are keyboard-operable (focusable, Enter/Space open the Ticket);
  sortable headers support Enter/Space and expose `aria-sort`.
- **Focus:** every interactive element (links, nav links, buttons, row/card buttons, modal close, form
  controls) has a visible green focus ring using the existing `--bs-focus-ring-color` token.
- **Labels:** Status, Priority, and Role always render friendly labels ("In Progress", "IT Staff") in
  badges, filters, dropdowns, and messages — never raw enum values. Badges keep a text label (non-color cue).
- **Forms:** required-field and format messages appear below the field (`role="alert"` text associated via
  `aria-describedby`); Login and Change Password follow this rule too.

## 7. Responsive and Accessibility
Same rules as Labs 2–3: no horizontal page scroll at any viewport, 44px touch targets for primary actions,
keyboard operation of everything, `role="alert"` on error/validation text, color-plus-text/icon on every
badge. Wide tables that cannot become cards (e.g. User Management) scroll inside their own
`.table-responsive` container, never the page.

## 8. Visual Inspection and Accessibility Checklist
Checked in a real browser and via Playwright screenshots at desktop (1280), tablet (768), and mobile (375)
for the Requester Dashboard, IT Staff Dashboard, and Actions Taken (both roles), stored under
`artifacts/lab-04/screenshots/{requester-dashboard,staff-dashboard,actions-taken}/`. Every Lab 4 Issue copies
this list into its PR and ticks it before review; the final status is recorded in Issue "Final hardening".

**How to use this table.** Each Issue ticks only the rows listed under its number in the *Issue* column (and
"every" rows for the screens it touches), copying those rows into its PR. Mark **Pass** only when the evidence
in the *Evidence* column exists; leave the *Status* cell blank otherwise. **#59** re-verifies every row on
`main` and records the final status. Rows G/R/S/A/W/X: Global, Requester Dashboard, Staff Dashboard, Actions
Taken, Workflow, Cross-cutting. Source "L4 §n" = Lab 4 labsheet section.

| # | Check | Source | Screen × viewport | Evidence | Issue | Status |
|---|---|---|---|---|---|---|
| G1 | Zen Green consistent with Labs 2–3 (colors, badges, buttons, tables/cards, spacing) | L4 §7 | all screens × 3 | screenshots | every; final #59 | |
| G2 | Nav is role-aware, Dashboard first, current page not indicated by color alone | L4 §7, §1 above | 3 roles × 3 | screenshots, `aria-current` | #58; final #59 | |
| G3 | No horizontal page scroll, clipping, or overlap | L4 §8.6, §7 | all screens × 3 | `scrollWidth === clientWidth` in E2E | every; final #59 | |
| G4 | Every control keyboard-operable with visible focus ring (link, nav, button, row, modal close, input) | L4 §7 | all screens × desktop | E2E Tab/focus, screenshot | #53, then every | |
| G5 | Modals: focus in, Escape closes, Tab trapped, focus restored | §6 above | Actions Taken modal | Vitest, E2E | #53, #56 | |
| G6 | Status/Priority/Role use friendly labels, never raw enums, never color alone | §6 above | all screens × 3 | screenshots | #53, then every | |
| G7 | Submit disabled only while in flight (not by validity); repeated click/retry creates no duplicates | L4 §8.5, BR-21 | Add/Edit Action, status change | E2E double-click | #55, #56 | |
| G8 | Entered data kept after a recoverable failure | L4 §8.5 | Action modal, forms | Vitest | #53, #56 | |
| G9 | No console errors, broken links, placeholder text, or obsolete UI (`/system` removed) | L4 §8.5 | all screens | console log, E2E | #59 | |
| G10 | README, seed, migration, and test instructions match reality | L4 §8.5 | repo | follow README on `main` | #59 | |
| R1 | Requester Dashboard: 4 cards with label, value, View link; own Tickets only | L4 §8.2, §2 above | `/dashboard` × 3 | `requester-dashboard/*.png` | #57 | |
| R2 | Requester Dashboard: grid 4/2/1, loading, empty, forbidden, safe-failure with Retry | §2 above | `/dashboard` × 3 | screenshots per state | #57 | |
| S1 | Staff Dashboard: Unassigned, Owned by Me, By Status, By IT Priority, Urgent, Recently Updated, My Planned Actions; rows link to the filtered Queue/Detail | L4 §8.1, §3 above | `/staff/dashboard` × 3 | `staff-dashboard/*.png` | #58 | |
| S2 | Dashboard numbers match database queries, non-zero and zero | L4 Part 5 | `/staff/dashboard` | SQL result vs screenshot | #58 | |
| S3 | Administrator sees extra Users card; wrong-role Dashboard redirects to own | §1, §3 above | Admin, Requester | screenshot, E2E redirect | #58 | |
| S4 | Staff Dashboard panels stack to one column below 992px | §3 above | × 3 | screenshots | #58 | |
| A1 | Actions Taken (staff): table on desktop, cards on mobile, ascending by date, Add Action | L4 §8.3, §4 above | Ticket Detail × 3 | `actions-taken/*.png` | #56 | |
| A2 | Create/Edit modal: editable vs read-only distinct; validation below the field; conditional required Result and Follow-up Note | §4 above | modal × 3 | screenshots, valid and invalid | #56 | |
| A3 | Assignee limited to active IT Staff/Admin; inactive assignee rejected with clear message | L4 Part 6 | modal | E2E, screenshot | #56 | |
| A4 | Completed/Cancelled open in correct read-only mode; confirm before Complete/Cancel | §4 above | Ticket Detail | screenshots | #56 | |
| A5 | Requester sees all Actions Taken fields, no buttons | L4 §8.3 | Requester Detail × 3 | screenshots | #56 | |
| A6 | Empty, success, 409 stale (Reload), forbidden, not-found, safe-failure states | §4 above | Ticket Detail | screenshots | #56 | |
| W1 | Status control shows only permitted transitions; blocked Resolve explains why in plain language | L4 §8.4, §5 above | Staff Ticket Detail | screenshots | #55 | |
| W2 | Ticket summary refreshes after change; 409 offers "Reload ticket"; "Requester says resolved" notice is advisory | L4 §8.4, §5 above | Staff Ticket Detail | E2E | #55 | |
| X1 | Private vs shared content distinct (Internal Notes vs Public Comments unchanged) | Lab 3 | Staff Ticket Detail | screenshots | #59 | |
| X2 | Regression: Labs 1–3 still work (Login, My Tickets, Comments, Notes, Attachments, User Management) | L4 §8.5 | per screen | full E2E on `main` | #59 | |
| X3 | Screenshots compared against this document, not memory | this doc | all screens | comparison note | #59 | |
