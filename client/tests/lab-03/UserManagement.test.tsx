import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagement from "../../src/pages/UserManagement.js";
import * as adminApi from "../../src/api/admin.js";
import { ApiError } from "../../src/api/client.js";
import type { AdminUser } from "../../src/api/admin.js";
import type { AuthUser } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const ADMIN_USER: AuthUser = {
  id: 1,
  fullName: "Olivia Grant",
  email: "olivia.grant@example.com",
  role: "ADMINISTRATOR",
  mustChangePassword: false,
};

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 5,
    fullName: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    role: "REQUESTER",
    isActive: true,
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(<UserManagement />, { route: "/admin/users", user: ADMIN_USER });
}

describe("UserManagement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the user list with Name/Email/Role/Status columns (FR-14)", async () => {
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([makeUser()]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(within(table).getByText("jennifer.anderson@example.com")).toBeInTheDocument();
    expect(within(table).getByText("Requester")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("re-fetches with search text and role filter", async () => {
    const listSpy = vi.spyOn(adminApi, "listUsers").mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/search/i), "priya");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(listSpy.mock.calls.at(-1)?.[0]).toMatchObject({ q: "priya" }));

    await userEvent.selectOptions(screen.getByLabelText(/^role$/i), "IT_STAFF");
    await waitFor(() => expect(listSpy.mock.calls.at(-1)?.[0]).toMatchObject({ role: "IT_STAFF" }));
  });

  it("creates a user via the Create User modal and refreshes the list (FR-15)", async () => {
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([]);
    const createSpy = vi.spyOn(adminApi, "createUser").mockResolvedValue(makeUser({ id: 9, fullName: "New Hire" }));
    renderPage();
    await screen.findByRole("button", { name: /create user/i });

    await userEvent.click(screen.getByRole("button", { name: /create user/i }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/^name/i), "New Hire");
    await userEvent.type(dialog.getByLabelText(/^email/i), "new.hire@example.com");
    await userEvent.selectOptions(dialog.getByLabelText(/^role/i), "IT_STAFF");
    await userEvent.type(dialog.getByLabelText(/initial password/i), "Password123!");
    await userEvent.click(dialog.getByRole("button", { name: /^create user$/i }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        fullName: "New Hire",
        email: "new.hire@example.com",
        role: "IT_STAFF",
        initialPassword: "Password123!",
      })
    );
    // Modal closes on success.
    expect(screen.queryByLabelText(/initial password/i)).not.toBeInTheDocument();
  });

  it("shows a duplicate-email error inline in the Create modal without closing it (BR-24, AC-10)", async () => {
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([]);
    vi.spyOn(adminApi, "createUser").mockRejectedValue(new ApiError(409, "A user with this email already exists"));
    renderPage();
    await screen.findByRole("button", { name: /create user/i });

    await userEvent.click(screen.getByRole("button", { name: /create user/i }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/^name/i), "Dup");
    await userEvent.type(dialog.getByLabelText(/^email/i), "dup@example.com");
    await userEvent.type(dialog.getByLabelText(/initial password/i), "Password123!");
    await userEvent.click(dialog.getByRole("button", { name: /^create user$/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    // Still open — a silent no-op is not acceptable per ui-spec.md §5.
    expect(screen.getByLabelText(/initial password/i)).toBeInTheDocument();
  });

  it("edits an existing user, pre-filling the form, and shows a last-admin error inline (FR-16, FR-18, BR-26, AC-11)", async () => {
    const target = makeUser({ id: 2, fullName: "Olivia Grant", role: "ADMINISTRATOR", isActive: true });
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([target]);
    vi.spyOn(adminApi, "updateUser").mockRejectedValue(new ApiError(422, "This would leave zero active Administrators"));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /edit/i }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText(/^name/i)).toHaveValue("Olivia Grant");
    expect(dialog.getByLabelText(/^email/i)).toHaveValue("jennifer.anderson@example.com");

    await userEvent.click(dialog.getByLabelText(/^active$/i));
    await userEvent.click(dialog.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/zero active administrators/i)).toBeInTheDocument();
  });

  it("opens the Set New Password confirmation modal from Edit and resets the password (FR-17, BR-27)", async () => {
    const target = makeUser({ id: 3 });
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([target]);
    const resetSpy = vi.spyOn(adminApi, "resetPassword").mockResolvedValue(target);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /edit/i }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /set new password/i }));

    // Anchored to the start: the dialog's own title ("Set new password for
    // …") also contains this substring via aria-labelledby, which
    // getByLabelText treats as a candidate — anchoring picks the field only.
    const newPasswordField = screen.getByLabelText(/^new password/i);
    await userEvent.type(newPasswordField, "BrandNewPassword1!");
    await userEvent.click(screen.getByRole("button", { name: /^set password$/i }));

    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith(3, "BrandNewPassword1!"));
    expect(await screen.findByText(/password reset\./i)).toBeInTheDocument();
  });

  it("shows a success message on the page after creating and after editing a user (Lab 3 §8.6)", async () => {
    const target = makeUser({ id: 3 });
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([target]);
    vi.spyOn(adminApi, "createUser").mockResolvedValue(makeUser({ id: 9, fullName: "New Hire" }));
    vi.spyOn(adminApi, "updateUser").mockResolvedValue({ ...target, fullName: "Renamed" });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /create user/i }));
    const createDialog = within(screen.getByRole("dialog"));
    await userEvent.type(createDialog.getByLabelText(/^name/i), "New Hire");
    await userEvent.type(createDialog.getByLabelText(/^email/i), "new.hire@example.com");
    await userEvent.type(createDialog.getByLabelText(/initial password/i), "Password123!");
    await userEvent.click(createDialog.getByRole("button", { name: /^create user$/i }));
    expect(await screen.findByText(/user created\./i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/changes saved\./i)).toBeInTheDocument();
  });

  it("disables the Active toggle and shows a hint when the Administrator edits their own account (BR-25 UI hint)", async () => {
    const self = makeUser({ id: ADMIN_USER.id, fullName: "Olivia Grant", role: "ADMINISTRATOR", isActive: true });
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([self]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /edit/i }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText(/^active$/i)).toBeDisabled();
    expect(dialog.getByText(/can't deactivate your own account/i)).toBeInTheDocument();
  });

  it("wraps the user table in a responsive container (no horizontal overflow at any viewport)", async () => {
    vi.spyOn(adminApi, "listUsers").mockResolvedValue([makeUser()]);
    renderPage();

    const table = await screen.findByRole("table");
    expect(table.closest(".table-responsive")).not.toBeNull();
  });
});
