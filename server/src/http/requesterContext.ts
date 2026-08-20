import type { NextFunction, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { asyncHandler } from "./asyncHandler.js";
import { UnauthorizedError } from "./errors.js";

// Reads the temporary Development Requester selector's identity from the
// X-Requester-Id header (see docs/lab-02/specification.md §11 and api-spec.md
// §1 for why a header, and why 401 rather than 400). Applied per-router to
// ticket/attachment routes only — never globally, since /api/health and the
// three reference endpoints (including /api/requesters itself, which the
// selector screen calls before any requester is chosen) must stay open.
export const requesterContext = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("X-Requester-Id");
  const id = header ? Number(header) : NaN;

  if (!header || !Number.isInteger(id) || id <= 0) {
    throw new UnauthorizedError();
  }

  const requester = await getPrisma().requesterUser.findUnique({ where: { id } });
  if (!requester || !requester.isActive) {
    throw new UnauthorizedError();
  }

  req.requesterId = requester.id;
  next();
});
