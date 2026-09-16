// Augments Express's Request type with the resolved identity set by
// src/http/authContext.ts, so route handlers get it typed without a cast.
import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requesterId?: number;
      userRole?: Role;
      mustChangePassword?: boolean;
    }
  }
}

export {};
