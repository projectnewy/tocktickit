# Lab 2 UI Specification — Zen Green Theme

## 1. Color Tokens

Implemented as CSS custom properties in `client/src/styles/theme.css`, imported after Bootstrap's CSS
(later import wins at equal specificity, so tokens can override Bootstrap defaults):

| Token | Value | Used for |
|---|---|---|
| `--tk-green-primary` | `#006B3C` | App header background, primary buttons, strong emphasis |
| `--tk-green-secondary` | `#0B7A46` | Active tabs, focus accents, links, hover states |
| `--tk-green-pale` | `#EAF6EF` | Selected rows, success emphasis, subtle section backgrounds |
| `--tk-page-bg` | `#F5F7F6` | Page background |
| `--tk-surface` | `#FFFFFF` | Card/panel backgrounds |
| `--tk-border` | `#DDE5E0` | Default borders on surfaces and editable fields |
| `--tk-text` | `#1C2B24` | Body text (dark charcoal-green, not pure black) |
| `--tk-field-readonly-bg` | `#F2F6F3` | Read-only field background |
| `--tk-error` | `#A4161A` | Error text/border |
| `--tk-warning` | `#B26B00` | Warning callouts/badges |
| `--tk-shadow` | `0 1px 2px rgba(16,40,28,.06), 0 2px 8px rgba(16,40,28,.05)` | Restrained card shadow |

**Bootstrap override note (critical):** Bootstrap 5.3's `.btn-primary` sets `--bs-btn-bg`,
`--bs-btn-border-color`, `--bs-btn-hover-bg`, and `--bs-btn-active-bg` as literals inside the
`.btn-primary` rule — overriding the global `--bs-primary` variable alone does **not** recolor buttons.
`theme.css` must set these explicitly on `.btn-primary`, `.btn-outline-primary`, `.nav-link.active`,
`.form-check-input:checked`, `.page-item.active .page-link`, and `.form-control:focus`
(border + `box-shadow`) to actually apply the Zen Green palette.

## 2. Typography and Spacing

Bootstrap's default type scale and spacing utilities (`py-*`, `px-*`, `gap-*`, `mb-*`) are reused
unmodified — no custom font is introduced. Headings use Bootstrap's `h1`–`h6` classes; body text
inherits `--tk-text` instead of pure black via a `body { color: var(--tk-text); }` rule.

## 3. Field States

| State | Style |
|---|---|
| Editable | White background, `1px solid var(--tk-border)` |
| Read-only | `var(--tk-field-readonly-bg)` background, `readonly` attribute + `aria-readonly="true"`, no focus ring |
| Invalid | Border `var(--tk-error)`; message rendered as `<div class="tk-field-error" role="alert">` **immediately below** the field, referenced by the input's `aria-describedby` |
| Disabled | Reduced opacity, `cursor: not-allowed`, `disabled` attribute (never simulated with only CSS) |
| Focused | Visible focus ring at all times (never suppressed) for keyboard users |

Required-field labels show a red asterisk; the asterisk is supplementary to, never a replacement for,
the validation message.

## 4. Button Hierarchy

- **Primary** (`.btn-primary`, Zen Green): the single main action per screen (Submit, Continue, Add
  Attachment).
- **Secondary** (`.btn-outline-primary`): supporting actions (Cancel, Clear Filters).
- **Destructive** (`.btn-outline-danger`): Remove Attachment.
- **Busy state:** primary submit buttons show a spinner + disabled state while a request is in flight
  (`<button disabled><span class="spinner-border spinner-border-sm"/> Saving…</button>`) — this both
  satisfies BR-11 (no double-submit) and gives the required visual busy indicator.
- Icon-only controls (e.g. a small "×" remove icon) always carry an `aria-label` and a `title` tooltip.

## 5. Application Shell and Navigation

- **AppHeader**: `--tk-green-primary` background, white text, app name "TokTickIT," primary nav (My
  Tickets, Create Ticket), and a right-aligned `RequesterBadge` showing the current Requester's name
  plus a "Switch requester" action.
- Active nav item indicated by an underline/background using `--tk-green-secondary`, never color alone
  (the active item also carries `aria-current="page"`).
- Mobile (<768px): nav collapses to a Bootstrap offcanvas/hamburger menu; the Requester badge remains
  visible.

## 6. Screen Specifications

