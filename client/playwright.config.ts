import { defineConfig, devices } from "@playwright/test";

// E2E specs live outside client/tests/ (which Vitest owns via
// `include: ["tests/**/*.test.tsx"]`) so the two runners never collide.
// Runs against the real dev database (not the API test database) so
// screenshots show a realistically populated app — specs must therefore be
// self-contained and never assert a fixed row count (see requester-ticket-flow.spec.ts).
export default defineConfig({
  testDir: "../e2e/lab-02",
  outputDir: "../e2e/lab-02/.output",
  fullyParallel: false,
  retries: 0,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "../server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
