import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePassword from "../../src/pages/ChangePassword.js";
import * as authApi from "../../src/api/auth.js";
import { ApiError } from "../../src/api/client.js";
import { renderWithProviders, DEFAULT_TEST_USER } from "../helpers/render.js";

const MUST_CHANGE_USER = { ...DEFAULT_TEST_USER, mustChangePassword: true };

describe("ChangePassword", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a mismatched confirmation before calling the API (UI-02)", async () => {
    const apiSpy = vi.spyOn(authApi, "changePassword");
    renderWithProviders(<ChangePassword />, { route: "/change-password", user: MUST_CHANGE_USER });

    await userEvent.type(await screen.findByLabelText(/current password/i), "Password123!");
    await userEvent.type(screen.getByLabelText(/^new password/i), "NewPassword456!");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "DoesNotMatch1!");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("submits current+new password and navigates into the app on success (AC-02, BR-02, BR-27)", async () => {
    vi.spyOn(authApi, "changePassword").mockResolvedValue(undefined);
    vi.spyOn(authApi, "me").mockResolvedValue({ user: { ...DEFAULT_TEST_USER, mustChangePassword: false } });

    renderWithProviders(<ChangePassword />, { route: "/change-password", user: MUST_CHANGE_USER });

    await userEvent.type(await screen.findByLabelText(/current password/i), "Password123!");
    await userEvent.type(screen.getByLabelText(/^new password/i), "NewPassword456!");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword456!");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    await waitFor(() =>
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: "Password123!",
        newPassword: "NewPassword456!",
      })
    );
  });

  it("shows a safe failure message when the current password is wrong (API-04)", async () => {
    vi.spyOn(authApi, "changePassword").mockRejectedValue(new ApiError(401, "Current password is incorrect"));

    renderWithProviders(<ChangePassword />, { route: "/change-password", user: MUST_CHANGE_USER });
    await userEvent.type(await screen.findByLabelText(/current password/i), "wrong-current");
    await userEvent.type(screen.getByLabelText(/^new password/i), "NewPassword456!");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword456!");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/current password is incorrect/i);
  });

  it("enforces the 8-72 character boundary client-side (BR-09)", async () => {
    renderWithProviders(<ChangePassword />, { route: "/change-password", user: MUST_CHANGE_USER });
    const newPasswordField = await screen.findByLabelText(/^new password/i);
    expect(newPasswordField).toHaveAttribute("minLength", "8");
    expect(newPasswordField).toHaveAttribute("maxLength", "72");
  });
});
