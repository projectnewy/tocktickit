import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import StaffDashboard from "../../src/pages/StaffDashboard.js";
import * as dashboardApi from "../../src/api/dashboard.js";
import { ApiError } from "../../src/api/client.js";
import type { StaffDashboard as DashboardData, StaffDashboardTicket } from "../../src/api/dashboard.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const ACTIVE_QS = "status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED";

const STAFF: AuthUser = { id: 2, fullName: "Priya Natarajan", email: "priya@example.com", role: "IT_STAFF", mustChangePassword: false };
const ADMIN: AuthUser = { ...STAFF, id: 1, fullName: "Olivia Grant", role: "ADMINISTRATOR" };

function ticket(id: number, overrides: Partial<StaffDashboardTicket> = {}): StaffDashboardTicket {
  return {
    id,
    ticketNumber: `TKT-2026-0000${id}`,
    summary: `Summary of ticket ${id}`,
    status: "IN_PROGRESS",
    itPriority: "URGENT",
    updatedAt: "2026-10-29T08:00:00.000Z",
    owner: { id: 2, fullName: "Priya Natarajan" },
    ...overrides,
  };
}

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    timeZone: "Asia/Bangkok",
    windowStart: "2026-10-23T17:00:00.000Z",
    unassigned: { count: 3, link: `/staff/tickets?ownerId=unassigned&${ACTIVE_QS}` },
    ownedByMe: { count: 5, link: `/staff/tickets?ownerId=me&${ACTIVE_QS}` },
    byStatus: [
      { status: "NEW", count: 3, link: "/staff/tickets?status=NEW" },
      { status: "OPEN", count: 4, link: "/staff/tickets?status=OPEN" },
      { status: "IN_PROGRESS", count: 2, link: "/staff/tickets?status=IN_PROGRESS" },
      { status: "WAITING_FOR_REQUESTER", count: 0, link: "/staff/tickets?status=WAITING_FOR_REQUESTER" },
      { status: "REOPENED", count: 1, link: "/staff/tickets?status=REOPENED" },
    ],
    byItPriority: [
      { itPriority: "LOW", count: 1, link: `/staff/tickets?itPriority=LOW&${ACTIVE_QS}` },
      { itPriority: "MEDIUM", count: 4, link: `/staff/tickets?itPriority=MEDIUM&${ACTIVE_QS}` },
      { itPriority: "HIGH", count: 3, link: `/staff/tickets?itPriority=HIGH&${ACTIVE_QS}` },
      { itPriority: "URGENT", count: 2, link: `/staff/tickets?itPriority=URGENT&${ACTIVE_QS}` },
    ],
    urgentTickets: { items: [ticket(21), ticket(22, { status: "OPEN", owner: null })], link: `/staff/tickets?itPriority=URGENT&${ACTIVE_QS}` },
    recentlyUpdated: { items: [ticket(31, { status: "CLOSED", itPriority: "LOW" })], link: "/staff/tickets?sort=updatedAt:desc" },
    myPlannedActions: {
      count: 7,
      items: [
        { id: 1, ticketId: 21, ticketNumber: "TKT-2026-000021", description: "Replace the access point", actionDateTime: "2026-10-30T09:00:00.000Z" },
        { id: 2, ticketId: 22, ticketNumber: "TKT-2026-000022", description: "Call the supplier", actionDateTime: "2026-10-31T09:00:00.000Z" },
      ],
    },
    ...overrides,
  };
}

const EMPTY = data({
  unassigned: { count: 0, link: `/staff/tickets?ownerId=unassigned&${ACTIVE_QS}` },
  ownedByMe: { count: 0, link: `/staff/tickets?ownerId=me&${ACTIVE_QS}` },
  byStatus: data().byStatus.map((r) => ({ ...r, count: 0 })),
  byItPriority: data().byItPriority.map((r) => ({ ...r, count: 0 })),
  urgentTickets: { items: [], link: `/staff/tickets?itPriority=URGENT&${ACTIVE_QS}` },
  recentlyUpdated: { items: [], link: "/staff/tickets?sort=updatedAt:desc" },
  myPlannedActions: { count: 0, items: [] },
});