### 6.1 Development Requester Selection
Centered card on `--tk-page-bg`. Title, one-sentence explanation that this is a Lab 2 testing mechanism
(not login), a `<select>` of active Requesters, an informational note ("Only active development
requesters are shown"), a callout explaining Lab 3 will replace this with real authentication, and a
primary "Continue" button (disabled until a Requester is chosen). States: loading (spinner in place of
the select), empty (no active Requesters — message + no Continue), failure (safe error message + retry
action).

### 6.2 Create Ticket (Create Mode)
Single-column card at mobile, two-column grid at tablet/desktop. Field order top-to-bottom:
Category, Related System, Requested Priority (grouped classification row) → Summary → Description
(full-width, Description taller and resizable vertically only) → Attachments (drag/select area + list
of selected/uploaded files with per-file status) → primary "Submit Ticket" / secondary "Cancel" at the
bottom. Ticket Number and Ticket Date are not shown on this screen (they don't exist until after a
successful submit) — the success state below the form displays the returned Ticket Number prominently
with a "View Ticket" action.
States: initial, validation-failure (per-field messages), submitting (busy button, form otherwise
locked), success (Ticket Number + partial-attachment-failure summary if applicable), API-failure (safe
message, all entered values retained), invalid-attachment (per-file rejection message inline in the
attachment list, does not block the rest of the form).

### 6.3 My Tickets (List Mode)
Header row: search box, filter selects (Category, Related System, Requested Priority, Status), a Clear
Filters action, and a "Create Ticket" primary button. Desktop (≥992px): table with columns Ticket No.,
Created Date, Summary, Category, Requested Priority (badge), Current Status (badge), Last Updated,
opens Detail on row click. Mobile (<768px): the same data as a stacked card per ticket, each card
tappable. Pagination control at the bottom (page numbers + Previous/Next, respects the API's page-size
allowlist).
States: loading (skeleton rows/cards), empty (no tickets at all — "Create your first ticket" +
Create Ticket button), no-results (filters active but nothing matches — "No tickets match your filters" +
Clear Filters button, visually distinct from the empty state), failure (safe error + retry).

### 6.4 Requester Ticket Detail (View Mode)
Two clearly separated sections: (1) Ticket Information — all fields read-only in the styled read-only
field treatment (Ticket No., Ticket Date, Category, Related System, Requester, Requested Priority,
IT Priority [always "—" in Lab 2], Current Status, Ticket Owner [always "Unassigned" in Lab 2], Summary,
Description); (2) `AttachmentSection` — list of attachments (active and removed, removed ones visually
muted with a "Removed" badge and no download control), an upload control (disabled with an explanatory
note once 5 active attachments exist), and a remove action per active attachment that opens a
`ConfirmDialog` requiring a removal reason.
Does **not** implement Public Comments, Internal Notes, Actions Taken, or any status-change control —
explicitly out of scope.
Failure state (ticket not found or not owned) shows a single safe "Ticket not found" message — never a
raw 404 page, never a hint that the ticket might belong to someone else.

## 7. Component Rules (per labsheet §8.3, verbatim requirements applied)

- Labels above controls, consistent weight/spacing across all forms.
- Required fields show a red asterisk in addition to the validation message.
- All inputs share one consistent height except Description, which is taller and resizable without
  breaking the layout.
- Buttons always show visible text; icons support but never replace text.
- Every icon-only control has an accessible label and tooltip.
- Disabled controls are visually distinct and cannot be activated (real `disabled` attribute).
- Focus indicators remain visible for keyboard users at all times.
- The submit button shows a busy state and is disabled while its request is processing.
- Validation messages appear near their field, never as a single message at the top only.
- The success state clearly shows the generated Ticket Number and the next action.

## 8. Responsive Rules

| Viewport | Behavior |
|---|---|
| Desktop ≥992px | Multi-column layout as specified per screen; content max-width constrained and centered |
| Tablet 768–991px | Two-column layout where practical; Summary/Description retain full usable width |
| Mobile <768px | Fields stack vertically; buttons/inputs ≥44px touch height; My Tickets renders as cards, not a scrolling table |
| All sizes | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

## 9. Accessibility

- All interactive controls are reachable and operable by keyboard alone (native `<button>`, `<select>`,
  `<input>` elements — no click-only `<div>` controls).
- Form errors use `role="alert"` so they are announced, and `aria-invalid`/`aria-describedby` link the
  input to its error text.
- Color is never the only signal: status/priority badges pair color with text; success/error states pair
  color with an icon and a text message.
- `ConfirmDialog` (hand-rolled, not `react-bootstrap`) uses `role="dialog"` and `aria-modal="true"` and
  traps focus while open.

## 10. Visual Inspection and Screenshot Checklist

Checked manually and via Playwright screenshots at each viewport for Create Ticket, My Tickets, and
Ticket Detail, stored under `artifacts/lab-02/screenshots/`:
- [ ] No clipping, overlap, or unintended horizontal scrolling at any viewport
- [ ] Field styling consistent across all forms (editable vs. read-only vs. invalid)
- [ ] All required loading/empty/no-results/failure states reachable and correctly styled
- [ ] Priority and Status badges visually consistent and never color-only
- [ ] Filters, pagination, attachment controls, and empty states remain usable at all viewport sizes
- [ ] Screenshots compared against this document and the labsheet's illustrative figure, not memory

## 11. Rejected Alternative

Adding a Sass build and overriding Bootstrap's `$primary` variable at the Sass layer was considered — it
would recolor Bootstrap's components correctly in one line. It was rejected for a fixed five-color
palette: it adds a build dependency, changes the CSS import from the prebuilt file to
`bootstrap/scss/bootstrap.scss`, and meaningfully slows cold builds for a benefit that ~50 lines of CSS
custom properties and targeted overrides achieve just as correctly.
