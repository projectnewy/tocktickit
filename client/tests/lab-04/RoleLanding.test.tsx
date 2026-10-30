import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { AppHeader } from "../../src/components/layout/AppHeader.js";
import { RoleGuard } from "../../src/components/layout/AuthGuard.js";
import { LandingRedirect } from "../../src/components/routing/LandingRedirect.js";
import { landingPath } from "../../src/config/landing.js";
import Login from "../../src/pages/Login.js";
import ChangePassword from "../../src/pages/ChangePassword.js";
import RequesterDashboard from "../../src/pages/RequesterDashboard.js";
import StaffDashboard from "../../src/pages/StaffDashboard.js";
import * as authApi from "../../src/api/auth.js";
import * as dashboardApi from "../../src/api/dashboard.js";
import { ApiError } from "../../src/api/client.js";
import type { AuthUser, Role } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const userWith = (role: Role, overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  fullName: "Test Person",
  email: "test@example.com",
  role,
  mustChangePassword: false,
  ...overrides,
});

// A tiny route table: each destination just announces itself, so a test can see where a role ended up.
function Destinations() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
      <Route path="/change-password" element={<div>CHANGE PASSWORD PAGE</div>} />
      <Route path="/dashboard" element={<div>REQUESTER DASHBOARD</div>} />
      <Route path="/staff/dashboard" element={<div>STAFF DASHBOARD</div>} />
      <Route
        path="/tickets"
        element={
          <RoleGuard allowed={["REQUESTER"]}>
            <div>MY TICKETS</div>
          </RoleGuard>
        }
      />
      <Route
        path="/staff/tickets"
        element={
          <RoleGuard allowed={["IT_STAFF", "ADMINISTRATOR"]}>
            <div>TICKET QUEUE</div>
          </RoleGuard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RoleGuard allowed={["ADMINISTRATOR"]}>
            <div>USER MANAGEMENT</div>
          </RoleGuard>
        }
      />
    </Routes>
  );
}

