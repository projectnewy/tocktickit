import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import RequesterTicketDetail from "../../src/pages/RequesterTicketDetail.js";
import * as ticketsApi from "../../src/api/tickets.js";
import { ApiError } from "../../src/api/client.js";
import type { TicketDetail } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const TICKET: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  description: "The battery drains much faster than usual even when the system is idle.",
  requestedPriority: "MEDIUM",
  itPriority: null,
  status: "NEW",
  ticketDate: "2026-01-01T00:00:00.000Z",
  requester: { id: 1, fullName: "Jennifer Anderson" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  ticketOwner: null,
  attachments: [],
};

// RequesterTicketDetail reads :ticketId via useParams, which needs an actual
// <Route> match rather than a bare initialEntries string.
function renderDetail(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/tickets/:ticketId" element={<RequesterTicketDetail />} />
    </Routes>,
    { route }
  );
}

describe("RequesterTicketDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all ticket fields as read-only (UI-12, FR-10)", async () => {
    vi.spyOn(ticketsApi, "getTicket").mockResolvedValue(TICKET);
    renderDetail("/tickets/42");

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
    expect(screen.getByText(/the battery drains much faster/i)).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Corporate Laptop")).toBeInTheDocument();
    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();

    // Read-only fields render as plain text, not editable form controls.
    expect(screen.queryByRole("textbox", { name: /summary/i })).not.toBeInTheDocument();
  });

  it("shows a safe 'not found' message for a nonexistent or not-owned ticket, never a raw error (UI-13, AC-03)", async () => {
    vi.spyOn(ticketsApi, "getTicket").mockRejectedValue(new ApiError(404, "Ticket not found"));
    renderDetail("/tickets/999");

    expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/laptop battery/i)).not.toBeInTheDocument();
  });

  it("shows the same safe message for an invalid ticket id without calling the API", async () => {
    const getSpy = vi.spyOn(ticketsApi, "getTicket");
    renderDetail("/tickets/not-a-number");

    expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });
});
