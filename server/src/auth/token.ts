import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "tk_session";

export interface SessionPayload {
  userId: number;
  role: Role;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000, // 8h, matches env.jwtExpiresIn
};
