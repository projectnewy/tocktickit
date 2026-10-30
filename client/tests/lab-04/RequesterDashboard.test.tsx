import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import RequesterDashboard from "../../src/pages/RequesterDashboard.js";
import { AppHeader } from "../../src/components/layout/AppHeader.js";
import * as dashboardApi from "../../src/api/dashboard.js";
import { ApiError } from "../../src/api/client.js";
import type { DashboardTicket, RequesterDashboard as DashboardData } from "../../src/api/dashboard.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const OPEN_LINK = "/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED";

function ticket(id: number, overrides: Partial<DashboardTicket> = {}): DashboardTicket {
  return {
    id,
    ticketNumber: `TKT-2026-0000${id}`,
    summary: `Summary of ticket ${id}`,
    status: "IN_PROGRESS",
    itPriority: "MEDIUM",
    updatedAt: "2026-10-29T08:00:00.000Z",
    ...overrides,
  };
}

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    timeZone: "Asia/Bangkok",
    windowStart: "2026-10-23T17:00:00.000Z",
    openTickets: { count: 4, link: OPEN_LINK },
    waitingForRequester: { count: 1, link: "/tickets?status=WAITING_FOR_REQUESTER" },
    recentlyUpdated: { items: [ticket(11), ticket(12, { status: "WAITING_FOR_REQUESTER" })], link: "/tickets?sort=updatedAt:desc" },
    recentlyResolved: { items: [ticket(13, { status: "RESOLVED" })], link: "/tickets?status=RESOLVED&status=CLOSED&sort=updatedAt:desc" },
    ...overrides,
  };
}

const EMPTY = data({
  openTickets: { count: 0, link: OPEN_LINK },
  waitingForRequester: { count: 0, link: "/tickets?status=WAITING_FOR_REQUESTER" },
  recentlyUpdated: { items: [], link: "/tickets?sort=updatedAt:desc" },
  recentlyResolved: { items: [], link: "/tickets?status=RESOLVED&status=CLOSED&sort=updatedAt:desc" },
});

function renderDashboard() {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<RequesterDashboard />} />
    </Routes>,
    { route: "/dashboard" }
  );
}

const card = (name: string) => within(screen.getByRole("region", { name }));

