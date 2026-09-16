import { Router, type Request } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { authContext } from "../http/authContext.js";
import { BadRequestError, ForbiddenError } from "../http/errors.js";
import { createTicketSchema, ticketQuerySchema } from "../validation/ticket.schemas.js";
import { createCommentSchema } from "../validation/comment.schemas.js";
import * as ticketService from "../services/ticket.service.js";
import * as attachmentService from "../services/attachment.service.js";
import * as commentService from "../services/comment.service.js";
import * as noteService from "../services/internalNote.service.js";
import { uploadAttachment } from "../upload/multerUpload.js";

const router = Router();
router.use(authContext);

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

router.get(
  "/:ticketId/comments",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const comments = await commentService.listComments(req.requesterId!, req.userRole!, ticketId);
    res.status(200).json(comments);
  })
);

router.post(
  "/:ticketId/comments",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const { body } = createCommentSchema.parse(req.body);
    const comment = await commentService.addComment(req.requesterId!, req.userRole!, ticketId, body);
    res.status(201).json(comment);
  })
);

// BR-22/AC-04: 403 for a Requester, checked before any ticket lookup, so the
// response never confirms or denies the ticket's existence either way.
function requireStaffForNotes(req: Request) {
  if (req.userRole === "REQUESTER") throw new ForbiddenError("Forbidden");
}

router.get(
  "/:ticketId/notes",
  asyncHandler(async (req, res) => {
    requireStaffForNotes(req);
    const ticketId = parseTicketId(req.params.ticketId);
    const notes = await noteService.listNotes(ticketId);
    res.status(200).json(notes);
  })
);

router.post(
  "/:ticketId/notes",
  asyncHandler(async (req, res) => {
    requireStaffForNotes(req);
    const ticketId = parseTicketId(req.params.ticketId);
    const { body } = createCommentSchema.parse(req.body);
    const note = await noteService.addNote(req.requesterId!, ticketId, body);
    res.status(201).json(note);
  })
);

router.post(
  "/:ticketId/resolution-indication",
  asyncHandler(async (req, res) => {
    const ticketId = parseTicketId(req.params.ticketId);
    const ticket = await ticketService.indicateResolution(req.requesterId!, ticketId);
    res.status(200).json(ticket);
  })
);

export default router;
