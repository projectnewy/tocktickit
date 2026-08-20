import { Router, type Request } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { requesterContext } from "../http/requesterContext.js";
import { BadRequestError } from "../http/errors.js";
import { removeAttachmentSchema } from "../validation/attachment.schemas.js";
import * as attachmentService from "../services/attachment.service.js";

const router = Router();
router.use(requesterContext);

function parseAttachmentId(req: Request): number {
  const id = Number(req.params.attachmentId);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError("Invalid attachment id");
  return id;
}

router.get(
  "/:attachmentId",
  asyncHandler(async (req, res) => {
    const id = parseAttachmentId(req);
    const attachment = await attachmentService.getAttachmentById(req.requesterId!, id);
    res.status(200).json(attachment);
  })
);

router.get(
  "/:attachmentId/download",
  asyncHandler(async (req, res) => {
    const id = parseAttachmentId(req);
    const file = await attachmentService.resolveAttachmentForDownload(req.requesterId!, id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`
    );
    res.type(file.mimeType);
    res.sendFile(file.absolutePath);
  })
);

router.delete(
  "/:attachmentId",
  asyncHandler(async (req, res) => {
    const id = parseAttachmentId(req);
    const { reason } = removeAttachmentSchema.parse(req.body);
    const attachment = await attachmentService.removeAttachment(req.requesterId!, id, reason);
    res.status(200).json(attachment);
  })
);

export default router;
