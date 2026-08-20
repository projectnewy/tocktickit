import type { Priority } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { nextTicketNumber } from "../../src/services/ticketNumber.js";

let counter = 0;
function unique(label: string) {
  counter += 1;
  return `${label}-${counter}-${Date.now()}`;
}

export async function makeRequester(overrides: Partial<{ fullName: string; email: string; department: string | null; isActive: boolean }> = {}) {
  const prisma = getPrisma();
  return prisma.requesterUser.create({
    data: {
      fullName: overrides.fullName ?? "Test Requester",
      email: overrides.email ?? `${unique("requester")}@example.com`,
      department: overrides.department ?? "QA",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function makeTicket(overrides: {
  requesterId: number;
  categoryId?: number;
  relatedSystemId?: number;
  summary?: string;
  description?: string;
  requestedPriority?: Priority;
}) {
  const prisma = getPrisma();

  let categoryId = overrides.categoryId;
  if (!categoryId) {
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = category.id;
  }

  let relatedSystemId = overrides.relatedSystemId;
  if (!relatedSystemId) {
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    relatedSystemId = relatedSystem.id;
  }

  return prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx);
    return tx.ticket.create({
      data: {
        ticketNumber,
        summary: overrides.summary ?? unique("Test ticket summary"),
        description: overrides.description ?? "Test ticket description with enough length.",
        requestedPriority: overrides.requestedPriority ?? "MEDIUM",
        requesterId: overrides.requesterId,
        categoryId,
        relatedSystemId,
      },
    });
  });
}

export async function makeAttachment(overrides: {
  ticketId: number;
  uploadedById: number;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  const prisma = getPrisma();
  return prisma.attachment.create({
    data: {
      ticketId: overrides.ticketId,
      uploadedById: overrides.uploadedById,
      originalFilename: overrides.originalFilename ?? "test-file.png",
      storedFilename: `${unique("stored")}.png`,
      mimeType: overrides.mimeType ?? "image/png",
      sizeBytes: overrides.sizeBytes ?? 1024,
    },
  });
}
