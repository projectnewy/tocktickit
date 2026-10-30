import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import * as staffApi from "../../src/api/staff.js";
import * as commentsApi from "../../src/api/comments.js";
import * as notesApi from "../../src/api/notes.js";
import { ApiError } from "../../src/api/client.js";
import type { AuthUser, TicketDetail } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const STAFF: AuthUser = { id: 2, fullName: "Priya Natarajan", email: "priya.natarajan@example.com", role: "IT_STAFF", mustChangePassword: false };

const TICKET: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "VPN keeps disconnecting",
  description: "Disconnects every few minutes since the update.",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  status: "IN_PROGRESS",
  resolutionIndicated: false,
  version: 3,
  resolvedAt: null,
  ticketDate: "2026-01-01T00:00:00.000Z",
  requester: { id: 1, fullName: "Jennifer Anderson" },
  category: { id: 2, name: "Network" },
  relatedSystem: { id: 7, name: "VPN Client" },
  ticketOwner: { id: 2, fullName: "Priya Natarajan" },
  attachments: [],
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/staff/tickets/:ticketId" element={<StaffTicketDetail />} />
    </Routes>,
    { route: "/staff/tickets/42", user: STAFF }
  );
}

const statusOptions = () =>
  Array.from((screen.getByLabelText(/^status$/i) as HTMLSelectElement).options)
    .map((option) => option.value)
    .filter(Boolean);