describe("role landing and navigation (UI-12, FR-12, BR-30)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("landingPath gives each role its own Dashboard", () => {
    expect(landingPath("REQUESTER")).toBe("/dashboard");
    expect(landingPath("IT_STAFF")).toBe("/staff/dashboard");
    expect(landingPath("ADMINISTRATOR")).toBe("/staff/dashboard");
  });

  describe("the root path", () => {
    it.each([
      ["REQUESTER", "REQUESTER DASHBOARD"],
      ["IT_STAFF", "STAFF DASHBOARD"],
      ["ADMINISTRATOR", "STAFF DASHBOARD"],
    ] as const)("sends a %s to their own Dashboard", async (role, expected) => {
      renderWithProviders(<Destinations />, { route: "/", user: userWith(role) });
      expect(await screen.findByText(expected)).toBeInTheDocument();
    });

    it("sends a signed-out visitor to Login and a user who owes a password change to Change Password", async () => {
      const { unmount } = renderWithProviders(<Destinations />, { route: "/", user: null });
      expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
      unmount();

      renderWithProviders(<Destinations />, { route: "/", user: userWith("IT_STAFF", { mustChangePassword: true }) });
      expect(await screen.findByText("CHANGE PASSWORD PAGE")).toBeInTheDocument();
    });
  });

  describe("after login and after the forced password change", () => {
    function renderLogin() {
      return renderWithProviders(
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/dashboard" element={<div>REQUESTER DASHBOARD</div>} />
          <Route path="/staff/dashboard" element={<div>STAFF DASHBOARD</div>} />
        </Routes>,
        { route: "/login", user: null }
      );
    }

    it.each([
      ["REQUESTER", "REQUESTER DASHBOARD"],
      ["IT_STAFF", "STAFF DASHBOARD"],
    ] as const)("login as a %s lands on their Dashboard, not My Tickets", async (role, expected) => {
      const signedIn = userWith(role);
      vi.spyOn(authApi, "login").mockResolvedValue({ user: signedIn });
      renderLogin();

      await userEvent.type(await screen.findByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "Password123!");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      expect(await screen.findByText(expected)).toBeInTheDocument();
    });

    it("the forced password change ends on the user's own Dashboard", async () => {
      vi.spyOn(authApi, "changePassword").mockResolvedValue(undefined);
      renderWithProviders(
        <Routes>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/dashboard" element={<div>REQUESTER DASHBOARD</div>} />
          <Route path="/staff/dashboard" element={<div>STAFF DASHBOARD</div>} />
        </Routes>,
        { route: "/change-password", user: userWith("IT_STAFF", { mustChangePassword: true }) }
      );
      vi.spyOn(authApi, "me").mockResolvedValue({ user: userWith("IT_STAFF") });

      await userEvent.type(await screen.findByLabelText(/current password/i), "Password123!");
      await userEvent.type(screen.getByLabelText(/^new password/i), "NewPassword456!");
      await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword456!");
      await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

      expect(await screen.findByText("STAFF DASHBOARD")).toBeInTheDocument();
    });
  });

  describe("wrong-role routes are guarded, not just hidden", () => {
    it.each([
      ["IT_STAFF", "/tickets", "STAFF DASHBOARD"],
      ["ADMINISTRATOR", "/tickets", "STAFF DASHBOARD"],
      ["REQUESTER", "/staff/tickets", "REQUESTER DASHBOARD"],
      ["REQUESTER", "/admin/users", "REQUESTER DASHBOARD"],
      ["IT_STAFF", "/admin/users", "STAFF DASHBOARD"],
    ] as const)("a %s opening %s ends up on their own Dashboard", async (role, route, expected) => {
      renderWithProviders(<Destinations />, { route, user: userWith(role) });
      expect(await screen.findByText(expected)).toBeInTheDocument();
    });

    it.each([
      ["REQUESTER", "/tickets", "MY TICKETS"],
      ["IT_STAFF", "/staff/tickets", "TICKET QUEUE"],
      ["ADMINISTRATOR", "/admin/users", "USER MANAGEMENT"],
    ] as const)("a %s can open %s", async (role, route, expected) => {
      renderWithProviders(<Destinations />, { route, user: userWith(role) });
      expect(await screen.findByText(expected)).toBeInTheDocument();
    });

    it("a staff user whose request for the Requester Dashboard is refused (403) is sent to the Staff Dashboard", async () => {
      vi.spyOn(dashboardApi, "getRequesterDashboard").mockRejectedValue(new ApiError(403, "Forbidden"));
      renderWithProviders(
        <Routes>
          <Route path="/dashboard" element={<RequesterDashboard />} />
          <Route path="/staff/dashboard" element={<div>STAFF DASHBOARD</div>} />
        </Routes>,
        { route: "/dashboard", user: userWith("IT_STAFF") }
      );
      expect(await screen.findByText("STAFF DASHBOARD")).toBeInTheDocument();
    });

    it("a Requester whose request for the Staff Dashboard is refused (403) is sent to their own Dashboard", async () => {
      vi.spyOn(dashboardApi, "getStaffDashboard").mockRejectedValue(new ApiError(403, "Forbidden"));
      renderWithProviders(
        <Routes>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
          <Route path="/dashboard" element={<div>REQUESTER DASHBOARD</div>} />
        </Routes>,
        { route: "/staff/dashboard", user: userWith("REQUESTER") }
      );
      expect(await screen.findByText("REQUESTER DASHBOARD")).toBeInTheDocument();
    });
  });

  describe("navigation items per role", () => {
    const linksFor = async (role: Role, route: string) => {
      renderWithProviders(<AppHeader />, { route, user: userWith(role) });
      const nav = await screen.findByRole("navigation", { name: "Primary" });
      return { nav, links: within(nav).getAllByRole("link") };
    };

    it("Requester: Dashboard, My Tickets, Create Ticket", async () => {
      const { links } = await linksFor("REQUESTER", "/dashboard");
      expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "My Tickets", "Create Ticket"]);
      expect(links.map((l) => l.getAttribute("href"))).toEqual(["/dashboard", "/tickets", "/tickets/new"]);
    });

    it("IT Staff: Dashboard, Ticket Queue — no Requester screens, no Users", async () => {
      const { links } = await linksFor("IT_STAFF", "/staff/dashboard");
      expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "Ticket Queue"]);
      expect(links.map((l) => l.getAttribute("href"))).toEqual(["/staff/dashboard", "/staff/tickets"]);
    });

    it("Administrator: Dashboard, Ticket Queue, Users", async () => {
      const { links } = await linksFor("ADMINISTRATOR", "/staff/dashboard");
      expect(links.map((l) => l.textContent)).toEqual(["Dashboard", "Ticket Queue", "Users"]);
    });

    it.each([
      ["REQUESTER", "/dashboard", "Dashboard"],
      ["REQUESTER", "/tickets", "My Tickets"],
      ["REQUESTER", "/tickets/new", "Create Ticket"],
      ["IT_STAFF", "/staff/dashboard", "Dashboard"],
      ["IT_STAFF", "/staff/tickets", "Ticket Queue"],
      ["ADMINISTRATOR", "/admin/users", "Users"],
    ] as const)("a %s on %s sees only '%s' marked as the current page", async (role, route, current) => {
      const { links } = await linksFor(role, route);
      const marked = links.filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent);
      expect(marked).toEqual([current]);
    });
  });
});
