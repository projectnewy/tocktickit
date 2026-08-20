import type { Request, Response } from "express";

// Keeps an unknown /api/* path a JSON 404 instead of Express's default HTML page.
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}
