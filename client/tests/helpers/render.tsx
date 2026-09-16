import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as authApi from "../../src/api/auth.js";
import type { AuthUser } from "../../src/api/types.js";

export const DEFAULT_TEST_USER: AuthUser = {
  id: 1,
  fullName: "Test Requester",
  email: "test-requester@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

// Shared render helper for Lab 2/3 component tests. Not itself a test file
// (vite.config.ts only collects tests/**/*.test.tsx), so this is safe to
// import from any test without being picked up as one.
//
// Every screen under AuthProvider bootstraps via GET /auth/me — most
// component tests (Ticket screens, etc.) don't care about auth state, they
// just need "already logged in as a Requester" so the screen under test
// renders. Pass `user: null` to simulate logged-out, or a specific AuthUser
// to test role-gated UI; omit it for the DEFAULT_TEST_USER default.
export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; user?: AuthUser | null } = {}
) {
  const route = options.route ?? "/";
  const user = options.user === undefined ? DEFAULT_TEST_USER : options.user;

  if (user) {
    vi.spyOn(authApi, "me").mockResolvedValue({ user });
  } else {
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("Not authenticated"));
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}
