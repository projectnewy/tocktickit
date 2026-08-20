// Augments Express's Request type with the resolved requester id set by
// src/http/requesterContext.ts, so route handlers get it typed without a cast.
declare global {
  namespace Express {
    interface Request {
      requesterId?: number;
    }
  }
}

export {};
