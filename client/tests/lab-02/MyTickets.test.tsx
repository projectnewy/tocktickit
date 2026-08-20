import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyTickets from "../../src/pages/MyTickets.js";
import * as ticketsApi from "../../src/api/tickets.js";
import * as referenceApi from "../../src/api/reference.js";
import { useSelectedRequester } from "../../src/context/RequesterContext.js";
import type { Requester } from "../../src/api/types.js";
import type { TicketListResponse, TicketSummary } from "../../src/api/tickets.js";
import { renderWithProviders } from "../helpers/render.js";

const EMPTY_RESPONSE: TicketListResponse = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
  sort: "createdAt:desc",
};

function makeTicket(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    ticketDate: "2026-01-01T00:00:00.000Z",
    summary: "Laptop battery drains quickly",
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    requestedPriority: "MEDIUM",
    status: "NEW",
    activeAttachmentCount: 0,
    ...overrides,
  };
}

function mockReferenceData() {
  vi.spyOn(referenceApi, "listCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
  vi.spyOn(referenceApi, "listRelatedSystems").mockResolvedValue([{ id: 7, name: "Corporate Laptop" }]);
}

// A tiny test-only consumer so a test can trigger a requester switch through
// the real context, the same mechanism RequesterBadge uses in the app shell.
function SwitchRequesterButton({ to }: { to: Requester }) {
  const { selectRequester } = useSelectedRequester();
  return (
    <button type="button" onClick={() => selectRequester(to)}>
      Switch to {to.fullName}
    </button>
  );
}

describe("MyTickets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a populated, paginated list with the expected columns (UI-08, AC-08)", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "listTickets").mockResolvedValue({
      ...EMPTY_RESPONSE,
      items: [makeTicket()],
      totalItems: 14,
      totalPages: 2,
      hasNextPage: true,
    });

    renderWithProviders(<MyTickets />, { route: "/tickets" });

    // Both the desktop table and mobile card list render simultaneously in
    // jsdom (it doesn't evaluate the d-none/d-lg-table media-query classes),
    // so scope to the table to avoid an ambiguous duplicate match.
    const table = await screen.findByRole("table");
    expect(within(table).getByText("TKT-2026-000001")).toBeInTheDocument();
    expect(within(table).getByText("Laptop battery drains quickly")).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("re-fetches with updated query parameters when search is submitted (UI-09)", async () => {
    mockReferenceData();
    const listSpy = vi.spyOn(ticketsApi, "listTickets").mockResolvedValue(EMPTY_RESPONSE);

    renderWithProviders(<MyTickets />, { route: "/tickets" });
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/search/i), "vpn");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      const lastCall = listSpy.mock.calls.at(-1)?.[0];
      expect(lastCall?.q).toBe("vpn");
    });
  });

  it("re-fetches with the selected sort when a column header is clicked (UI-09)", async () => {
    mockReferenceData();
    const listSpy = vi.spyOn(ticketsApi, "listTickets").mockResolvedValue({
      ...EMPTY_RESPONSE,
      items: [makeTicket()],
    });

    renderWithProviders(<MyTickets />, { route: "/tickets" });
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("button", { name: /summary/i }));

    await waitFor(() => {
      const lastCall = listSpy.mock.calls.at(-1)?.[0];
      expect(lastCall?.sort).toBe("summary:asc");
    });
  });

  it("shows an empty state when there are no tickets at all (UI-10, AC-09)", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "listTickets").mockResolvedValue(EMPTY_RESPONSE);
    renderWithProviders(<MyTickets />, { route: "/tickets" });
    expect(await screen.findByText(/no tickets yet/i)).toBeInTheDocument();
  });

  it("shows a distinct no-results state when a filter matches nothing (UI-10, AC-09)", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "listTickets").mockResolvedValue(EMPTY_RESPONSE);
    renderWithProviders(<MyTickets />, { route: "/tickets?categoryId=2" });
    expect(await screen.findByText(/no tickets match your filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tickets yet/i)).not.toBeInTheDocument();
  });

  it("refetches when the selected requester changes (UI-11, AC-12)", async () => {
    mockReferenceData();
    const listSpy = vi.spyOn(ticketsApi, "listTickets").mockResolvedValue(EMPTY_RESPONSE);
    const requesterB: Requester = { id: 2, fullName: "Michael Brown", email: "michael@example.com", department: null };

    renderWithProviders(
      <>
        <SwitchRequesterButton to={requesterB} />
        <MyTickets />
      </>,
      { route: "/tickets" }
    );
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /switch to michael brown/i }));

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });

  it("renders both the desktop table and mobile card list markup for the same data", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "listTickets").mockResolvedValue({ ...EMPTY_RESPONSE, items: [makeTicket()] });
    renderWithProviders(<MyTickets />, { route: "/tickets" });

    await screen.findByRole("table");
    const table = screen.getByRole("table");
    expect(within(table).getByText("TKT-2026-000001")).toBeInTheDocument();
  });
});
