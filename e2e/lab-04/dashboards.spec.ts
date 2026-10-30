import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { login } from "../lab-03/helpers.js";

// E2E-05 / E2E-06 / part of E2E-08 (docs/lab-04/tests.md), Requester side: the Dashboard summarises the
// signed-in Requester's own Tickets, every count opens My Tickets with exactly the Tickets it counted,
// changes made by IT Staff show up, and the whole screen works from the keyboard at three widths. The IT
// Staff dashboard cases are added with Issue #58 in this same file.
const API = "http://localhost:3000";

function screenshotPath(folder: string, projectName: string, suffix = ""): string {
  const dir = path.resolve(__dirname, "../../artifacts/lab-04/screenshots", folder);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${projectName}${suffix}.png`);
}

const countOf = async (page: Page, label: string) => Number(await page.getByRole("region", { name: label }).locator(".display-5").innerText());

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

// How many separate rows the four cards occupy: 1 at desktop (4 across), 2 at tablet, 4 at mobile.
async function cardRows(page: Page): Promise<number> {
  const tops = await Promise.all(
    ["Open Tickets", "Waiting for You", "Recently Updated", "Recently Resolved"].map((name) =>
      page.getByRole("region", { name }).evaluate((el) => Math.round(el.getBoundingClientRect().top))
    )
  );
  return new Set(tops).size;
}

async function createTicket(page: Page, context: BrowserContext, summary: string): Promise<number> {
  await page.goto("/tickets/new");
  await page.getByLabel(/^category/i).selectOption({ label: "Network" });
  await page.getByLabel(/related system/i).selectOption({ label: "VPN" });
  await page.getByLabel(/requested priority/i).selectOption("MEDIUM");
  await page.getByLabel(/ticket summary/i).fill(summary);
  await page.getByLabel(/^description/i).fill("Created by the Lab 4 dashboard E2E test.");
  await page.getByRole("button", { name: /submit ticket/i }).click();
  await expect(page.getByText(/created successfully/i)).toBeVisible();
  const list = await context.request.get(`${API}/api/tickets?q=${encodeURIComponent(summary)}`);
  return (await list.json()).items[0].id as number;
}

test("the Requester Dashboard counts, lists and drill-downs match the Requester's real Tickets, and follow IT Staff changes (E2E-05, E2E-06)", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const [page, staffPage] = await Promise.all([requesterContext.newPage(), staffContext.newPage()]);
  const summary = `E2E dashboard ${Date.now()}`;

  try {
    await login(page, "jennifer.anderson@example.com");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Open Tickets" })).toBeVisible();

    // The nav leads with Dashboard and marks it as the current page.
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link").first()).toHaveText("Dashboard");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    // Responsive grid: 4 across, 2 across, 1 across.
    expect(await cardRows(page)).toBe({ desktop: 1, tablet: 2, mobile: 4 }[project as "desktop" | "tablet" | "mobile"]);
    await noHorizontalScroll(page);

    const beforeOpen = await countOf(page, "Open Tickets");
    const beforeWaiting = await countOf(page, "Waiting for You");

    // A new Ticket raises Open Tickets by one and heads Recently Updated, linking to its detail.
    const ticketId = await createTicket(page, requesterContext, summary);
    await page.goto("/dashboard");
    await expect.poll(() => countOf(page, "Open Tickets")).toBe(beforeOpen + 1);
    const recent = page.getByRole("region", { name: "Recently Updated" });
    await expect(recent.getByRole("listitem").first()).toContainText(summary);

    // IT Staff move it to Waiting for Requester: the card now asks for the Requester, in words and an icon.
    await login(staffPage, "priya.natarajan@example.com");
    await staffPage.goto(`/staff/tickets/${ticketId}`);
    await staffPage.getByRole("button", { name: /^claim$/i }).click();
    await expect(staffPage.getByText(/ticket claimed/i)).toBeVisible();
    await staffPage.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(staffPage.getByText("Status changed to In Progress.")).toBeVisible();
    await staffPage.getByLabel(/^status$/i).selectOption("WAITING_FOR_REQUESTER");
    await expect(staffPage.getByText("Status changed to Waiting for Requester.")).toBeVisible();

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => countOf(page, "Waiting for You")).toBe(beforeWaiting + 1);
    await expect(page.getByRole("region", { name: "Waiting for You" })).toContainText("Needs your reply");
    await expect(recent.getByRole("listitem").first()).toContainText("Waiting for Requester");
    await noHorizontalScroll(page);
    await page.screenshot({ path: screenshotPath("requester-dashboard", project), fullPage: true });

    // Drill-down: each count opens My Tickets with exactly the Tickets it counted (BR-29, AC-16).
    for (const label of ["Open Tickets", "Waiting for You"]) {
      const expected = await countOf(page, label);
      await page.getByRole("link", { name: `View ${label}` }).click();
      await page.waitForURL(/\/tickets\?/);
      await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
      const query = new URL(page.url()).search;
      const list = await requesterContext.request.get(`${API}/api/tickets${query}&pageSize=50`);
      expect((await list.json()).totalItems, `${label} -> ${query}`).toBe(expected);
      await page.goto("/dashboard");
      await expect(page.getByRole("region", { name: "Open Tickets" })).toBeVisible();
    }

    // The recently updated list item opens the Ticket Detail.
    await page.getByRole("region", { name: "Recently Updated" }).getByRole("link", { name: new RegExp(`TKT-.*${summary}`) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});

test("a Requester with no Tickets sees zeros and clear empty messages (AC-15)", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const adminContext = await browser.newContext();
  const newUserContext = await browser.newContext();
  const [adminPage, page] = await Promise.all([adminContext.newPage(), newUserContext.newPage()]);
  const email = `e2e.empty.${Date.now()}@example.com`;
  const initialPassword = `Init${Date.now()}!`;
  const finalPassword = `Final${Date.now()}!`;

  try {
    await login(adminPage, "olivia.grant@example.com");
    await adminPage.goto("/admin/users");
    await adminPage.getByRole("button", { name: /create user/i }).click();
    const dialog = adminPage.getByRole("dialog");
    await dialog.getByLabel(/^name/i).fill("E2E Empty Requester");
    await dialog.getByLabel(/^email/i).fill(email);
    await dialog.getByLabel(/^role/i).selectOption("REQUESTER");
    await dialog.getByLabel(/initial password/i).fill(initialPassword);
    await dialog.getByRole("button", { name: /^create user$/i }).click();
    await expect(adminPage.getByText(/user created\./i)).toBeVisible();

    await login(page, email, initialPassword);
    await page.getByLabel(/current password/i).fill(initialPassword);
    await page.getByLabel(/^new password/i).fill(finalPassword);
    await page.getByLabel(/confirm new password/i).fill(finalPassword);
    await page.getByRole("button", { name: /save new password/i }).click();
    await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(await countOf(page, "Open Tickets")).toBe(0);
    expect(await countOf(page, "Waiting for You")).toBe(0);
    await expect(page.getByRole("region", { name: "Waiting for You" })).not.toContainText("Needs your reply");
    await expect(page.getByText("No tickets updated in the last 7 days.")).toBeVisible();
    await expect(page.getByText("No tickets resolved in the last 7 days.")).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: screenshotPath("requester-dashboard", project, "-empty"), fullPage: true });
  } finally {
    await adminContext.close();
    await newUserContext.close();
  }
});

test("the Dashboard works from the keyboard: links take a visible focus ring and Enter follows them (E2E-08, part)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, "jennifer.anderson@example.com");
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Open Tickets" })).toBeVisible();

    // Tab until the "View Open Tickets" link has focus (the skip link and nav come first).
    let focused = false;
    for (let i = 0; i < 25 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => document.activeElement?.textContent?.trim().startsWith("View Open Tickets") ?? false);
    }
    expect(focused).toBe(true);

    // A visible indicator: a real outline, not "none".
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/tickets\?status=/);
    await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------
// IT Staff / Administrator side (Issue #58): role landing and guards, the Staff Dashboard, and its drill-downs.
// ---------------------------------------------------------------------------------------------------------

const rowsOf = async (page: Page, labels: string[]) =>
  new Set(await Promise.all(labels.map((name) => page.getByRole("region", { name }).evaluate((el) => Math.round(el.getBoundingClientRect().top))))).size;

test("each role lands on its own Dashboard after login, and a screen of another role sends it back (E2E-06, FR-12, BR-30)", async ({ browser }) => {
  const people = [
    { email: "jennifer.anderson@example.com", landing: /\/dashboard$/, nav: ["Dashboard", "My Tickets", "Create Ticket"] },
    { email: "priya.natarajan@example.com", landing: /\/staff\/dashboard$/, nav: ["Dashboard", "Ticket Queue"] },
    { email: "olivia.grant@example.com", landing: /\/staff\/dashboard$/, nav: ["Dashboard", "Ticket Queue", "Users"] },
  ];
  for (const person of people) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, person.email);
      await expect(page).toHaveURL(person.landing);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("link")).toHaveText(person.nav);
      await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

      // The root path ends at this role's own Dashboard.
      await page.goto("/");
      await expect(page).toHaveURL(person.landing);

      // My Tickets belongs to Requesters: staff are sent back to their Dashboard.
      await page.goto("/tickets");
      if (person.email.startsWith("jennifer")) await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();
      else await expect(page).toHaveURL(/\/staff\/dashboard$/);
    } finally {
      await context.close();
    }
  }

  // A Requester cannot open the staff screens, even by typing the address.
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, "jennifer.anderson@example.com");
    for (const path of ["/staff/dashboard", "/staff/tickets", "/admin/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test("the Staff Dashboard counts follow real changes and every row opens exactly the Tickets it counted (E2E-05, AC-14, AC-16)", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  const requesterContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const [requesterPage, page] = await Promise.all([requesterContext.newPage(), staffContext.newPage()]);
  const summary = `E2E staff dashboard ${Date.now()}`;

  try {
    await login(requesterPage, "jennifer.anderson@example.com");
    await login(page, "priya.natarajan@example.com");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Unassigned" })).toBeVisible();

    // Layout: the two count cards sit side by side except on mobile; the two panels stack below 992px.
    expect(await rowsOf(page, ["Unassigned", "Owned by Me"])).toBe(project === "mobile" ? 2 : 1);
    expect(await rowsOf(page, ["By Status", "By IT Priority"])).toBe(project === "desktop" ? 1 : 2);
    await noHorizontalScroll(page);

    const beforeUnassigned = await countOf(page, "Unassigned");
    const beforeMine = await countOf(page, "Owned by Me");

    // A new Ticket is unassigned until staff claim it.
    const ticketId = await createTicket(requesterPage, requesterContext, summary);
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => countOf(page, "Unassigned")).toBe(beforeUnassigned + 1);
    await expect(page.getByRole("region", { name: "Recently Updated" }).getByRole("listitem").first()).toContainText(summary);

    await page.goto(`/staff/tickets/${ticketId}`);
    await page.getByRole("button", { name: /^claim$/i }).click();
    await expect(page.getByText(/ticket claimed/i)).toBeVisible();
    await page.getByLabel(/it priority/i).selectOption("URGENT");
    await expect(page.getByText("IT Priority set to Urgent.")).toBeVisible();
    await page.getByLabel(/^status$/i).selectOption("IN_PROGRESS");
    await expect(page.getByText("Status changed to In Progress.")).toBeVisible();
    const planned = await staffContext.request.post(`${API}/api/tickets/${ticketId}/actions`, { data: { description: `Call the supplier ${Date.now()}` } });
    expect(planned.status()).toBe(201);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect.poll(() => countOf(page, "Unassigned")).toBe(beforeUnassigned);
    await expect.poll(() => countOf(page, "Owned by Me")).toBe(beforeMine + 1);
    await expect(page.getByRole("region", { name: "Urgent Tickets" }).getByRole("listitem").first()).toContainText(summary);
    await expect(page.getByRole("region", { name: "My Planned Actions" }).getByRole("listitem").first()).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: screenshotPath("staff-dashboard", project), fullPage: true });

    // Drill-down: every count card and breakdown row opens the Ticket Queue with exactly the Tickets it counted.
    const targets: { name: string; open: () => Promise<void>; count: number }[] = [];
    for (const label of ["Unassigned", "Owned by Me"]) {
      targets.push({ name: label, count: await countOf(page, label), open: () => page.getByRole("link", { name: `View ${label}` }).click() });
    }
    for (const region of ["By Status", "By IT Priority"]) {
      const links = page.getByRole("region", { name: region }).getByRole("link");
      const total = await links.count();
      for (let i = 0; i < total; i++) {
        const aria = (await links.nth(i).getAttribute("aria-label")) ?? "";
        targets.push({ name: `${region} ${aria}`, count: Number(aria.split(": ")[1]), open: () => links.nth(i).click() });
      }
    }
    expect(targets).toHaveLength(2 + 5 + 4);
    for (const target of targets) {
      await target.open();
      await page.waitForURL(/\/staff\/tickets\?/);
      await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
      const query = new URL(page.url()).search;
      const list = await staffContext.request.get(`${API}/api/staff/tickets${query}&pageSize=50`);
      expect((await list.json()).totalItems, `${target.name} -> ${query}`).toBe(target.count);
      await page.goto("/staff/dashboard");
      await expect(page.getByRole("region", { name: "Unassigned" })).toBeVisible();
    }
  } finally {
    await requesterContext.close();
    await staffContext.close();
  }
});

test("a dashboard link with several statuses opens a queue whose filters say so, instead of showing just one (BR-29)", async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, "priya.natarajan@example.com");
    await page.getByRole("link", { name: "View Owned by Me" }).click();
    await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("__several");
    await expect(page.getByLabel("Status", { exact: true }).locator("option:checked")).toHaveText("5 statuses selected");
    await expect(page.getByLabel("Owner")).toHaveValue("me");

    await page.goto("/staff/dashboard");
    await page.getByRole("region", { name: "By IT Priority" }).getByRole("link", { name: /^URGENT:/ }).click();
    await expect(page.locator("#staff-filter-priority")).toHaveValue("URGENT");

    // The Last Updated column really sorts by the last update (the sortable table is the desktop layout; the other widths show cards).
    if (testInfo.project.name === "desktop") await page.getByRole("button", { name: /last updated/i }).first().click();
    if (testInfo.project.name === "desktop") await expect(page).toHaveURL(/sort=updatedAt/);
  } finally {
    await context.close();
  }
});

test("an Administrator also sees the account summary; IT Staff do not (E2E-05, BR-27)", async ({ browser }, testInfo) => {
  const adminContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const [adminPage, staffPage] = await Promise.all([adminContext.newPage(), staffContext.newPage()]);
  try {
    await login(adminPage, "olivia.grant@example.com");
    await expect(adminPage.getByRole("region", { name: "Users" })).toBeVisible();
    await expect(adminPage.getByRole("region", { name: "Users" })).toContainText("Inactive accounts");
    await noHorizontalScroll(adminPage);
    await adminPage.screenshot({ path: screenshotPath("staff-dashboard", testInfo.project.name, "-admin"), fullPage: true });
    await adminPage.getByRole("link", { name: "View Users" }).click();
    await expect(adminPage.getByRole("heading", { name: /user management/i })).toBeVisible();

    await login(staffPage, "priya.natarajan@example.com");
    await expect(staffPage.getByRole("region", { name: "Unassigned" })).toBeVisible();
    await expect(staffPage.getByRole("region", { name: "Users" })).toHaveCount(0);
  } finally {
    await adminContext.close();
    await staffContext.close();
  }
});

test("the IT Staff flow works from the keyboard alone: dashboard link, then a queue row opened with Space (E2E-08)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const tabUntil = async (matches: () => Promise<boolean>) => {
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      if (await matches()) return;
    }
    throw new Error("focus never reached the expected element");
  };

  try {
    await login(page, "priya.natarajan@example.com");
    await expect(page.getByRole("region", { name: "Unassigned" })).toBeVisible();

    // Reach "View Unassigned" with Tab, check the focus ring is really drawn, follow it with Enter.
    await tabUntil(() => page.evaluate(() => document.activeElement?.textContent?.trim().startsWith("View Unassigned") ?? false));
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/staff\/tickets\?/);
    await expect(page.getByRole("heading", { name: /ticket queue/i })).toBeVisible();

    // Tab to the first ticket row (a table row on desktop, a card below 992px) and open it with Space.
    await expect(page.locator(".tk-clickable-row:visible, [role='button'][tabindex='0']:visible").first()).toBeVisible();
    await tabUntil(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return Boolean(el && el.tabIndex === 0 && (el.classList.contains("tk-clickable-row") || el.getAttribute("role") === "button") && el.offsetParent !== null);
      })
    );
    await page.keyboard.press("Space");
    await page.waitForURL(/\/staff\/tickets\/\d+$/);
    await expect(page.getByRole("heading", { name: /^TKT-/ })).toBeVisible();
  } finally {
    await context.close();
  }
});
