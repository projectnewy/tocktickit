import { Router } from "express";

const router = Router();

// Unchanged from Lab 1 — response shape is a graded contract.
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

export default router;
