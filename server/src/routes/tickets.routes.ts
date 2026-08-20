import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { requesterContext } from "../http/requesterContext.js";
import { BadRequestError } from "../http/errors.js";
import { createTicketSchema, ticketQuerySchema } from "../validation/ticket.schemas.js";
import * as ticketService from "../services/ticket.service.js";

const router = Router();
router.use(requesterContext);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(req.requesterId!, input);
    res.status(201).json(ticket);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = ticketQuerySchema.parse(req.query);
    const result = await ticketService.listTickets(req.requesterId!, query);
    res.status(200).json(result);
  })
);

router.get(
  "/:ticketId",
  asyncHandler(async (req, res) => {
    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      throw new BadRequestError("Invalid ticket id");
    }
    const ticket = await ticketService.getTicketById(req.requesterId!, ticketId);
    res.status(200).json(ticket);
  })
);

export default router;
