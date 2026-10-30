import { expect, test, type Page } from "@playwright/test";
import { login } from "../lab-03/helpers.js";

// Final hardening (docs/lab-04/specification.md FR-16, FR-20, FR-21; Issue #59): with a real browser, every
// screen each role can open is visited and must produce no console error, no uncaught exception, no failed
// request, no placeholder or "undefined" text, and no link that leads to the Not Found page. The Lab 1 /system
// screen is gone. Runs at desktop, tablet and mobile like every other spec.
const API = "http://localhost:3000";

// Text that must never reach a user.
const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bFIXME\b|undefined|\[object Object\]|\bNaN\b|Invalid Date|\bnull\b/;

interface Watch {
  problems: string[];
  stop: () => void;
}

// Collects everything a user could not see but a developer would not want: console errors, uncaught
// exceptions, failed or 4xx/5xx responses from the app's own origins.
function watch(page: Page): Watch {
  const problems: string[] = [];
  const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()} (${message.location().url})`);
  };
  const onPageError = (error: Error) => problems.push(`pageerror: ${error.message}`);
  const onResponse = (response: import("@playwright/test").Response) => {
    const url = response.url();
    if (response.status() >= 400 && (url.startsWith(API) || url.includes("localhost:5173"))) problems.push(`HTTP ${response.status()} ${response.request().method()} ${url}`);
  };
  const onFailed = (request: import("@playwright/test").Request) => {
    // A navigation aborted by a client-side redirect is not a failure.
    if (request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  return {
    problems,
    stop: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
      page.off("requestfailed", onFailed);
    },
  };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

// Visits a screen and checks what a person would see: a heading, no placeholder text, no horizontal scroll.
async function visit(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await settle(page);
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(text, `${path} shows placeholder-looking text`).not.toMatch(PLACEHOLDER);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), `${path} scrolls horizontally`).toBe(false);
}

// Every same-app link visible on the current screen must lead somewhere real.
async function assertLinksResolve(page: Page, from: string) {
  const hrefs = await page.locator("a[href^='/']").evaluateAll((anchors) => [...new Set(anchors.map((a) => a.getAttribute("href") as string))]);
  expect(hrefs.length, `${from} has no internal links to check`).toBeGreaterThan(0);
  for (const href of hrefs) {
    await page.goto(href);
    await settle(page);
    await expect(page.getByRole("heading", { name: "Page not found" }), `${from} links to ${href}, which is Not Found`).toHaveCount(0);
  }
}

const ROLES = [
  {
    name: "Requester",
    email: "jennifer.anderson@example.com",
    screens: [
      ["/dashboard", /^dashboard$/i],
      ["/tickets", /my tickets/i],
      ["/tickets/new", /create ticket/i],
      ["/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=WAITING_FOR_REQUESTER&status=REOPENED", /my tickets/i],
    ] as [string, RegExp][],
    detail: async (page: Page) => {
      const list = await page.context().request.get(`${API}/api/tickets?pageSize=10`);
      return `/tickets/${(await list.json()).items[0].id}`;
    },
    detailHeading: /^TKT-/,
    linkSources: ["/dashboard", "/tickets"],
  },
  {
    name: "IT Staff",
    email: "priya.natarajan@example.com",
    screens: [
      ["/staff/dashboard", /^dashboard$/i],
      ["/staff/tickets", /ticket queue/i],
      ["/staff/tickets?itPriority=URGENT&status=OPEN&status=IN_PROGRESS", /ticket queue/i],
    ] as [string, RegExp][],
    detail: async (page: Page) => {
      const list = await page.context().request.get(`${API}/api/staff/tickets?pageSize=10`);
      return `/staff/tickets/${(await list.json()).items[0].id}`;
    },
    detailHeading: /^TKT-/,
    linkSources: ["/staff/dashboard", "/staff/tickets"],
  },
  {
    name: "Administrator",
    email: "olivia.grant@example.com",
    screens: [
      ["/staff/dashboard", /^dashboard$/i],
      ["/staff/tickets", /ticket queue/i],
      ["/admin/users", /user management/i],
    ] as [string, RegExp][],
    detail: async (page: Page) => {
      const list = await page.context().request.get(`${API}/api/staff/tickets?pageSize=10`);
      return `/staff/tickets/${(await list.json()).items[0].id}`;
    },
    detailHeading: /^TKT-/,
    linkSources: ["/staff/dashboard"],
  },
];

for (const role of ROLES) {
  test(`${role.name}: every screen is free of console errors, failed requests, placeholder text, broken links and horizontal scroll (FR-16, FR-21)`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const watcher = watch(page);

    try {
      // The signed-out visit asks the session probe: that must not be a failed request.
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();
      await settle(page);

      await login(page, role.email);
      await settle(page);

      for (const [path, heading] of role.screens) await visit(page, path, heading);
      await visit(page, await role.detail(page), role.detailHeading);

      for (const source of role.linkSources) {
        await page.goto(source);
        await settle(page);
        await assertLinksResolve(page, source);
      }

      await page.getByRole("button", { name: /logout/i }).click();
      await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();
      await settle(page);

      expect(watcher.problems, watcher.problems.join("\n")).toEqual([]);
    } finally {
      watcher.stop();
      await context.close();
    }
  });
}

// Every keyboard focus stop on a screen must draw a visible indicator (a real outline or a focus shadow). This
// walks the Tab order from the top of each screen and fails with the list of stops that show nothing.
async function focusStopsWithoutIndicator(page: Page): Promise<{ stops: number; missing: string[] }> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const missing: string[] = [];
  const seen = new Set<string>();
  let stops = 0;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`;
      return {
        key: `${label}@${Math.round(rect.top)},${Math.round(rect.left)}`,
        label,
        visibleBox: rect.width > 0 && rect.height > 0,
        outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
        shadow: style.boxShadow !== "none",
      };
    });
    if (!info || seen.has(info.key)) break; // wrapped around, or left the page
    seen.add(info.key);
    stops++;
    if (info.visibleBox && !info.outline && !info.shadow) missing.push(info.label);
  }
  return { stops, missing };
}

for (const role of ROLES) {
  test(`${role.name}: every keyboard focus stop shows a visible indicator on every screen (FR-18, AC-24)`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, role.email);
      const screens: string[] = [...role.screens.map(([path]) => path), await role.detail(page)];
      for (const path of screens) {
        await page.goto(path);
        await settle(page);
        const { stops, missing } = await focusStopsWithoutIndicator(page);
        expect(stops, `${path} has focus stops`).toBeGreaterThan(3);
        expect(missing, `${path}: focus stops with no visible indicator`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });
}

test("the Lab 1 /system screen is gone: it is Not Found, and no system-check control exists (FR-20)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, "jennifer.anderson@example.com");
    await page.goto("/system");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("button", { name: /check system/i })).toHaveCount(0);
    for (const role of ROLES) {
      // None of the navigation menus offers it either.
      expect(role.screens.map(([path]) => path)).not.toContain("/system");
    }
  } finally {
    await context.close();
  }
});

test("an unknown address shows a friendly Not Found page, not a blank screen or a raw error", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, "priya.natarajan@example.com");
    await page.goto("/this/does/not/exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/stack|TypeError|Cannot GET/i);
  } finally {
    await context.close();
  }
});
