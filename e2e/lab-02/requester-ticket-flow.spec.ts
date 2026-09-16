import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Runs against the real dev database, not the isolated API test database —
// so it must never assert a fixed row count. Each ticket-creation test uses
// a summary embedding Date.now() and searches for that exact string, and the
// cross-requester-isolation test checks for specific seeded content tied to
// one requester rather than counting rows. See client/playwright.config.ts.
//
// Lab 3 replaced the Development Requester selector with real login — this
// spec now authenticates via /login instead of the old "select development
// requester" screen, per BR-29/AC-17 ("all Lab 2 Requester ownership rules
// continue to apply unchanged under the new authenticated identity").
const ARTIFACTS_ROOT = path.resolve(__dirname, "../../artifacts/lab-02/screenshots");
const SEED_PASSWORD = "Password123!";

function screenshotPath(folder: string, projectName: string): string {
  const dir = path.join(ARTIFACTS_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${projectName}.png`);
}

async function loginAsRequester(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
}

// Bootstrap's d-none/d-lg-table and d-lg-none classes only toggle CSS
// `display` — both the desktop table row and the mobile card for the same
// ticket exist in the DOM at every viewport, so a bare getByText(...) is
// ambiguous everywhere, not just under a "real browser" assumption. Scope
// to whichever container is actually visible for the current project.
function ticketListItem(page: Page, projectName: string, text: string) {
  const container = projectName === "desktop" ? page.locator("table") : page.locator(".d-lg-none");
  return container.getByText(text);
}

test("login as a Requester, create a ticket, find it in My Tickets, open its detail", async ({ page }, testInfo) => {
  const uniqueSummary = `E2E verification ticket ${Date.now()}`;

  await loginAsRequester(page, "jennifer.anderson@example.com");

  // --- Create Ticket ---
  await page.goto("/tickets/new");
  await expect(page.getByRole("heading", { name: /create ticket/i })).toBeVisible();
  await page.getByLabel(/^category/i).selectOption({ label: "Hardware" });
  await page.getByLabel(/related system/i).selectOption({ label: "Corporate Laptop" });
  await page.getByLabel(/requested priority/i).selectOption("HIGH");
  await page.getByLabel(/ticket summary/i).fill(uniqueSummary);
  await page
    .getByLabel(/^description/i)
    .fill("Created by the Lab 2 E2E flow test, verifying the full requester journey under Lab 3 auth.");

  await page.screenshot({ path: screenshotPath("create-ticket", testInfo.project.name), fullPage: true });

  await page.getByRole("button", { name: /submit ticket/i }).click();
  await expect(page.getByText(/created successfully/i)).toBeVisible();
  const ticketNumberText = await page
    .getByText(/TKT-\d{4}-\d{6}/)
    .first()
    .textContent();
  const ticketNumber = ticketNumberText?.match(/TKT-\d{4}-\d{6}/)?.[0];
  expect(ticketNumber).toBeTruthy();

  // --- My Tickets: find the ticket we just created by its unique summary ---
  await page.getByRole("button", { name: /back to my tickets/i }).click();
  await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
  await page.getByLabel(/search/i).fill(uniqueSummary);
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(ticketListItem(page, testInfo.project.name, uniqueSummary)).toBeVisible();

  await page.screenshot({ path: screenshotPath("my-tickets", testInfo.project.name), fullPage: true });

  // No horizontal page scrolling at any viewport (AC-16 from Lab 2).
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);

  // --- Ticket Detail ---
  await ticketListItem(page, testInfo.project.name, uniqueSummary).click();
  await expect(page.getByRole("heading", { name: ticketNumber! })).toBeVisible();
  await expect(page.getByText(uniqueSummary)).toBeVisible();

  await page.screenshot({ path: screenshotPath("ticket-detail", testInfo.project.name), fullPage: true });
});

test("a different Requester's login shows a different ticket list, never a switch button (AC-03, BR-03, BR-29)", async ({
  page,
}, testInfo) => {
  // "Keyboard keys unresponsive" is seeded only for Michael Brown
  // (server/src/db/seedData.ts) — a deterministic marker, unlike a row count.
  const MICHAEL_ONLY_TICKET = "Keyboard keys unresponsive";

  await loginAsRequester(page, "jennifer.anderson@example.com");
  await expect(page.getByText(MICHAEL_ONLY_TICKET)).not.toBeVisible();
  // Lab 3 removed the in-app "Switch requester" button entirely — a
  // different identity now only ever comes from a fresh login.
  await expect(page.getByRole("button", { name: /switch requester/i })).toHaveCount(0);

  await page.getByRole("button", { name: /logout/i }).click();
  await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();

  await loginAsRequester(page, "michael.brown@example.com");
  await expect(ticketListItem(page, testInfo.project.name, MICHAEL_ONLY_TICKET)).toBeVisible();
});
