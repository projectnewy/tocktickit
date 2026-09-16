import { test, expect } from "@playwright/test";
import { login, screenshotPath } from "./helpers.js";

// E2E-02/E2E-03 (tests.md): a Requester and an IT Staff member interacting
// with the same ticket through two concurrent, independent sessions (real
// cookie-based auth, not a shared browser context) — this is also the most
// direct real-browser evidence for FR-19/AC-09 (Internal Notes never reach
// the Requester) short of a raw API assertion, which this test does too.
test("IT Staff claims a Requester's ticket, sets priority/status, posts a comment and an internal note; the Requester sees the comment but never the note", async ({
  browser,
}, testInfo) => {
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  const staffPage = await staffContext.newPage();

  const uniqueSummary = `E2E staff flow ticket ${Date.now()}`;
  const publicCommentText = `Staff public comment ${Date.now()}`;
  const internalNoteText = `Staff internal note ${Date.now()}`;

  try {
    // --- Requester creates a fresh ticket ---
    await login(requesterPage, "jennifer.anderson@example.com");
    await requesterPage.goto("/tickets/new");
    await requesterPage.getByLabel(/^category/i).selectOption({ label: "Network" });
    await requesterPage.getByLabel(/related system/i).selectOption({ label: "VPN" });
    await requesterPage.getByLabel(/requested priority/i).selectOption("MEDIUM");
    await requesterPage.getByLabel(/ticket summary/i).fill(uniqueSummary);
    await requesterPage.getByLabel(/^description/i).fill("Created by the Lab 3 E2E staff-flow test.");
    await requesterPage.getByRole("button", { name: /submit ticket/i }).click();
    await expect(requesterPage.getByText(/created successfully/i)).toBeVisible();

    // --- IT Staff finds it in the queue and opens it ---
    await login(staffPage, "priya.natarajan@example.com");
    // Login always lands on /tickets first (no role-specific default landing
    // page) — navigate to the Queue explicitly, same as the header nav link.
    await staffPage.goto("/staff/tickets");
    await expect(staffPage.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
    await staffPage.getByLabel(/search/i).fill(uniqueSummary);
    await staffPage.getByRole("button", { name: /^search$/i }).click();

    await staffPage.screenshot({ path: screenshotPath("staff-queue", testInfo.project.name), fullPage: true });

    const staffContainer = testInfo.project.name === "desktop" ? staffPage.locator("table") : staffPage.locator(".d-lg-none");
    await staffContainer.getByText(uniqueSummary).click();
    await expect(staffPage.getByText(uniqueSummary)).toBeVisible();

    // --- Claim (New -> Open implicitly), set IT Priority, advance status ---
    await staffPage.getByRole("button", { name: /^claim$/i }).click();
    await expect(staffPage.getByText(/ticket claimed/i)).toBeVisible();
    await staffPage.getByLabel(/it priority/i).selectOption("URGENT");
    await expect(staffPage.getByText(/it priority set to urgent/i)).toBeVisible();
    await staffPage.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(staffPage.getByText(/status changed to in_progress/i)).toBeVisible();

    // --- Post a Public Comment and an Internal Note ---
    await staffPage.getByLabel(/add a comment/i).fill(publicCommentText);
    await staffPage.getByRole("button", { name: /^post comment$/i }).click();
    await expect(staffPage.getByText(publicCommentText)).toBeVisible();

    await staffPage.getByLabel(/add an internal note/i).fill(internalNoteText);
    await staffPage.getByRole("button", { name: /post internal note/i }).click();
    await expect(staffPage.getByText(internalNoteText)).toBeVisible();

    await staffPage.screenshot({ path: screenshotPath("staff-ticket-detail", testInfo.project.name), fullPage: true });

    // No horizontal overflow on the staff screens at any viewport.
    const hasHorizontalScroll = await staffPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // --- Requester's own view: sees the comment, never the note (FR-19/AC-09) ---
    await requesterPage.getByRole("button", { name: /back to my tickets/i }).click();
    await requesterPage.getByLabel(/search/i).fill(uniqueSummary);
    await requesterPage.getByRole("button", { name: /^search$/i }).click();
    const requesterContainer =
      testInfo.project.name === "desktop" ? requesterPage.locator("table") : requesterPage.locator(".d-lg-none");
    await requesterContainer.getByText(uniqueSummary).click();

    await expect(requesterPage.getByText(publicCommentText)).toBeVisible();
    await expect(requesterPage.getByText(internalNoteText)).toHaveCount(0);
    await expect(requesterPage.getByText(/internal notes/i)).toHaveCount(0);

    // Direct API evidence too (AC-04/BR-22), not just DOM absence: a
    // Requester calling the notes endpoint for their own ticket gets 403
    // with no note content, sharing this context's cookies.
    const ticketId = await requesterPage.evaluate(() => window.location.pathname.split("/").pop());
    const notesResponse = await requesterContext.request.get(`http://localhost:3000/api/tickets/${ticketId}/notes`);
    expect(notesResponse.status()).toBe(403);
    const notesBody = await notesResponse.text();
    expect(notesBody).not.toContain(internalNoteText);
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});
