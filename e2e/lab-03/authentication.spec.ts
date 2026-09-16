import { test, expect } from "@playwright/test";
import { login, logout, screenshotPath, SEED_PASSWORD } from "./helpers.js";

// E2E-01 (tests.md): login -> mandatory password change -> app, at 3 viewports.
// Runs against the real dev DB — self-contained by resetting a seeded
// account's password to a fresh, unique temp password via the Admin UI
// first, rather than depending on any account's pre-existing
// mustChangePassword state (which mutates as other manual/E2E runs touch it).
test("Administrator resets a user's password; that user is gated to Change Password until they set a new one (AC-01, AC-02)", async ({
  page,
}, testInfo) => {
  const tempPassword = `Temp${Date.now()}!`;
  const finalPassword = `Final${Date.now()}!`;

  // --- Admin resets Sarah Johnson's password ---
  await login(page, "olivia.grant@example.com");
  // Login always lands on /tickets first (no role-specific default landing
  // page) — Administrator navigates to Users explicitly, same as a real user
  // would via the header nav link.
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: /user management/i })).toBeVisible();

  const row = page.locator("tr", { hasText: "sarah.johnson@example.com" });
  await row.getByRole("button", { name: /edit/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /set new password/i }).click();
  await page.getByLabel(/^new password/i).fill(tempPassword);
  await page.getByRole("button", { name: /^set password$/i }).click();
  await expect(page.getByText(/password reset\./i)).toBeVisible();

  await logout(page);

  // --- Sarah Johnson logs in with the temp password ---
  await page.screenshot({ path: screenshotPath("authentication", testInfo.project.name), fullPage: true });

  await login(page, "sarah.johnson@example.com", tempPassword);
  await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible();

  // BR-02: every other screen/endpoint stays gated while mustChangePassword
  // is true — attempting to navigate straight to /tickets bounces right back.
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible();

  await page.getByLabel(/current password/i).fill(tempPassword);
  await page.getByLabel(/^new password/i).fill(finalPassword);
  await page.getByLabel(/confirm new password/i).fill(finalPassword);
  await page.getByRole("button", { name: /save new password/i }).click();

  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();

  // No horizontal overflow on the auth screens at any viewport.
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);

  // Logging back in immediately with the final password confirms the gate
  // is fully lifted (AC-01) — landing straight on My Tickets, no redirect.
  await logout(page);
  await login(page, "sarah.johnson@example.com", finalPassword);
  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
});

test("a logged-out session cannot reach a protected screen (AC-13)", async ({ page }) => {
  await login(page, "jennifer.anderson@example.com", SEED_PASSWORD);
  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
  await logout(page);

  await page.goto("/tickets");
  await expect(page.getByLabel(/email/i)).toBeVisible();
});
