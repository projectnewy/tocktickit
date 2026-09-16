import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { authContext, requireRole } from "../http/authContext.js";
import { BadRequestError } from "../http/errors.js";
import { claimTicketSchema, priorityUpdateSchema, staffQuerySchema, statusUpdateSchema } from "../validation/staff.schemas.js";
import * as staffService from "../services/staff.service.js";

const router = Router();
router.use(authContext, requireRole("IT_STAFF", "ADMINISTRATOR"));

function parseTicketId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError("Invalid ticket id");
  return id;
}

router.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const query = staffQuerySchema.parse(req.query);
    const result = await staffService.listQueueTickets(req.requesterId!, query);
    res.status(200).json(result);
  })
);

router.get(
  "/tickets/:ticketId",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const ticket = await staffService.getTicketDetail(ticketId);
    res.status(200).json(ticket);
  })
);

router.patch(
  "/tickets/:ticketId/claim",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const { targetUserId } = claimTicketSchema.parse(req.body);
    const ticket = await staffService.claimTicket(ticketId, req.requesterId!, targetUserId);
    res.status(200).json(ticket);
  })
);

router.patch(
  "/tickets/:ticketId/priority",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const { itPriority } = priorityUpdateSchema.parse(req.body);
    const ticket = await staffService.setPriority(ticketId, itPriority);
    res.status(200).json(ticket);
  })
);

router.patch(
  "/tickets/:ticketId/status",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const { status } = statusUpdateSchema.parse(req.body);
    const ticket = await staffService.setStatus(ticketId, status);
    res.status(200).json(ticket);
  })
);

export default router;
