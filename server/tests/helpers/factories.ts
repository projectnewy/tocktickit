import type { Priority, Role } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { nextTicketNumber } from "../../src/services/ticketNumber.js";
import { hashPassword } from "../../src/auth/password.js";

let counter = 0;
function unique(label: string) {
  counter += 1;
  return `${label}-${counter}-${Date.now()}`;
}

// Shared across every factory-created user in tests — never a real secret.
export const TEST_PASSWORD = "Password123!";
let testPasswordHash: string | null = null;
async function getTestPasswordHash() {
  testPasswordHash ??= await hashPassword(TEST_PASSWORD);
  return testPasswordHash;
}

export async function makeUser(
  overrides: Partial<{
    fullName: string;
    email: string;
    department: string | null;
    isActive: boolean;
    role: Role;
    mustChangePassword: boolean;
  }> = {}
) {
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      fullName: overrides.fullName ?? "Test User",
      email: overrides.email ?? `${unique("user")}@example.com`,
      department: overrides.department ?? "QA",
      isActive: overrides.isActive ?? true,
      role: overrides.role ?? "REQUESTER",
      mustChangePassword: overrides.mustChangePassword ?? false,
      passwordHash: await getTestPasswordHash(),
    },
  });
}

// Back-compat alias — Lab 2 tests call makeRequester(); keep it as a thin
// wrapper over makeUser() rather than rewriting every existing call site.
export async function makeRequester(overrides: Partial<{ fullName: string; email: string; department: string | null; isActive: boolean }> = {}) {
  return makeUser({ ...overrides, role: "REQUESTER" });
}

export async function makeItStaff(overrides: Partial<{ fullName: string; email: string; isActive: boolean }> = {}) {
  return makeUser({ ...overrides, role: "IT_STAFF" });
}

export async function makeAdministrator(overrides: Partial<{ fullName: string; email: string; isActive: boolean }> = {}) {
  return makeUser({ ...overrides, role: "ADMINISTRATOR" });
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

export async function makeComment(overrides: { ticketId: number; authorId: number; body?: string }) {
  const prisma = getPrisma();
  return prisma.comment.create({
    data: {
      ticketId: overrides.ticketId,
      authorId: overrides.authorId,
      body: overrides.body ?? unique("Test public comment"),
    },
  });
}

export async function makeInternalNote(overrides: { ticketId: number; authorId: number; body?: string }) {
  const prisma = getPrisma();
  return prisma.internalNote.create({
    data: {
      ticketId: overrides.ticketId,
      authorId: overrides.authorId,
      body: overrides.body ?? unique("Test internal note"),
    },
  });
}
