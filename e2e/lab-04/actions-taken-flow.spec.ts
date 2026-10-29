import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { login } from "../lab-03/helpers.js";

// E2E-01 / E2E-02 / part of E2E-08 (docs/lab-04/tests.md): Actions Taken on Ticket Detail with real
// sessions — one staff member plans work for another, the assignee completes it, the Requester sees every
// action read-only; two sessions editing one action get the stale-update prompt; a double click creates one
// row; the dialog is fully keyboard-operable and returns focus. Everything is driven through the UI except
// reading results back, which uses the API as an independent check.
const API = "http://localhost:3000";

function screenshotPath(projectName: string, suffix = ""): string {
  const dir = path.resolve(__dirname, "../../artifacts/lab-04/screenshots/actions-taken");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${projectName}${suffix}.png`);
}

// Below 992px the table is replaced by one card per action; both stay in the DOM, so scope to the visible one.
const isDesktop = (project: string) => project === "desktop";
const container = (page: Page, project: string) => (isDesktop(project) ? page.locator("table") : page.getByTestId("action-cards"));
const row = (page: Page, project: string, description: string) =>
  container(page, project).locator(isDesktop(project) ? "tr" : "li").filter({ hasText: description });

async function createTicket(page: Page, context: BrowserContext, summary: string): Promise<number> {
  await login(page, "jennifer.anderson@example.com");
  await page.goto("/tickets/new");
  await page.getByLabel(/^category/i).selectOption({ label: "Network" });
  await page.getByLabel(/related system/i).selectOption({ label: "VPN" });
  await page.getByLabel(/requested priority/i).selectOption("MEDIUM");
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page.getByLabel(/^description/i).fill("Created by the Lab 4 Actions Taken E2E test.");
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await expect(page.getByText(/created successfully/i)).toBeVisible();
  const list = await context.request.get(`${API}/api/tickets?q=${encodeURIComponent(summary)}`);
  return (await list.json()).items[0].id as number;
}

async function startWorking(page: Page, ticketId: number) {
  await page.goto(`/staff/tickets/${ticketId}`);
  await page.getByRole("button", { name: /^claim$/i }).click();
  await expect(page.getByText(/ticket claimed/i)).toBeVisible();
  await page.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
  await expect(page.getByText("Status changed to In Progress.")).toBeVisible();
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

test("staff plan work for a colleague, the colleague completes it, and the Requester sees every action read-only (E2E-01)", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const requesterContext = await browser.newContext();
  const priyaContext = await browser.newContext();
  const oliviaContext = await browser.newContext();
  const [requesterPage, priyaPage, oliviaPage] = await Promise.all([requesterContext.newPage(), priyaContext.newPage(), oliviaContext.newPage()]);
  const planned = `Replace the access point ${Date.now()}`;
  const own = `Check the cabling ${Date.now()}`;

  try {
    const ticketId = await createTicket(requesterPage, requesterContext, `E2E actions ${Date.now()}`);
    await login(priyaPage, "priya.natarajan@example.com");
    await startWorking(priyaPage, ticketId);
    await expect(priyaPage.getByText("No actions have been recorded for this ticket yet.")).toBeVisible();

    // Priya plans one action for Olivia ...
    await priyaPage.getByRole("button", { name: "Add Action" }).click();
    let dialog = priyaPage.getByRole("dialog");
    await dialog.getByLabel(/^description/i).fill(planned);
    await dialog.getByLabel("Assignee").selectOption({ label: "Olivia Grant" });
    await dialog.getByRole("button", { name: "Create action" }).click();
    await expect(priyaPage.getByText("Action added.")).toBeVisible();

    // ... and records, as already completed, the work she did herself.
    await priyaPage.getByRole("button", { name: "Add Action" }).click();
    dialog = priyaPage.getByRole("dialog");
    await dialog.getByLabel(/^description/i).fill(own);
    await dialog.getByLabel("Mark completed").check();
    await dialog.getByLabel(/^result/i).fill("Cabling tested, no faults");
    await dialog.getByLabel("Follow-up required").check();
    await dialog.getByLabel(/follow-up note/i).fill("Re-test after the next patch window");
    await dialog.getByRole("button", { name: "Complete action" }).click();
    await expect(priyaPage.getByText("Action added.")).toBeVisible();

    await expect(row(priyaPage, project, planned)).toContainText("Planned");
    await expect(row(priyaPage, project, planned)).toContainText("Olivia Grant");
    await expect(row(priyaPage, project, own)).toContainText("Completed");
    await expect(row(priyaPage, project, own)).toContainText("Re-test after the next patch window");
    await noHorizontalScroll(priyaPage);
    await priyaPage.screenshot({ path: screenshotPath(project), fullPage: true });

    // Olivia, who is not the Ticket Owner, completes the action assigned to her.
    await login(oliviaPage, "olivia.grant@example.com");
    await oliviaPage.goto(`/staff/tickets/${ticketId}`);
    await expect(row(oliviaPage, project, planned)).toBeVisible();
    await row(oliviaPage, project, planned).getByRole("button", { name: /^Complete/ }).click();
    dialog = oliviaPage.getByRole("dialog");
    await expect(dialog.getByLabel("Mark completed")).toBeChecked();
    await dialog.getByRole("button", { name: "Complete action" }).click();
    await expect(dialog.getByText("Result is required to complete an action.")).toBeVisible(); // message sits under the field
    await oliviaPage.screenshot({ path: screenshotPath(project, "-modal-validation") });
    await dialog.getByLabel(/^result/i).fill("Access point replaced and tested");
    await dialog.getByRole("button", { name: "Complete action" }).click();
    await expect(oliviaPage.getByText("Action saved.")).toBeVisible();
    await expect(row(oliviaPage, project, planned)).toContainText("Completed");

    // Different Performed By on one Ticket, and the Ticket Owner never changed.
    const actions = await (await oliviaContext.request.get(`${API}/api/tickets/${ticketId}/actions`)).json();
    const byDescription = Object.fromEntries(actions.map((a: { description: string }) => [a.description, a]));
    expect(byDescription[planned].performedBy.fullName).toBe("Olivia Grant");
    expect(byDescription[planned].createdBy.fullName).toBe("Priya Natarajan");
    expect(byDescription[own].performedBy.fullName).toBe("Priya Natarajan");
    const ticket = await (await oliviaContext.request.get(`${API}/api/staff/tickets/${ticketId}`)).json();
    expect(ticket.ticketOwner.fullName).toBe("Priya Natarajan");

    // The Requester sees both actions with every field and no controls.
    await requesterPage.goto(`/tickets/${ticketId}`);
    await expect(row(requesterPage, project, planned)).toContainText("Olivia Grant");
    await expect(row(requesterPage, project, planned)).toContainText("Access point replaced and tested");
    await expect(row(requesterPage, project, own)).toContainText("Re-test after the next patch window");
    await expect(requesterPage.getByRole("button", { name: "Add Action" })).toHaveCount(0);
    await expect(container(requesterPage, project).getByRole("button")).toHaveCount(0);
    await noHorizontalScroll(requesterPage);
    await requesterPage.screenshot({ path: screenshotPath(project, "-requester"), fullPage: true });
  } finally {
    await requesterContext.close();
    await priyaContext.close();
    await oliviaContext.close();
  }
});

test("two sessions editing one action get a stale prompt that keeps their text; a double click creates one row (E2E-02)", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const requesterContext = await browser.newContext();
  const priyaContext = await browser.newContext();
  const oliviaContext = await browser.newContext();
  const [requesterPage, priyaPage, oliviaPage] = await Promise.all([requesterContext.newPage(), priyaContext.newPage(), oliviaContext.newPage()]);
  const base = `Review the firewall rule ${Date.now()}`;

  try {
    const ticketId = await createTicket(requesterPage, requesterContext, `E2E stale action ${Date.now()}`);
    await login(priyaPage, "priya.natarajan@example.com");
    await startWorking(priyaPage, ticketId);

    // Double click on Submit: exactly one action exists afterwards.
    await priyaPage.getByRole("button", { name: "Add Action" }).click();
    let dialog = priyaPage.getByRole("dialog");
    await dialog.getByLabel(/^description/i).fill(base);
    await dialog.getByRole("button", { name: "Create action" }).dblclick();
    await expect(priyaPage.getByText("Action added.")).toBeVisible();
    const afterDouble = await (await priyaContext.request.get(`${API}/api/tickets/${ticketId}/actions`)).json();
    expect(afterDouble.filter((a: { description: string }) => a.description === base)).toHaveLength(1);

    // Both staff open the same action.
    await login(oliviaPage, "olivia.grant@example.com");
    await oliviaPage.goto(`/staff/tickets/${ticketId}`);
    await row(oliviaPage, project, base).getByRole("button", { name: /^Edit/ }).click();
    const oliviaDialog = oliviaPage.getByRole("dialog");
    await expect(oliviaDialog.getByLabel(/^description/i)).toHaveValue(base);

    await row(priyaPage, project, base).getByRole("button", { name: /^Edit/ }).click();
    dialog = priyaPage.getByRole("dialog");
    await dialog.getByLabel(/^description/i).fill(`${base} (Priya)`);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(priyaPage.getByText("Action updated.")).toBeVisible();

    // Olivia saves on the old version: stale prompt, her text is kept, Reload then Save succeeds.
    await oliviaDialog.getByLabel(/^description/i).fill(`${base} (Olivia)`);
    await oliviaDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(oliviaDialog.getByText("This action was changed by someone else.")).toBeVisible();
    await expect(oliviaDialog.locator("body, *").filter({ hasText: /STALE_VERSION/ })).toHaveCount(0);
    await expect(oliviaDialog.getByLabel(/^description/i)).toHaveValue(`${base} (Olivia)`);
    await oliviaPage.screenshot({ path: screenshotPath(project, "-modal-conflict") });
    await oliviaDialog.getByRole("button", { name: "Reload" }).click();
    await expect(oliviaDialog.getByText(/Loaded the latest version/)).toBeVisible();
    await oliviaDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(oliviaPage.getByText("Action updated.")).toBeVisible();

    const final = await (await oliviaContext.request.get(`${API}/api/tickets/${ticketId}/actions`)).json();
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ description: `${base} (Olivia)`, version: 2 });
  } finally {
    await requesterContext.close();
    await priyaContext.close();
    await oliviaContext.close();
  }
});

test("the Add Action dialog works from the keyboard alone and returns focus (E2E-08, part)", async ({ browser }) => {
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const [requesterPage, staffPage] = await Promise.all([requesterContext.newPage(), staffContext.newPage()]);

  try {
    const ticketId = await createTicket(requesterPage, requesterContext, `E2E keyboard ${Date.now()}`);
    await login(staffPage, "priya.natarajan@example.com");
    await startWorking(staffPage, ticketId);

    const add = staffPage.getByRole("button", { name: "Add Action" });
    await add.focus();
    await staffPage.keyboard.press("Enter");

    const dialog = staffPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^description/i)).toBeFocused(); // focus moved in, to the first field

    // Tab never leaves the dialog.
    for (let i = 0; i < 14; i++) {
      await staffPage.keyboard.press("Tab");
      expect(await staffPage.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")))).toBe(true);
    }

    await staffPage.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused(); // restored to the control that opened it
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});
