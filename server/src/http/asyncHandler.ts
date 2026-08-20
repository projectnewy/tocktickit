import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch rejected promises from async route handlers — an
// unwrapped async handler that throws just hangs the request. Every async
// route must be wrapped in this.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
