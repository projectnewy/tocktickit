import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { authContext, requireRole } from "../http/authContext.js";
import { staffQuerySchema } from "../validation/staff.schemas.js";
import * as staffService from "../services/staff.service.js";

const router = Router();
router.use(authContext, requireRole("IT_STAFF", "ADMINISTRATOR"));

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const query = staffQuerySchema.parse(req.query);
    const result = await staffService.listQueueTickets(req.requesterId!, query);
    res.status(200).json(result);
  })
);

export default router;
