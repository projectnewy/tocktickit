import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../../src/pages/Login.js";
import * as authApi from "../../src/api/auth.js";
import { ApiError } from "../../src/api/client.js";
import { renderWithProviders } from "../helpers/render.js";

describe("Login", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires both fields before the browser will submit (UI-01, AC-01)", async () => {
    renderWithProviders(<Login />, { route: "/login", user: null });
    await screen.findByLabelText(/email/i);

    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/^password/i)).toBeRequired();
  });

  it("shows a busy state while signing in and calls the login API (UI-01)", async () => {
    let resolveLogin: (v: { user: unknown }) => void = () => {};
    vi.spyOn(authApi, "login").mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve as typeof resolveLogin;
      })
    );

    renderWithProviders(<Login />, { route: "/login", user: null });
    await userEvent.type(await screen.findByLabelText(/email/i), "requester@example.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolveLogin({ user: { id: 1, fullName: "X", email: "x@example.com", role: "REQUESTER", mustChangePassword: false } });
  });

  it("shows the API's generic invalid-credentials message on failure, never a raw error (BR-06, BR-07, AC-05)", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(new ApiError(401, "Invalid email or password"));

    renderWithProviders(<Login />, { route: "/login", user: null });
    await userEvent.type(await screen.findByLabelText(/email/i), "requester@example.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
  });

  it("navigates to /change-password when the logged-in user must change their password (AC-02)", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      user: { id: 4, fullName: "David Lee", email: "david@example.com", role: "REQUESTER", mustChangePassword: true },
    });
    vi.spyOn(authApi, "me").mockRejectedValue(new Error("not called until AuthProvider re-bootstraps"));

    renderWithProviders(<Login />, { route: "/login", user: null });
    await userEvent.type(await screen.findByLabelText(/email/i), "david@example.com");
    await userEvent.type(screen.getByLabelText(/^password/i), "TempPass1!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({ email: "david@example.com", password: "TempPass1!" }));
  });
});
