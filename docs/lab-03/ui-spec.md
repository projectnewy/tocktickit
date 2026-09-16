# Lab 3 UI Specification

Reuses all Zen Green tokens, typography, spacing, button hierarchy, and validation-placement rules from
`docs/lab-02/ui-spec.md` unchanged. This file only covers what's new or different in Lab 3.

## App Shell
Header right side changes from "Selected Requester name + Switch requester" to "Signed in as
{fullName} ({role}) + Logout." Navigation items are role-filtered server-render-safe (i.e. the route
guard, not just hidden nav links, blocks direct URL access) — see BR-20/FR-20 in specification.md.
Role badge next to the name uses a neutral gray pill (not a priority/status color) to avoid clashing with
Ticket badges elsewhere.

## 1. Login
Centered card, max-width ~400px at all sizes: email field, password field, Submit. Validation:
required-field messages below each field. Submit shows busy state ("Signing in…") and disables while in
flight. Failure: single banner above the form ("Invalid email or password"), fields retain entered
email (never retain password). No "forgot password" link (excluded from Lab 3).

## 2. Change Password (mandatory first-login)
Same card pattern. New password + confirm password fields, inline rule text ("8–72 characters"),
mismatch validation before submit. On success, redirect straight into the app (no separate confirmation
screen — the redirect itself is the confirmation).

## 3. IT Staff Ticket Queue
Same shape as Lab 2 My Tickets: search box, filter row (Status, Category, Owner: Me/Unassigned/All),
sort control, desktop table / mobile card list. Table columns: Ticket No., Requester, Summary,
Category, IT Priority (badge), Status (badge), Owner, Last Updated — justified against the labsheet's
example field list, "Requester" added since IT Staff (unlike a Requester) need to see whose ticket it
is. Empty vs no-results states distinct, same pattern as Lab 2 §7.4.

## 4. IT Staff Ticket Detail
Extends Lab 2's read-only ticket-info block with: Owner (with a "Claim" button when unassigned, a
"Reassign" dropdown when assigned), IT Priority (editable dropdown, IT Staff/Admin only), Status
(editable dropdown constrained to the valid-transition set for the current status). Two new sections
below Attachments: **Public Comments** (white background, chat-thread style, visible to all three
roles) and **Internal Notes** (pale-amber background + "Staff only" badge in the section header — the
color difference is the primary safeguard against posting private content publicly by mistake). Both
sections: a text box + Post button, newest entry appended at the bottom, author name + relative
timestamp on each entry.

## 5. Administrator User Management
Single screen, no route nesting. Top: search box + role filter dropdown + "Create User" button. Table:
Name, Email, Role (badge), Status (Active/Inactive badge), Edit action — no pagination, no multi-column
sort (excluded per handout §8.5). Create/Edit open as a modal (`ConfirmDialog`-style, hand-rolled, not
react-bootstrap, consistent with Lab 2): Name, Email, Role (single-select), Active toggle, and — create
only — Initial Password field; edit mode instead shows a "Set new password" action that opens a second,
smaller confirmation modal. Self-deactivation and last-Administrator-removal attempts show an inline
error in the modal, not a silent no-op.

## Responsive & Accessibility
Same rules as Lab 2 (`ui-spec.md` §8-9): no horizontal scroll at any viewport, 44px touch targets,
keyboard-reachable controls, `role="alert"` on validation/error text, color-plus-text/icon on every
badge (role, status, priority). Internal Notes' visual distinction (background + badge, not color
alone) is itself an accessibility-relevant rule, not just a styling choice.

## Visual Inspection Checklist additions
Checked manually and via Playwright screenshots at each viewport, stored under
`artifacts/lab-03/screenshots/`:
- [x] Role badge next to user name in header, all screens (confirmed in every Lab 3 screenshot)
- [x] Public Comments vs Internal Notes visually distinct at a glance, all viewports (white card vs.
  pale-amber `#fdf6e3` card + "Staff only" badge — `staff-ticket-detail/*.png`)
- [x] Login/Change Password forms usable and centered on mobile (`authentication/mobile.png`)
- [x] Claim/Reassign/Status controls only rendered for IT Staff/Admin — verified both by `RoleGuard`
  redirecting a Requester away from `/staff/tickets*` and `/admin/users` (manual browser check) and by
  the header nav never rendering those links for a Requester session
- [x] No clipping, overlap, or unintended horizontal scrolling at any viewport (asserted in every Lab 3
  E2E spec via `scrollWidth === clientWidth`, in addition to visual screenshot review)
- [x] User Management's table sits inside `.table-responsive` on mobile — the table itself scrolls
  horizontally within its own container rather than the page overflowing (see `user-management/mobile.png`)
