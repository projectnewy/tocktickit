import { test, expect } from "@playwright/test";
import { login, screenshotPath } from "./helpers.js";

// E2E-04 (tests.md): Administrator creates a user; that new user logs in in
// a separate session and is forced to change their password — end-to-end
// across two independent sessions, the same pattern as staff-ticket-flow.spec.ts.
test("Administrator creates a user; the new user logs in and is routed to Change Password (FR-14, FR-15, AC-02)", async ({
  browser,
}, testInfo) => {
  const adminContext = await browser.newContext();
  const newUserContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const newUserPage = await newUserContext.newPage();

  const uniqueEmail = `e2e.newuser.${Date.now()}@example.com`;
  const initialPassword = `Init${Date.now()}!`;
  const finalPassword = `Final${Date.now()}!`;

  try {
    // --- Administrator creates the user ---
    await login(adminPage, "olivia.grant@example.com");
    // Login always lands on /tickets first (no role-specific default landing
    // page) — navigate to Users explicitly, same as the header nav link.
    await adminPage.goto("/admin/users");
    await expect(adminPage.getByRole("heading", { name: /user management/i })).toBeVisible();

    await adminPage.getByRole("button", { name: /create user/i }).click();
    const dialog = adminPage.getByRole("dialog");
    await dialog.getByLabel(/^name/i).fill("E2E New User");
    await dialog.getByLabel(/^email/i).fill(uniqueEmail);
    await dialog.getByLabel(/^role/i).selectOption("IT_STAFF");
    await dialog.getByLabel(/initial password/i).fill(initialPassword);
    await dialog.getByRole("button", { name: /^create user$/i }).click();
    await expect(adminPage.getByText(/user created\./i)).toBeVisible();
    await expect(adminPage.getByText(uniqueEmail)).toBeVisible();

    await adminPage.screenshot({ path: screenshotPath("user-management", testInfo.project.name), fullPage: true });

    // No horizontal overflow on the admin screen at any viewport.
    const hasHorizontalScroll = await adminPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // --- New user logs in with the initial password, in a fresh session ---
    await login(newUserPage, uniqueEmail, initialPassword);
    await expect(newUserPage.getByRole("heading", { name: /change your password/i })).toBeVisible();

    await newUserPage.getByLabel(/current password/i).fill(initialPassword);
    await newUserPage.getByLabel(/^new password/i).fill(finalPassword);
    await newUserPage.getByLabel(/confirm new password/i).fill(finalPassword);
    await newUserPage.getByRole("button", { name: /save new password/i }).click();

    // ChangePassword always redirects to /tickets regardless of role (there
    // is no role-specific default landing page) — then confirm the new
    // IT_STAFF account can reach the Queue via the header nav link, proving
    // the role (not just the login) took effect.
    await expect(newUserPage.getByRole("heading", { name: /my tickets/i })).toBeVisible();
    await newUserPage.getByRole("link", { name: /ticket queue/i }).click();
    await expect(newUserPage.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
  } finally {
    await adminContext.close();
    await newUserContext.close();
  }
});
