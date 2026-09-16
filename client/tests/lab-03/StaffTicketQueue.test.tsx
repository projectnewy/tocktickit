import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue.js";
import * as staffApi from "../../src/api/staff.js";
import * as referenceApi from "../../src/api/reference.js";
import type { StaffTicketListResponse, StaffTicketSummary } from "../../src/api/staff.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const IT_STAFF_USER: AuthUser = {
  id: 2,
  fullName: "Priya Natarajan",
  email: "priya.natarajan@example.com",
  role: "IT_STAFF",
  mustChangePassword: false,
};

const EMPTY_RESPONSE: StaffTicketListResponse = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
  sort: "createdAt:desc",
};

function makeTicket(overrides: Partial<StaffTicketSummary> = {}): StaffTicketSummary {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    ticketDate: "2026-01-01T00:00:00.000Z",
    lastUpdated: "2026-01-02T00:00:00.000Z",
    summary: "VPN keeps disconnecting",
    category: { id: 2, name: "Network" },
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "NEW",
    requester: { id: 5, fullName: "Alice Requester" },
    owner: null,
    ...overrides,
  };
}

function mockReferenceData() {
  vi.spyOn(referenceApi, "listCategories").mockResolvedValue([{ id: 2, name: "Network" }]);
}

describe("StaffTicketQueue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a populated queue including the Requester and Owner columns (UI, AC-09..AC-12)", async () => {
    mockReferenceData();
    vi.spyOn(staffApi, "listStaffTickets").mockResolvedValue({
      ...EMPTY_RESPONSE,
      items: [makeTicket()],
      totalItems: 14,
      totalPages: 2,
      hasNextPage: true,
    });

    renderWithProviders(<StaffTicketQueue />, { route: "/staff/tickets", user: IT_STAFF_USER });

    const table = await screen.findByRole("table");
    expect(await within(table).findByText("TKT-2026-000001")).toBeInTheDocument();
    expect(within(table).getByText("Alice Requester")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(await screen.findByText(/page 1 of 2/i)).toBeInTheDocument();
  });

  it("re-fetches with the owner filter when Owner: Me is selected (UI, FR-08)", async () => {
    mockReferenceData();
    const listSpy = vi.spyOn(staffApi, "listStaffTickets").mockResolvedValue(EMPTY_RESPONSE);

    renderWithProviders(<StaffTicketQueue />, { route: "/staff/tickets", user: IT_STAFF_USER });
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText(/owner/i), "me");

    await waitFor(() => {
      const lastCall = listSpy.mock.calls.at(-1)?.[0];
      expect(lastCall?.ownerId).toBe("me");
    });
  });

  it("re-fetches with the selected sort when a column header is clicked", async () => {
    mockReferenceData();
    const listSpy = vi.spyOn(staffApi, "listStaffTickets").mockResolvedValue({ ...EMPTY_RESPONSE, items: [makeTicket()] });

    renderWithProviders(<StaffTicketQueue />, { route: "/staff/tickets", user: IT_STAFF_USER });
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("button", { name: /status/i }));

    await waitFor(() => {
      const lastCall = listSpy.mock.calls.at(-1)?.[0];
      expect(lastCall?.sort).toBe("status:asc");
    });
  });

  it("shows an empty state when there are no tickets at all", async () => {
    mockReferenceData();
    vi.spyOn(staffApi, "listStaffTickets").mockResolvedValue(EMPTY_RESPONSE);
    renderWithProviders(<StaffTicketQueue />, { route: "/staff/tickets", user: IT_STAFF_USER });
    expect(await screen.findByText(/no tickets yet/i)).toBeInTheDocument();
  });

  it("shows a distinct no-results state when a filter matches nothing", async () => {
    mockReferenceData();
    vi.spyOn(staffApi, "listStaffTickets").mockResolvedValue(EMPTY_RESPONSE);
    renderWithProviders(<StaffTicketQueue />, { route: "/staff/tickets?categoryId=2", user: IT_STAFF_USER });
    expect(await screen.findByText(/no tickets match your filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tickets yet/i)).not.toBeInTheDocument();
  });
});