function renderDashboard(user: AuthUser = STAFF) {
  return renderWithProviders(
    <Routes>
      <Route path="/staff/dashboard" element={<StaffDashboard />} />
    </Routes>,
    { route: "/staff/dashboard", user }
  );
}

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("StaffDashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("cards and panels (UI-11, AC-14)", () => {
    it("shows the Unassigned and Owned by Me counts with View links", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data());
      renderDashboard();

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.getByText(/Welcome back, Priya Natarajan/)).toBeInTheDocument();
      expect(region("Unassigned").getByText("3")).toBeInTheDocument();
      expect(region("Owned by Me").getByText("5")).toBeInTheDocument();
      expect(region("Unassigned").getByRole("link", { name: "View Unassigned" })).toHaveAttribute("href", `/staff/tickets?ownerId=unassigned&${ACTIVE_QS}`);
    });

    it("By Status and By IT Priority list every row, zeros included, each a link to the filtered queue, with friendly labels", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      const status = region("By Status");
      expect(status.getAllByRole("listitem")).toHaveLength(5);
      expect(status.getByText("Waiting for Requester")).toBeInTheDocument();
      expect(status.getByRole("link", { name: "NEW: 3" })).toHaveAttribute("href", "/staff/tickets?status=NEW");
      expect(status.getByRole("link", { name: "WAITING_FOR_REQUESTER: 0" })).toHaveAttribute("href", "/staff/tickets?status=WAITING_FOR_REQUESTER"); // a zero is still listed and clickable

      const priority = region("By IT Priority");
      expect(priority.getAllByRole("listitem")).toHaveLength(4);
      for (const label of ["Low", "Medium", "High", "Urgent"]) expect(priority.getByText(label)).toBeInTheDocument();
      expect(priority.getByRole("link", { name: "URGENT: 2" })).toHaveAttribute("href", `/staff/tickets?itPriority=URGENT&${ACTIVE_QS}`);
    });

    it("Urgent and Recently Updated list tickets with number, summary, friendly status and priority, linking to the staff detail", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      const urgent = region("Urgent Tickets");
      expect(urgent.getAllByRole("listitem")).toHaveLength(2);
      expect(urgent.getByRole("link", { name: /TKT-2026-000021/ })).toHaveAttribute("href", "/staff/tickets/21");
      expect(urgent.getByText("In Progress")).toBeInTheDocument();
      expect(urgent.getAllByText("Urgent").length).toBeGreaterThan(0);
      expect(urgent.getByRole("link", { name: /View all/ })).toHaveAttribute("href", `/staff/tickets?itPriority=URGENT&${ACTIVE_QS}`);

      expect(region("Recently Updated").getByText("Closed")).toBeInTheDocument();
      expect(region("Recently Updated").getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/staff/tickets?sort=updatedAt:desc");
    });

    it("never shows a raw enum value as text", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });
      const visible = document.body.textContent ?? "";
      expect(visible).not.toMatch(/IN_PROGRESS|WAITING_FOR_REQUESTER|REOPENED|ADMINISTRATOR|IT_STAFF/);
    });

    it("My Planned Actions is one combined card: the total in the header, up to 5 items linking to the ticket, no separate count card", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      const card = region("My Planned Actions");
      expect(card.getByRole("heading", { name: /My Planned Actions/ })).toHaveTextContent("7");
      expect(card.getAllByRole("listitem")).toHaveLength(2);
      expect(card.getByRole("link", { name: /TKT-2026-000021/ })).toHaveAttribute("href", "/staff/tickets/21");
      expect(card.getByText("Replace the access point")).toBeInTheDocument();
      expect(screen.getAllByRole("region", { name: /Planned/ })).toHaveLength(1);
    });
  });

  describe("empty state (AC-15)", () => {
    it("zeros, every row still listed, and a clear message in each empty list", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(EMPTY);
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      expect(region("Unassigned").getByText("0")).toBeInTheDocument();
      expect(region("By Status").getAllByRole("listitem")).toHaveLength(5);
      expect(region("By IT Priority").getAllByRole("listitem")).toHaveLength(4);
      expect(region("Urgent Tickets").getByText("No urgent tickets right now.")).toBeInTheDocument();
      expect(region("Recently Updated").getByText("No tickets updated in the last 7 days.")).toBeInTheDocument();
      expect(region("My Planned Actions").getByText("No planned actions assigned to you.")).toBeInTheDocument();
      expect(region("My Planned Actions").getByRole("heading")).toHaveTextContent("0");
    });
  });

  describe("Administrator", () => {
    const COUNTS = { REQUESTER: 5, IT_STAFF: 4, ADMINISTRATOR: 1, inactive: 2 };

    it("sees a Users card with the account counts and a link to Users; IT Staff do not", async () => {
      const get = vi.spyOn(dashboardApi, "getStaffDashboard").mockResolvedValue(data({ userCounts: COUNTS }));
      renderDashboard(ADMIN);

      await screen.findByRole("region", { name: "Users" });
      const users = region("Users");
      expect(users.getByText("Active Requesters").nextElementSibling).toHaveTextContent("5");
      expect(users.getByText("Active IT Staff").nextElementSibling).toHaveTextContent("4");
      expect(users.getByText("Active Administrators").nextElementSibling).toHaveTextContent("1");
      expect(users.getByText("Inactive accounts").nextElementSibling).toHaveTextContent("2");
      expect(users.getByRole("link", { name: "View Users" })).toHaveAttribute("href", "/admin/users");

      get.mockResolvedValue(data());
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(screen.queryByRole("region", { name: "Users" })).not.toBeInTheDocument());
    });
  });

  describe("states (UI-15)", () => {
    it("shows a loading state first", () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockReturnValue(new Promise(() => {}));
      renderDashboard();
      expect(screen.getByText("Loading the dashboard…")).toBeInTheDocument();
    });

    it("shows a safe failure with Retry, never a raw error or a half-drawn dashboard, and Retry recovers", async () => {
      const get = vi.spyOn(dashboardApi, "getStaffDashboard").mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:3000"));
      renderDashboard();

      expect(await screen.findByText("Unable to load the dashboard right now.")).toBeInTheDocument();
      expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
      expect(screen.queryByRole("region")).not.toBeInTheDocument();

      get.mockResolvedValue(data());
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByRole("region", { name: "Unassigned" })).toBeInTheDocument();
    });

    it("a refused request from a non-Requester shows a clear message", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockRejectedValue(new ApiError(403, "Forbidden"));
      renderDashboard();
      expect(await screen.findByText("You do not have access to this dashboard.")).toBeInTheDocument();
    });
  });
});
