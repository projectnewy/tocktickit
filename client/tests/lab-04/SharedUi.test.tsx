import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Modal } from "../../src/components/ui/Modal.js";
import { TicketTable } from "../../src/components/tickets/TicketTable.js";
import { TicketCardList } from "../../src/components/tickets/TicketCardList.js";
import { StaffTicketTable } from "../../src/components/staff/StaffTicketTable.js";
import { TicketFilters } from "../../src/components/tickets/TicketFilters.js";
import { StaffTicketFilters } from "../../src/components/staff/StaffTicketFilters.js";
import { UserFormModal } from "../../src/components/admin/UserFormModal.js";
import { StatusBadge } from "../../src/components/ui/StatusBadge.js";
import { PriorityBadge } from "../../src/components/ui/PriorityBadge.js";
import { RoleBadge } from "../../src/components/ui/RoleBadge.js";
import { AppShell } from "../../src/components/layout/AppShell.js";
import Login from "../../src/pages/Login.js";
import ChangePassword from "../../src/pages/ChangePassword.js";
import * as authApi from "../../src/api/auth.js";
import * as referenceApi from "../../src/api/reference.js";
import type { TicketSummary } from "../../src/api/tickets.js";
import type { StaffTicketSummary } from "../../src/api/staff.js";
import { PRIORITY_VALUES, ROLE_VALUES, STATUS_VALUES } from "../../src/config/labels.js";
import themeCss from "../../src/styles/theme.css?raw";
import { renderWithProviders, DEFAULT_TEST_USER } from "../helpers/render.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- STYLE-01
function ModalHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {open && (
        <Modal
          title="Sample dialog"
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <div className="modal-body">
            <input aria-label="First field" />
            <button type="button">Middle action</button>
          </div>
          <div className="modal-footer">
            <button type="button">Last action</button>
          </div>
        </Modal>
      )}
    </>
  );
}

describe("STYLE-01 shared Modal (AC-24, FR-18)", () => {
  it("is a labelled modal dialog and moves focus to the first control in its body", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: /open dialog/i }));

    const dialog = screen.getByRole("dialog", { name: "Sample dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByLabelText("First field")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the element that opened it", async () => {
    const onClose = vi.fn();
    render(<ModalHarness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: /open dialog/i });
    await userEvent.click(opener);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("traps Tab and Shift+Tab inside the dialog", async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole("button", { name: /open dialog/i }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close" });
    const last = within(dialog).getByRole("button", { name: "Last action" });

    last.focus();
    await userEvent.tab();
    expect(close).toHaveFocus(); // wrapped forward to the first focusable

    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus(); // wrapped backward to the last focusable
  });

  it("ignores Escape while a request is in flight (closeDisabled)", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Busy" onClose={onClose} closeDisabled>
        <div className="modal-body">
          <input aria-label="Field" />
        </div>
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------- STYLE-02
const TICKET: TicketSummary = {
  id: 7,
  ticketNumber: "TKT-2026-000007",
  ticketDate: "2026-01-01T00:00:00.000Z",
  summary: "Printer jams on tray 2",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 6, name: "Printer" },
  requestedPriority: "HIGH",
  status: "IN_PROGRESS",
  activeAttachmentCount: 0,
};

const STAFF_TICKET: StaffTicketSummary = {
  id: 9,
  ticketNumber: "TKT-2026-000009",
  ticketDate: "2026-01-01T00:00:00.000Z",
  lastUpdated: "2026-01-02T00:00:00.000Z",
  summary: "VPN keeps disconnecting",
  category: { id: 4, name: "Network" },
  requestedPriority: "MEDIUM",
  itPriority: "URGENT",
  status: "WAITING_FOR_REQUESTER",
  requester: { id: 1, fullName: "Jennifer Anderson" },
  owner: null,
};

describe("STYLE-02 keyboard-operable rows and sortable headers (AC-24, FR-18)", () => {
  function renderRoutes(element: React.ReactNode, path: string, detailPath: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path={detailPath} element={<div>Ticket detail page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it.each([["{Enter}"], [" "]])("opens a ticket from a My Tickets row with the %j key", async (key) => {
    renderRoutes(
      <TicketTable tickets={[TICKET]} sort="createdAt:desc" onSortChange={() => {}} />,
      "/tickets",
      "/tickets/:ticketId"
    );
    const row = screen.getByRole("row", { name: "Open TKT-2026-000007" });
    expect(row).toHaveAttribute("tabindex", "0");

    row.focus();
    await userEvent.keyboard(key);

    expect(await screen.findByText("Ticket detail page")).toBeInTheDocument();
  });

  it("opens a ticket from a Staff Queue row with the keyboard", async () => {
    renderRoutes(
      <StaffTicketTable tickets={[STAFF_TICKET]} sort="createdAt:desc" onSortChange={() => {}} />,
      "/staff/tickets",
      "/staff/tickets/:ticketId"
    );
    screen.getByRole("row", { name: "Open TKT-2026-000009" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Ticket detail page")).toBeInTheDocument();
  });

  it("opens a ticket from a mobile card with Enter and Space (role=button, focusable)", async () => {
    renderRoutes(<TicketCardList tickets={[TICKET]} />, "/tickets", "/tickets/:ticketId");
    const card = screen.getAllByRole("button")[0];
    expect(card).toHaveAttribute("tabindex", "0");
    card.focus();
    await userEvent.keyboard(" ");
    expect(await screen.findByText("Ticket detail page")).toBeInTheDocument();
  });

  it("exposes aria-sort and sorts with Enter and Space on a header button", async () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <TicketTable tickets={[TICKET]} sort="createdAt:desc" onSortChange={onSortChange} />
      </MemoryRouter>
    );
    const summaryHeader = screen.getByRole("columnheader", { name: /summary/i });
    expect(summaryHeader).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: /created date/i })).toHaveAttribute("aria-sort", "descending");

    const button = within(summaryHeader).getByRole("button");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSortChange).toHaveBeenLastCalledWith("summary:asc");
    await userEvent.keyboard(" ");
    expect(onSortChange).toHaveBeenCalledTimes(2);

    rerender(
      <MemoryRouter>
        <TicketTable tickets={[TICKET]} sort="summary:asc" onSortChange={onSortChange} />
      </MemoryRouter>
    );
    expect(screen.getByRole("columnheader", { name: /summary/i })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(screen.getByRole("columnheader", { name: /summary/i })).getByRole("button"));
    expect(onSortChange).toHaveBeenLastCalledWith("summary:desc");
  });
});

