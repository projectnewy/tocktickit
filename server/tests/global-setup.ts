import { execSync } from "node:child_process";

// Runs once before the whole test run: applies all migrations to the test
// database (already pointed at by DATABASE_URL via `dotenv -e .env.test`).
export default function globalSetup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
