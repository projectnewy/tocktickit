import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { requesterContext } from "../http/requesterContext.js";
import { BadRequestError } from "../http/errors.js";
import { createTicketSchema, ticketQuerySchema } from "../validation/ticket.schemas.js";
import * as ticketService from "../services/ticket.service.js";
import * as attachmentService from "../services/attachment.service.js";
import { uploadAttachment } from "../upload/multerUpload.js";

const router = Router();
router.use(requesterContext);

function parseTicketId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError("Invalid ticket id");
  return id;
}

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
    const ticketId = parseTicketId(req.params.ticketId);
    const ticket = await ticketService.getTicketById(req.requesterId!, ticketId);
    res.status(200).json(ticket);
  })
);

router.post(
  "/:ticketId/attachments",
  asyncHandler(async (req, res, next) => {
    const ticketId = parseTicketId(req.params.ticketId);
    await attachmentService.assertCanUploadToTicket(req.requesterId!, ticketId);
    next();
  }),
  uploadAttachment,
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    if (!req.file) throw new BadRequestError("No file uploaded");
    const attachment = await attachmentService.finalizeUpload(req.requesterId!, ticketId, req.file);
    res.status(201).json(attachment);
  })
);

router.get(
  "/:ticketId/attachments",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const attachments = await attachmentService.listAttachmentsForTicket(req.requesterId!, ticketId);
    res.status(200).json(attachments);
  })
);

export default router;
