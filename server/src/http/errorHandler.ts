import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

interface BodyParseError extends Error {
  type?: string;
}

// Central error mapping — every thrown error in the app ends up here (via
// asyncHandler) and always gets a safe JSON body, never an HTML page or a
// stack trace. Order matters: most specific first.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  // Malformed JSON body from express.json(). Without this, Express's default
  // handler returns an HTML error page and the client's res.json() breaks.
  const bodyParseErr = err as BodyParseError;
  if (bodyParseErr?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  // multer throws a plain Error with name "MulterError" — duck-typed here so
  // this file doesn't need a multer import before Issue 9 adds uploads.
  if (err instanceof Error && err.name === "MulterError") {
    const code = (err as Error & { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File exceeds the 5 MB limit" });
      return;
    }
    res.status(400).json({ error: "Invalid upload" });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Conflict" });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({ error: "Invalid reference" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
}