// UI-08 / UI-09 (tests.md): the status control, the resolution-gate message, the stale-version prompt.
describe("Ticket workflow controls", () => {
  beforeEach(() => {
    vi.spyOn(commentsApi, "listComments").mockResolvedValue([]);
    vi.spyOn(notesApi, "listNotes").mockResolvedValue([]);
    vi.spyOn(staffApi, "listAssignees").mockResolvedValue([{ id: 2, fullName: "Priya Natarajan", role: "IT_STAFF" }]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe("permitted transitions only (UI-08, BR-13)", () => {
    const EXPECTED: Record<string, string[]> = {
      NEW: ["CANCELLED", "OPEN"],
      OPEN: ["CANCELLED", "IN_PROGRESS"],
      IN_PROGRESS: ["RESOLVED", "WAITING_FOR_REQUESTER"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["IN_PROGRESS"],
      CANCELLED: [],
    };

    for (const [from, allowed] of Object.entries(EXPECTED)) {
      it(`offers ${allowed.length ? allowed.join(", ") : "nothing"} from ${from}`, async () => {
        vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue({ ...TICKET, status: from as TicketDetail["status"] });
        renderDetail();
        await screen.findByText("TKT-2026-000042");
        expect(statusOptions().sort()).toEqual([...allowed].sort());
        if (allowed.length === 0) expect(screen.getByLabelText(/^status$/i)).toBeDisabled();
      });
    }

    it("sends the version the screen last read and refreshes the summary status from the response (UI-08)", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      const setStatus = vi.spyOn(staffApi, "setTicketStatus").mockResolvedValue({ ...TICKET, status: "WAITING_FOR_REQUESTER", version: 4 });
      renderDetail();
      await screen.findByText("TKT-2026-000042");

      await userEvent.selectOptions(screen.getByLabelText(/^status$/i), "WAITING_FOR_REQUESTER");

      await waitFor(() => expect(setStatus).toHaveBeenCalledWith(42, 3, "WAITING_FOR_REQUESTER"));
      expect(await screen.findByText("Status changed to Waiting for Requester.")).toBeInTheDocument();
      // The header badge now shows the new status, and the next change would carry version 4.
      expect(screen.getAllByText("Waiting for Requester").length).toBeGreaterThan(0);
      expect(statusOptions().sort()).toEqual(["IN_PROGRESS", "RESOLVED"]);
    });
  });

  describe("resolution gate message (UI-08, AC-10)", () => {
    it("explains in plain language what is still missing, with no raw codes", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      vi.spyOn(staffApi, "setTicketStatus").mockRejectedValue(
        new ApiError(409, "This ticket cannot be resolved yet", { code: "RESOLUTION_GATE", unmet: ["NO_COMPLETED_ACTION", "OPEN_PLANNED_ACTIONS"] })
      );
      renderDetail();
      await screen.findByText("TKT-2026-000042");

      await userEvent.selectOptions(screen.getByLabelText(/^status$/i), "RESOLVED");

      const alert = await screen.findByText("This ticket cannot be resolved yet.");
      const box = alert.closest("[role='alert']") as HTMLElement;
      expect(within(box).getByText("Record at least one completed action.")).toBeInTheDocument();
      expect(within(box).getByText("Complete or cancel all planned actions.")).toBeInTheDocument();
      expect(box.textContent).not.toMatch(/NO_COMPLETED_ACTION|OPEN_PLANNED_ACTIONS|RESOLUTION_GATE/);
      // The ticket still shows its old status and offers no reload (this is not a conflict).
      expect(screen.queryByRole("button", { name: /reload ticket/i })).not.toBeInTheDocument();
      expect(statusOptions().sort()).toEqual(["RESOLVED", "WAITING_FOR_REQUESTER"]);
    });

    it("shows only the reason that applies", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      vi.spyOn(staffApi, "setTicketStatus").mockRejectedValue(
        new ApiError(409, "This ticket cannot be resolved yet", { code: "RESOLUTION_GATE", unmet: ["OPEN_PLANNED_ACTIONS"] })
      );
      renderDetail();
      await screen.findByText("TKT-2026-000042");
      await userEvent.selectOptions(screen.getByLabelText(/^status$/i), "RESOLVED");

      expect(await screen.findByText("Complete or cancel all planned actions.")).toBeInTheDocument();
      expect(screen.queryByText("Record at least one completed action.")).not.toBeInTheDocument();
    });
  });

  describe("stale version (UI-09, AC-09)", () => {
    const stale = () => new ApiError(409, "This ticket was changed by someone else", { code: "STALE_VERSION", currentVersion: 5 });

    it.each([
      ["status", () => userEvent.selectOptions(screen.getByLabelText(/^status$/i), "WAITING_FOR_REQUESTER"), "setTicketStatus"],
      ["IT priority", () => userEvent.selectOptions(screen.getByLabelText(/it priority/i), "HIGH"), "setTicketPriority"],
    ] as const)("a stale %s change shows a message and a Reload ticket action that loads the latest version", async (_label, act, apiName) => {
      const get = vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      vi.spyOn(staffApi, apiName).mockRejectedValue(stale());
      renderDetail();
      await screen.findByText("TKT-2026-000042");

      await act();

      expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
      const reload = screen.getByRole("button", { name: /reload ticket/i });

      get.mockResolvedValue({ ...TICKET, status: "WAITING_FOR_REQUESTER", version: 5 });
      await userEvent.click(reload);

      expect(await screen.findByText("Ticket reloaded.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reload ticket/i })).not.toBeInTheDocument();
      expect(get).toHaveBeenCalledTimes(2);
      // The reloaded ticket's version (5) is what the next change sends.
      const next = vi.spyOn(staffApi, "setTicketStatus").mockResolvedValue({ ...TICKET, status: "IN_PROGRESS", version: 6 });
      await userEvent.selectOptions(screen.getByLabelText(/^status$/i), "IN_PROGRESS");
      await waitFor(() => expect(next).toHaveBeenCalledWith(42, 5, "IN_PROGRESS"));
    });

    it("a stale reassignment offers the same reload", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      vi.spyOn(staffApi, "claimTicket").mockRejectedValue(stale());
      vi.spyOn(staffApi, "listAssignees").mockResolvedValue([
        { id: 2, fullName: "Priya Natarajan", role: "IT_STAFF" },
        { id: 9, fullName: "Carlos Mendes", role: "IT_STAFF" },
      ]);
      renderDetail();
      await screen.findByText("TKT-2026-000042");

      await userEvent.selectOptions(await screen.findByRole("combobox", { name: /reassign to/i }), "9");

      expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reload ticket/i })).toBeInTheDocument();
    });

    it("shows a safe message, never the raw error, when the reload itself fails", async () => {
      const get = vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      vi.spyOn(staffApi, "setTicketStatus").mockRejectedValue(stale());
      renderDetail();
      await screen.findByText("TKT-2026-000042");
      await userEvent.selectOptions(screen.getByLabelText(/^status$/i), "WAITING_FOR_REQUESTER");
      const reload = await screen.findByRole("button", { name: /reload ticket/i });

      get.mockRejectedValue(new Error("network down"));
      await userEvent.click(reload);

      expect(await screen.findByText(/unable to reload this ticket/i)).toBeInTheDocument();
      expect(screen.queryByText(/network down/)).not.toBeInTheDocument();
    });
  });

  describe("Requester advice (FR-08)", () => {
    it("shows an advisory notice to staff when the Requester says the problem appears resolved, without changing the status", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue({ ...TICKET, resolutionIndicated: true });
      renderDetail();
      await screen.findByText("TKT-2026-000042");

      expect(screen.getByText("Requester says the problem appears resolved")).toBeInTheDocument();
      expect(screen.getByText(/advisory only/i)).toBeInTheDocument();
      expect(statusOptions().sort()).toEqual(["RESOLVED", "WAITING_FOR_REQUESTER"]); // still needs staff action
    });

    it("shows no notice when the Requester has not said so", async () => {
      vi.spyOn(staffApi, "getStaffTicket").mockResolvedValue(TICKET);
      renderDetail();
      await screen.findByText("TKT-2026-000042");
      expect(screen.queryByText(/requester says the problem/i)).not.toBeInTheDocument();
    });
  });
});
