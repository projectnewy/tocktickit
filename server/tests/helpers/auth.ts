import { signSession, SESSION_COOKIE } from "../../src/auth/token.js";
import type { Role } from "@prisma/client";

// Signs a real session token the same way login does, and returns it as a
// ready-to-use Supertest `.set("Cookie", ...)` value — avoids an HTTP round
// trip through /api/auth/login in every test that just needs "logged in as X".
export function cookieFor(userId: number, role: Role): string {
  const token = signSession({ userId, role });
  return `${SESSION_COOKIE}=${token}`;
}
