import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "../../src/components/layout/AuthGuard.js";
import RequesterDashboard from "../../src/pages/RequesterDashboard.js";
import Login from "../../src/pages/Login.js";
import ChangePassword from "../../src/pages/ChangePassword.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const REQUESTER: AuthUser = { id: 1, fullName: "Jennifer Anderson", email: "jennifer@example.com", role: "REQUESTER", mustChangePassword: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const DASHBOARD = {
  timeZone: "Asia/Bangkok",
  windowStart: "2026-10-23T17:00:00.000Z",
  openTickets: { count: 2, link: "/tickets?status=OPEN" },
  waitingForRequester: { count: 0, link: "/tickets?status=WAITING_FOR_REQUESTER" },
  recentlyUpdated: { items: [], link: "/tickets?sort=updatedAt:desc" },
  recentlyResolved: { items: [], link: "/tickets?status=RESOLVED" },
};

// These tests run the REAL request() code against a fake network, because the rule under test (a 401 from a
// feature call ends the session) lives in request() itself, not in any one screen.
function fakeNetwork(handlers: Record<string, () => Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const key = Object.keys(handlers).find((path) => url.includes(path));
    if (!key) throw new Error(`unexpected request to ${url}`);
    return handlers[key]();
  });
}

function renderProtectedDashboard() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RequesterDashboard />
          </RequireAuth>
        }
      />
      <Route path="/login" element={<Login />} />
    </Routes>,
    { route: "/dashboard", user: REQUESTER }
  );
}

describe("an expired session (UI-14, AC-22, BR-33)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a 401 from any screen's request returns the user to Login with a clear message, not a raw error", async () => {
    fakeNetwork({ "/api/dashboard/requester": () => json(401, { error: "Not authenticated" }) });
    renderProtectedDashboard();

    expect(await screen.findByText("Your session has expired. Please sign in again.")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument(); // the Login form
    expect(screen.queryByText(/Unable to load your dashboard/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not authenticated/)).not.toBeInTheDocument();
  });

  it("signing in again brings the user back to the screen they were on", async () => {
    let dashboardCalls = 0;
    fakeNetwork({
      "/api/dashboard/requester": () => (++dashboardCalls === 1 ? json(401, { error: "Not authenticated" }) : json(200, DASHBOARD)),
      "/api/auth/login": () => json(200, { user: REQUESTER }),
    });
    renderProtectedDashboard();

    await screen.findByText("Your session has expired. Please sign in again.");
    await userEvent.type(screen.getByLabelText(/email/i), "jennifer@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("region", { name: "Open Tickets" })).toBeInTheDocument();
    expect(screen.queryByText("Your session has expired. Please sign in again.")).not.toBeInTheDocument();
  });

  it("a wrong password at Login is an ordinary error, never reported as an expired session", async () => {
    fakeNetwork({ "/api/auth/login": () => json(401, { error: "Invalid email or password" }) });
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>,
      { route: "/login", user: null }
    );

    await userEvent.type(await screen.findByLabelText(/email/i), "jennifer@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(screen.queryByText("Your session has expired. Please sign in again.")).not.toBeInTheDocument();
  });

  it("a wrong current password on Change Password (also a 401) does not sign the user out", async () => {
    fakeNetwork({ "/api/auth/change-password": () => json(401, { error: "Current password is incorrect" }) });
    renderWithProviders(
      <Routes>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>,
      { route: "/change-password", user: { ...REQUESTER, mustChangePassword: true } }
    );

    await userEvent.type(await screen.findByLabelText(/current password/i), "not-my-password");
    await userEvent.type(screen.getByLabelText(/^new password/i), "NewPassword456!");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword456!");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
    expect(screen.queryByText("Your session has expired. Please sign in again.")).not.toBeInTheDocument();
  });

  it("other failures (500) keep the user signed in and show the screen's own safe message", async () => {
    fakeNetwork({ "/api/dashboard/requester": () => json(500, { error: "Unexpected server error" }) });
    renderProtectedDashboard();

    expect(await screen.findByText("Unable to load your dashboard right now.")).toBeInTheDocument();
    expect(screen.queryByText("Your session has expired. Please sign in again.")).not.toBeInTheDocument();
  });
});