describe("RequesterDashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("cards (UI-10)", () => {
    it("shows the four cards with a label, a value or list, and a View action", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockResolvedValue(data());
      renderDashboard();

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.getByText(/Welcome back, Test Requester/)).toBeInTheDocument();

      expect(card("Open Tickets").getByText("4")).toBeInTheDocument();
      expect(card("Waiting for You").getByText("1")).toBeInTheDocument();
      expect(card("Recently Updated").getAllByRole("listitem")).toHaveLength(2);
      expect(card("Recently Resolved").getAllByRole("listitem")).toHaveLength(1);
      expect(card("Open Tickets").getByRole("link", { name: "View Open Tickets" })).toBeInTheDocument();
      expect(card("Recently Updated").getByRole("link", { name: "View all Recently Updated" })).toBeInTheDocument();
    });

    it("each listed ticket shows number, summary, a friendly status and last-updated, and opens its detail", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      const updated = card("Recently Updated");
      const link = updated.getByRole("link", { name: /TKT-2026-000011/ });
      expect(link).toHaveAttribute("href", "/tickets/11");
      expect(updated.getByText("Summary of ticket 11")).toBeInTheDocument();
      expect(updated.getByText("In Progress")).toBeInTheDocument();
      expect(updated.getByText("Waiting for Requester")).toBeInTheDocument();
      expect(screen.queryByText(/IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED/)).not.toBeInTheDocument(); // never raw enums
      expect(card("Recently Resolved").getByText("Resolved")).toBeInTheDocument();
    });

    it("highlights Waiting for You with an icon and words, not colour alone, only when something waits", async () => {
      const get = vi.spyOn(dashboardApi, "getRequesterDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });
      expect(card("Waiting for You").getByText("Needs your reply")).toBeInTheDocument();
      expect(card("Open Tickets").queryByText("Needs your reply")).not.toBeInTheDocument();

      get.mockResolvedValue(data({ waitingForRequester: { count: 0, link: "/tickets?status=WAITING_FOR_REQUESTER" } }));
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(card("Waiting for You").getByText("0")).toBeInTheDocument());
      expect(card("Waiting for You").queryByText("Needs your reply")).not.toBeInTheDocument();
    });

    it("shows zero counts and a clear message in each empty list card (UI-10, AC-15)", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockResolvedValue(EMPTY);
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      expect(card("Open Tickets").getByText("0")).toBeInTheDocument();
      expect(card("Waiting for You").getByText("0")).toBeInTheDocument();
      expect(card("Recently Updated").getByText("No tickets updated in the last 7 days.")).toBeInTheDocument();
      expect(card("Recently Resolved").getByText("No tickets resolved in the last 7 days.")).toBeInTheDocument();
      // The drill-down actions remain, so a zero is still explorable.
      expect(card("Open Tickets").getByRole("link", { name: /View/ })).toBeInTheDocument();
    });
  });

  describe("drill-down links (UI-13)", () => {
    it("point at exactly the documented My Tickets filters", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockResolvedValue(data());
      renderDashboard();
      await screen.findByRole("heading", { name: "Dashboard" });

      expect(card("Open Tickets").getByRole("link", { name: /^View/ })).toHaveAttribute("href", OPEN_LINK);
      expect(card("Waiting for You").getByRole("link", { name: /^View/ })).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");
      expect(card("Recently Updated").getByRole("link", { name: /^View all/ })).toHaveAttribute("href", "/tickets?sort=updatedAt:desc");
      expect(card("Recently Resolved").getByRole("link", { name: /^View all/ })).toHaveAttribute(
        "href",
        "/tickets?status=RESOLVED&status=CLOSED&sort=updatedAt:desc"
      );
    });
  });

  describe("states (UI-15)", () => {
    it("shows a loading state first", () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockReturnValue(new Promise(() => {}));
      renderDashboard();
      expect(screen.getByText("Loading your dashboard…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    });

    it("shows a safe failure with Retry, never a raw error, and Retry recovers", async () => {
      const get = vi.spyOn(dashboardApi, "getRequesterDashboard").mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:3000"));
      renderDashboard();

      expect(await screen.findByText("Unable to load your dashboard right now.")).toBeInTheDocument();
      expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
      expect(screen.queryByRole("region")).not.toBeInTheDocument(); // not a half-drawn dashboard

      get.mockResolvedValue(data());
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByRole("region", { name: "Open Tickets" })).toBeInTheDocument();
    });

    it("shows a clear message, not a blank page, when the server says the caller is not a Requester (403)", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockRejectedValue(new ApiError(403, "Forbidden"));
      renderDashboard();
      expect(await screen.findByText(/only available to Requesters/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    const REQUESTER: AuthUser = { id: 1, fullName: "Jennifer Anderson", email: "j@example.com", role: "REQUESTER", mustChangePassword: false };

    it("a Requester's nav starts with Dashboard and marks it as the current page", async () => {
      renderWithProviders(<AppHeader />, { route: "/dashboard", user: REQUESTER });
      const nav = await screen.findByRole("navigation", { name: "Primary" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "My Tickets", "Create Ticket"]);
      expect(links[0]).toHaveAttribute("aria-current", "page");
      expect(links[1]).not.toHaveAttribute("aria-current");
    });

    it("My Tickets is the current page on /tickets, not Dashboard", async () => {
      renderWithProviders(<AppHeader />, { route: "/tickets", user: REQUESTER });
      const nav = await screen.findByRole("navigation", { name: "Primary" });
      expect(within(nav).getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
      expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    });

    it("IT Staff do not see the Requester Dashboard link", async () => {
      renderWithProviders(<AppHeader />, { route: "/staff/tickets", user: { ...REQUESTER, role: "IT_STAFF" } });
      const nav = await screen.findByRole("navigation", { name: "Primary" });
      expect(within(nav).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    });
  });
});
