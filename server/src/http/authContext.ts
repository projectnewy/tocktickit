import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { asyncHandler } from "./asyncHandler.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";
import { SESSION_COOKIE, verifySession } from "../auth/token.js";

// Replaces Lab 2's requesterContext (X-Requester-Id header) with a real
// authenticated session, read from a signed httpOnly cookie. Applied
// per-router, same mounting discipline as Lab 2's middleware — never global,
// since /api/health and the reference endpoints must stay reachable without a
// session, and /api/auth/* needs its own lighter handling (see identifyUser
// below — /auth/me and /auth/change-password must work even while
// mustChangePassword is still true, so they can't sit behind the full gate).
//
// req.requesterId is kept as the downstream contract so ticket.service.ts and
// attachment.service.ts need no signature changes: for a Requester it *is*
// their ticket-ownership id; for IT Staff/Administrator it's just "the
// current user's id," used by staff/admin routes instead.

// Base check: valid session → sets req.requesterId/req.userRole/req.mustChangePassword.
// No mustChangePassword gate — used directly by the /api/auth router.
export const identifyUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token ? verifySession(token) : null;

  if (!payload) {
    throw new UnauthorizedError("Not authenticated");
  }

  const user = await getPrisma().user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Not authenticated");
  }

  req.requesterId = user.id;
  req.userRole = user.role;
  req.mustChangePassword = user.mustChangePassword;
  next();
});

// Full gate for every protected feature router (tickets, attachments, staff,
// admin): identifies the user AND blocks access while a password change is
// still owed.
export const authContext = [
  identifyUser,
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.mustChangePassword) {
      throw new ForbiddenError("Password change required");
    }
    next();
  },
];

// Role guard — mount after authContext. Throws 403 without leaking whether
// the underlying resource exists (see api-spec.md "Safe error shape").
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      throw new ForbiddenError("Forbidden");
    }
    next();
  };
}
