import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { authContext, requireRole } from "../http/authContext.js";
import * as dashboardService from "../services/dashboard.service.js";

const router = Router();
router.use(authContext);

// api-spec authorization matrix: Requester only. The role is checked before any query, and the Requester id
// comes from the session, so this endpoint cannot be pointed at someone else's Tickets.
router.get(
  "/requester",
  requireRole("REQUESTER"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await dashboardService.getRequesterDashboard(req.requesterId!));
  })
);

// Staff and Administrators; an Administrator additionally gets the user-account counts (BR-27).
router.get(
  "/staff",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await dashboardService.getStaffDashboard(req.requesterId!, req.userRole === "ADMINISTRATOR"));
  })
);

export default router;
