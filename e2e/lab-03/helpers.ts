import { expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Not a *.spec.ts file, so Playwright's test runner never picks it up as its
// own suite — shared helpers for the three Lab 3 spec files only.
export const SEED_PASSWORD = "Password123!";

const ARTIFACTS_ROOT = path.resolve(__dirname, "../../artifacts/lab-03/screenshots");

export function screenshotPath(folder: string, projectName: string): string {
  const dir = path.join(ARTIFACTS_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${projectName}.png`);
}

// Waits for the redirect to settle (either /tickets, the universal landing
// page, or /change-password when mustChangePassword is owed) before
// returning — callers that immediately navigate elsewhere (e.g. an
// Administrator going to /admin/users) would otherwise race the in-flight
// login request and its client-side redirect.
export async function login(page: Page, email: string, password: string = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /my tickets|change your password/i })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /logout/i }).click();
  await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();
}
