import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import * as staffApi from "../../src/api/staff.js";
import * as commentsApi from "../../src/api/comments.js";
import * as notesApi from "../../src/api/notes.js";
import type { StaffAssignee } from "../../src/api/staff.js";
import type { TicketDetail } from "../../src/api/types.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const IT_STAFF_USER: AuthUser = {
  id: 2,
  fullName: "Priya Natarajan",
  email: "priya.natarajan@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};

const ASSIGNEES: StaffAssignee[] = [
  { id: 2, fullName: "Priya Natarajan", role: "IT_STAFF" },
  { id: 9, fullName: "Carlos Mendes", role: "IT_STAFF" },
];

const TICKET: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "VPN keeps disconnecting",
  description: "Disconnects every few minutes since the update.",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  status: "NEW",
  resolutionIndicated: false,
  ticketDate: "2026-01-01T00:00:00.000Z",
  requester: { id: 1, fullName: "Jennifer Anderson" },
  category: { id: 2, name: "Network" },
  relatedSystem: { id: 7, name: "VPN Client" },
  ticketOwner: null,
  attachments: [],
};

function renderDetail(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/staff/tickets/:ticketId" element={<StaffTicketDetail />} />
    </Routes>,
    { route, user: IT_STAFF_USER }
  );
}

describe("StaffTicketDetail", () => {
  beforeEach(() => {
    vi.spyOn(commentsApi, "listComments").mockResolvedValue([]);
    vi.spyOn(notesApi, "listNotes").mockResolvedValue([]);
    vi.spyOn(staffApi, "listAssignees").mockResolvedValue(ASSIGNEES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders ticket fields plus the Owner/IT Priority/Status controls (FR-09, UI)", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
    renderDetail("/staff/tickets/42");

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(screen.getByText("VPN keeps disconnecting")).toBeInTheDocument();
    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /claim/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/it priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
  });

  it("claims an unassigned ticket for the caller, shows a success message, and switches to the Reassign dropdown (FR-10, AC-06)", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
    const claimSpy = vi.spyOn(staffApi, "claimTicket").mockResolvedValue({
      ...TICKET,
      ticketOwner: { id: 2, fullName: "Priya Natarajan" },
      status: "OPEN",
    });

    renderDetail("/staff/tickets/42");
    await screen.findByText("TKT-2026-000042");

    await userEvent.click(screen.getByRole("button", { name: /claim/i }));

    await waitFor(() => expect(claimSpy).toHaveBeenCalledWith(42));
    expect(await screen.findByText(/ticket claimed/i)).toBeInTheDocument();
    // Now owned by the caller — the Claim button is replaced by the Reassign dropdown.
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /reassign to/i })).toHaveValue("2");
  });

  it("offers a Reassign dropdown listing active staff when the ticket is already owned (BR-14, ui-spec.md §4)", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue({
      ...TICKET,
      ticketOwner: { id: 9, fullName: "Carlos Mendes" },
    });
    renderDetail("/staff/tickets/42");

    await screen.findByText("TKT-2026-000042");
    const select = screen.getByRole("combobox", { name: /reassign to/i }) as HTMLSelectElement;
    expect(select).toHaveValue("9");
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toEqual(expect.arrayContaining(["Priya Natarajan", "Carlos Mendes"]));
  });

  it("reassigns to a different active staff member via the dropdown", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue({
      ...TICKET,
      ticketOwner: { id: 9, fullName: "Carlos Mendes" },
    });
    const claimSpy = vi.spyOn(staffApi, "claimTicket").mockResolvedValue({
      ...TICKET,
      ticketOwner: { id: 2, fullName: "Priya Natarajan" },
    });

    renderDetail("/staff/tickets/42");
    const select = await screen.findByRole("combobox", { name: /reassign to/i });

    await userEvent.selectOptions(select, "2");

    await waitFor(() => expect(claimSpy).toHaveBeenCalledWith(42, 2));
    expect(await screen.findByText(/reassigned to priya natarajan/i)).toBeInTheDocument();
  });

  it("sets IT Priority independently of Requested Priority and shows a success message (FR-11)", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
    const prioritySpy = vi.spyOn(staffApi, "setTicketPriority").mockResolvedValue({ ...TICKET, itPriority: "URGENT" });

    renderDetail("/staff/tickets/42");
    await screen.findByText("TKT-2026-000042");

    await userEvent.selectOptions(screen.getByLabelText(/it priority/i), "URGENT");

    await waitFor(() => expect(prioritySpy).toHaveBeenCalledWith(42, "URGENT"));
    expect(await screen.findByText(/it priority set to urgent/i)).toBeInTheDocument();
  });

  it("only offers valid next statuses and shows a 409 error without changing the displayed status (BR-17, AC-07)", async () => {
    vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET); // status: NEW
    renderDetail("/staff/tickets/42");
    await screen.findByText("TKT-2026-000042");

    const statusSelect = screen.getByLabelText(/^status$/i) as HTMLSelectElement;
    const optionValues = Array.from(statusSelect.options).map((o) => o.value).filter(Boolean);
    expect(optionValues.sort()).toEqual(["CANCELLED", "OPEN"]);

    const { ApiError } = await import("../../src/api/client.js");
    vi.spyOn(staffApi, "setTicketStatus").mockRejectedValue(new ApiError(409, "Cannot transition from NEW to CANCELLED"));

    await userEvent.selectOptions(statusSelect, "CANCELLED");

    expect(await screen.findByText(/cannot transition/i)).toBeInTheDocument();
  });
});
