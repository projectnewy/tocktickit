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
- [ ] Zen Green design is consistent with Labs 2–3 (colors, badges, buttons, tables/cards, spacing)
- [ ] Dashboard cards: label, value, accessible drill-down action; non-zero and zero states both shown
- [ ] Actions Taken: editable vs read-only fields visually distinct; validation placed below the field
- [ ] Private vs shared content is visually distinct (Internal Notes vs Public Comments unchanged)
- [ ] Every interactive control is reachable by keyboard with a visible focus ring
- [ ] Modals trap focus, close on Escape, and restore focus
- [ ] Status, Priority, Role show friendly labels everywhere (no raw enum values) and never rely on color alone
- [ ] No clipping, overlap, or horizontal page scroll at any viewport
- [ ] Loading, empty/no-results, validation, success, forbidden, conflict, not-found, and safe-failure states
- [ ] No console errors, broken links, placeholder text, or leftover/obsolete UI
- [ ] Screenshots compared against this document, not memory
