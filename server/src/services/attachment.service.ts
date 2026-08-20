import type { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ConflictError, GoneError, NotFoundError, UnsupportedMediaTypeError } from "../http/errors.js";
import { MAX_ACTIVE_ATTACHMENTS_PER_TICKET } from "../config.js";
import { matchesDeclaredType } from "../upload/fileSignature.js";
import { attachmentAbsolutePath, safeUnlink } from "../upload/storage.js";

const ATTACHMENT_SELECT = {
  id: true,
  ticketId: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  removedAt: true,
  removedReason: true,
  uploadedBy: { select: { id: true, fullName: true } },
  removedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AttachmentSelect;

type AttachmentRow = Prisma.AttachmentGetPayload<{ select: typeof ATTACHMENT_SELECT }>;

function serializeAttachment(a: AttachmentRow) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedAt: a.uploadedAt,
    uploadedBy: a.uploadedBy,
    isRemoved: a.removedAt !== null,
    removedAt: a.removedAt,
    removedReason: a.removedReason,
    removedBy: a.removedBy,
  };
}

async function assertOwnedTicket(ticketId: number, requesterId: number) {
  const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

// Fail-fast check run BEFORE multer accepts the multipart body — not
// authoritative on its own (see finalizeUpload for the transactional check
// that actually prevents a 6th active attachment under concurrency).
export async function assertCanUploadToTicket(requesterId: number, ticketId: number) {
  await assertOwnedTicket(ticketId, requesterId);
  const activeCount = await getPrisma().attachment.count({ where: { ticketId, removedAt: null } });
  if (activeCount >= MAX_ACTIVE_ATTACHMENTS_PER_TICKET) {
    throw new ConflictError("This ticket already has the maximum of 5 active attachments");
  }
}

export async function finalizeUpload(requesterId: number, ticketId: number, file: Express.Multer.File) {
  const filePath = file.path;
  try {
    const signatureMatches = await matchesDeclaredType(filePath, file.mimetype);
    if (!signatureMatches) {
      throw new UnsupportedMediaTypeError("File content does not match its declared type");
    }

    const attachment = await getPrisma().$transaction(async (tx) => {
      // Row-locks the ticket so two concurrent uploads on the same ticket
      // cannot both observe "4 active" and both succeed past the 5-slot cap.
      const rows = await tx.$queryRaw<{ id: number; requesterId: number }[]>`
        SELECT id, "requesterId" FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE
      `;
      const ticket = rows[0];
      if (!ticket || ticket.requesterId !== requesterId) {
        throw new NotFoundError("Ticket not found");
      }

      const activeCount = await tx.attachment.count({ where: { ticketId, removedAt: null } });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS_PER_TICKET) {
        throw new ConflictError("This ticket already has the maximum of 5 active attachments");
      }

      return tx.attachment.create({
        data: {
          ticketId,
          originalFilename: file.originalname,
          storedFilename: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedById: requesterId,
        },
        select: ATTACHMENT_SELECT,
      });
    });

    return serializeAttachment(attachment);
  } catch (err) {
    await safeUnlink(filePath);
    throw err;
  }
}

export async function listAttachmentsForTicket(requesterId: number, ticketId: number) {
  await assertOwnedTicket(ticketId, requesterId);
  const attachments = await getPrisma().attachment.findMany({
    where: { ticketId },
    select: ATTACHMENT_SELECT,
    orderBy: { uploadedAt: "asc" },
  });
  return attachments.map(serializeAttachment);
}

export async function getAttachmentById(requesterId: number, attachmentId: number) {
  const attachment = await getPrisma().attachment.findFirst({
    where: { id: attachmentId, ticket: { requesterId } },
    select: ATTACHMENT_SELECT,
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  return serializeAttachment(attachment);
}

export async function resolveAttachmentForDownload(requesterId: number, attachmentId: number) {
  const attachment = await getPrisma().attachment.findFirst({
    where: { id: attachmentId, ticket: { requesterId } },
    select: { ticketId: true, storedFilename: true, originalFilename: true, mimeType: true, removedAt: true },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  // Bytes are never deleted on removal — this route is the only gate.
  if (attachment.removedAt) throw new GoneError("This attachment has been removed");

  return {
    absolutePath: attachmentAbsolutePath(attachment.ticketId, attachment.storedFilename),
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
  };
}

export async function removeAttachment(requesterId: number, attachmentId: number, reason: string) {
  const attachment = await getPrisma().attachment.findFirst({
    where: { id: attachmentId, ticket: { requesterId } },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  if (attachment.removedAt) throw new ConflictError("This attachment has already been removed");

  const updated = await getPrisma().attachment.update({
    where: { id: attachmentId },
    data: { removedAt: new Date(), removedReason: reason, removedById: requesterId },
    select: ATTACHMENT_SELECT,
  });
  return serializeAttachment(updated);
}
