import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import * as referenceService from "../services/reference.service.js";

const router = Router();

// Unchanged from Lab 1 — response shape is a graded contract (id, name; active only, id asc).
router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await referenceService.listActiveCategories());
  })
);

router.get(
  "/related-systems",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await referenceService.listActiveRelatedSystems());
  })
);

// No requester context required — the Development Requester Selection screen
// calls this before any requester has been chosen.
router.get(
  "/requesters",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await referenceService.listActiveRequesters());
  })
);

export default router;