// ---------------------------------------------------------------- STYLE-03
const RAW_ENUM = /\b(NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CLOSED|REOPENED|CANCELLED|LOW|MEDIUM|HIGH|URGENT|REQUESTER|IT_STAFF|ADMINISTRATOR)\b/;

describe("STYLE-03 no raw enum text (AC-24, FR-18)", () => {
  it("renders friendly text in every badge", () => {
    render(
      <>
        {STATUS_VALUES.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        {PRIORITY_VALUES.map((p) => (
          <PriorityBadge key={p} priority={p} />
        ))}
        {ROLE_VALUES.map((r) => (
          <RoleBadge key={r} role={r} />
        ))}
      </>
    );
    expect(document.body.textContent).not.toMatch(RAW_ENUM);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();
  });

  it("renders friendly text in the ticket and queue filters and the data rows", async () => {
    vi.spyOn(referenceApi, "listCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
    vi.spyOn(referenceApi, "listRelatedSystems").mockResolvedValue([{ id: 6, name: "Printer" }]);
    render(
      <MemoryRouter>
        <TicketFilters query={{}} onChange={() => {}} onClear={() => {}} />
        <StaffTicketFilters query={{}} onChange={() => {}} onClear={() => {}} />
        <StaffTicketTable tickets={[STAFF_TICKET]} sort="createdAt:desc" onSortChange={() => {}} />
      </MemoryRouter>
    );
    await screen.findAllByRole("option", { name: "Hardware" });

    expect(document.body.textContent).not.toMatch(RAW_ENUM);
    expect(screen.getAllByRole("option", { name: "Waiting for Requester" }).length).toBeGreaterThan(0);
    // Option values stay the raw enum — only the visible text is friendly.
    const statusOption = screen.getAllByRole("option", { name: "In Progress" })[0] as HTMLOptionElement;
    expect(statusOption.value).toBe("IN_PROGRESS");
  });

  it("renders friendly role names in the user form", () => {
    render(<UserFormModal currentUserId={1} onCancel={() => {}} onSaved={() => {}} />);
    expect(document.body.textContent).not.toMatch(RAW_ENUM);
    const roleSelect = screen.getByLabelText(/^role/i) as HTMLSelectElement;
    expect(Array.from(roleSelect.options).map((o) => o.textContent)).toEqual(["Requester", "IT Staff", "Administrator"]);
    expect(Array.from(roleSelect.options).map((o) => o.value)).toEqual(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]);
  });
});

// ---------------------------------------------------------------- STYLE-04
describe("STYLE-04 below-field validation on Login and Change Password (FR-18)", () => {
  it("Login shows a message under each empty field, wired with aria-describedby, and does not call the API", async () => {
    const loginSpy = vi.spyOn(authApi, "login");
    renderWithProviders(<Login />, { route: "/login", user: null });
    await userEvent.click(await screen.findByRole("button", { name: /sign in/i }));

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/^password/i);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(email.getAttribute("aria-describedby")!)).toHaveTextContent("Email is required.");
    expect(document.getElementById(password.getAttribute("aria-describedby")!)).toHaveTextContent("Password is required.");
    // The message is the field's next sibling: below the control, not a form-top banner.
    expect(email.nextElementSibling).toHaveTextContent("Email is required.");
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it("Login rejects a malformed email under the field", async () => {
    renderWithProviders(<Login />, { route: "/login", user: null });
    await userEvent.type(await screen.findByLabelText(/email/i), "not-an-email");
    await userEvent.type(screen.getByLabelText(/^password/i), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByLabelText(/email/i).nextElementSibling).toHaveTextContent("Enter a valid email address.");
  });

  it("Change Password shows each message under its own field and does not call the API", async () => {
    const apiSpy = vi.spyOn(authApi, "changePassword");
    renderWithProviders(<ChangePassword />, {
      route: "/change-password",
      user: { ...DEFAULT_TEST_USER, mustChangePassword: true },
    });
    await userEvent.type(await screen.findByLabelText(/^new password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(screen.getByLabelText(/current password/i).nextElementSibling).toHaveTextContent("Current password is required.");
    expect(screen.getByLabelText(/^new password/i).nextElementSibling).toHaveTextContent("Password must be 8–72 characters.");
    expect(screen.getByLabelText(/confirm new password/i).nextElementSibling).toHaveTextContent("Please confirm your new password.");
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("the user form keeps typed values and shows messages below the fields", async () => {
    render(<UserFormModal currentUserId={1} onCancel={() => {}} onSaved={() => {}} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "New Hire");
    await userEvent.click(screen.getByRole("button", { name: /create user/i }));

    expect(screen.getByLabelText(/^name/i)).toHaveValue("New Hire");
    expect(screen.getByLabelText(/^email/i).nextElementSibling).toHaveTextContent("Email is required.");
    expect(screen.getByLabelText(/initial password/i).nextElementSibling).toHaveTextContent("Initial password is required.");
  });
});

// ---------------------------------------------------------------- STYLE-05
describe("STYLE-05 visible focus on every interactive element (AC-24, FR-18)", () => {
  // jsdom does not resolve CSS custom properties or :focus-visible, so the
  // stylesheet itself is asserted here; the computed-style/visual check runs
  // in Playwright (e2e/lab-04) per tests.md.
  it.each([
    ".form-control:focus",
    ".form-select:focus",
    ".btn:focus-visible",
    "a:focus-visible",
    ".tk-nav-link:focus-visible",
    ".tk-sort-button:focus-visible",
    ".page-link:focus-visible",
    ".btn-close:focus-visible",
    ".form-check-input:focus-visible",
    ".tk-clickable-row:focus-visible",
    '[role="button"]:focus-visible',
  ])("has a focus rule for %s", (selector) => {
    expect(themeCss).toContain(selector);
  });

  it("uses an outline for non-button elements and a white ring on the green header", () => {
    expect(themeCss).toMatch(/outline:\s*3px solid var\(--tk-green-secondary\)/);
    expect(themeCss).toMatch(/\.tk-app-header \.btn:focus-visible/);
    expect(themeCss).toMatch(/outline:\s*3px solid #ffffff/);
  });

  it("gives keyboard users a skip link to the focusable main region", () => {
    renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
      { route: "/tickets", user: DEFAULT_TEST_USER }
    );
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
