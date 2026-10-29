import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { login } from "../lab-03/helpers.js";

// E2E-03 / E2E-04 (docs/lab-04/tests.md): the Ticket resolution workflow in a real browser with real
// sessions — the Requester's advisory "problem appears resolved", the backend resolution gate shown in
// plain language, a successful Resolve/Close/Reopen, the stale-version reload, and cancelling a Ticket
// that has Planned actions. Actions Taken are created through the API here because their screen is a
// later Issue; everything about the Ticket itself is driven through the UI.
const API = "http://localhost:3000";

function screenshotPath(folder: string, projectName: string, suffix = ""): string {
  const dir = path.resolve(__dirname, "../../artifacts/lab-04/screenshots", folder);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${projectName}${suffix}.png`);
}

async function createTicketAsRequester(page: Page, context: BrowserContext, summary: string): Promise<number> {
  await login(page, "jennifer.anderson@example.com");
  await page.goto("/tickets/new");
  await page.getByLabel(/^category/i).selectOption({ label: "Network" });
  await page.getByLabel(/related system/i).selectOption({ label: "VPN" });
  await page.getByLabel(/requested priority/i).selectOption("MEDIUM");
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page.getByLabel(/^description/i).fill("Created by the Lab 4 workflow E2E test.");
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await expect(page.getByText(/created successfully/i)).toBeVisible();

  const list = await context.request.get(`${API}/api/tickets?q=${encodeURIComponent(summary)}`);
  expect(list.status()).toBe(200);
  return (await list.json()).items[0].id as number;
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

test("Requester advice is advisory; the gate blocks Resolved in plain language until the work is done; then Resolve, Close and Reopen work", async ({ browser }, testInfo) => {
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  const staffPage = await staffContext.newPage();
  const summary = `E2E resolution ${Date.now()}`;

  try {
    const ticketId = await createTicketAsRequester(requesterPage, requesterContext, summary);

    await login(staffPage, "priya.natarajan@example.com");
    await staffPage.goto(`/staff/tickets/${ticketId}`);
    await staffPage.getByRole("button", { name: /^claim$/i }).click();
    await expect(staffPage.getByText(/ticket claimed/i)).toBeVisible();
    await staffPage.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(staffPage.getByText("Status changed to In Progress.")).toBeVisible();

    // The Requester says the problem looks fixed. That is advice only.
    await requesterPage.goto(`/tickets/${ticketId}`);
    await requesterPage.getByRole("button", { name: /problem appears resolved/i }).click();
    await expect(requesterPage.getByText(/you marked this problem as appearing resolved/i)).toBeVisible();

    await staffPage.reload();
    await expect(staffPage.getByText("Requester says the problem appears resolved")).toBeVisible();

    // The gate: nothing completed yet. Plain language, no codes, status unchanged.
    await staffPage.getByLabel(/^status$/i).selectOption("RESOLVED");
    await expect(staffPage.getByText("This ticket cannot be resolved yet.")).toBeVisible();
    await expect(staffPage.getByText("Record at least one completed action.")).toBeVisible();
    await expect(staffPage.locator("body")).not.toContainText(/NO_COMPLETED_ACTION|OPEN_PLANNED_ACTIONS|RESOLUTION_GATE|IN_PROGRESS/);
    await noHorizontalScroll(staffPage);
    await staffPage.screenshot({ path: screenshotPath("ticket-workflow", testInfo.project.name), fullPage: true });

    // A Planned action blocks it too.
    const created = await staffContext.request.post(`${API}/api/tickets/${ticketId}/actions`, {
      data: { description: "Re-test the VPN after the patch" },
    });
    expect(created.status()).toBe(201);
    const action = await created.json();
    await staffPage.getByLabel(/^status$/i).selectOption("RESOLVED");
    await expect(staffPage.getByText("Complete or cancel all planned actions.")).toBeVisible();

    // Complete the work (through the API), then Resolve succeeds without any Requester involvement.
    const completed = await staffContext.request.patch(`${API}/api/tickets/${ticketId}/actions/${action.id}`, {
      data: { version: action.version, status: "COMPLETED", result: "VPN stays connected for an hour" },
    });
    expect(completed.status()).toBe(200);
    await staffPage.getByLabel(/^status$/i).selectOption("RESOLVED");
    await expect(staffPage.getByText("Status changed to Resolved.")).toBeVisible();
    await expect(staffPage.getByLabel(/^status$/i)).toContainText("Closed");

    await staffPage.getByLabel(/^status$/i).selectOption("CLOSED");
    await expect(staffPage.getByText("Status changed to Closed.")).toBeVisible();
    await staffPage.getByLabel(/^status$/i).selectOption("REOPENED");
    await expect(staffPage.getByText("Status changed to Reopened.")).toBeVisible();
    await expect(staffPage.getByLabel(/^status$/i)).toContainText("In Progress");

    // Reopening cleared the resolution timestamp and the Requester's advice.
    const detail = await (await staffContext.request.get(`${API}/api/staff/tickets/${ticketId}`)).json();
    expect(detail).toMatchObject({ status: "REOPENED", resolvedAt: null, resolutionIndicated: false });
    await noHorizontalScroll(staffPage);
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});

test("a second staff member with an out-of-date screen gets a stale-version message and can reload (AC-09)", async ({ browser }) => {
  const requesterContext = await browser.newContext();
  const priyaContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const [requesterPage, priyaPage, secondPage] = await Promise.all([requesterContext.newPage(), priyaContext.newPage(), secondContext.newPage()]);
  const summary = `E2E stale ${Date.now()}`;

  try {
    const ticketId = await createTicketAsRequester(requesterPage, requesterContext, summary);

    await login(priyaPage, "priya.natarajan@example.com");
    await priyaPage.goto(`/staff/tickets/${ticketId}`);
    await priyaPage.getByRole("button", { name: /^claim$/i }).click();
    await expect(priyaPage.getByText(/ticket claimed/i)).toBeVisible();

    await login(secondPage, "olivia.grant@example.com");
    await secondPage.goto(`/staff/tickets/${ticketId}`);
    await expect(secondPage.getByLabel(/it priority/i)).toBeVisible();

    // Priya changes something after Carlos loaded his copy.
    await priyaPage.getByLabel(/it priority/i).selectOption("HIGH");
    await expect(priyaPage.getByText("IT Priority set to High.")).toBeVisible();

    await secondPage.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(secondPage.getByText(/changed by someone else/i)).toBeVisible();
    await expect(secondPage.locator("body")).not.toContainText(/STALE_VERSION/);

    await secondPage.getByRole("button", { name: /reload ticket/i }).click();
    await expect(secondPage.getByText("Ticket reloaded.")).toBeVisible();
    await expect(secondPage.getByLabel(/it priority/i)).toHaveValue("HIGH");

    await secondPage.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(secondPage.getByText("Status changed to In Progress.")).toBeVisible();
    await noHorizontalScroll(secondPage);
  } finally {
    await requesterContext.close();
    await priyaContext.close();
    await secondContext.close();
  }
});

test("cancelling a Ticket cancels its Planned actions (AC-13)", async ({ browser }) => {
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  const staffPage = await staffContext.newPage();
  const summary = `E2E cancel ${Date.now()}`;

  try {
    const ticketId = await createTicketAsRequester(requesterPage, requesterContext, summary);

    await login(staffPage, "priya.natarajan@example.com");
    await staffPage.goto(`/staff/tickets/${ticketId}`);
    await staffPage.getByRole("button", { name: /^claim$/i }).click();
    await expect(staffPage.getByText(/ticket claimed/i)).toBeVisible();

    for (const description of ["Check the licence server", "Ask the requester for the error log"]) {
      expect((await staffContext.request.post(`${API}/api/tickets/${ticketId}/actions`, { data: { description } })).status()).toBe(201);
    }

    await staffPage.getByLabel(/^status$/i).selectOption("CANCELLED");
    await expect(staffPage.getByText("Status changed to Cancelled.")).toBeVisible();
    await expect(staffPage.getByLabel(/^status$/i)).toBeDisabled(); // nothing further from Cancelled

    const actions = await (await staffContext.request.get(`${API}/api/tickets/${ticketId}/actions`)).json();
    expect(actions).toHaveLength(2);
    expect(actions.map((a: { status: string }) => a.status)).toEqual(["CANCELLED", "CANCELLED"]);
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});
