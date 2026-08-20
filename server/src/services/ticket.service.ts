import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { nextTicketNumber } from "./ticketNumber.js";
import { BadRequestError, NotFoundError } from "../http/errors.js";
import type { CreateTicketInput, TicketQuery } from "../validation/ticket.schemas.js";

const TICKET_DETAIL_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  status: true,
  createdAt: true,
  requester: { select: { id: true, fullName: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    select: {
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
    },
    orderBy: { uploadedAt: "asc" as const },
  },
} satisfies Prisma.TicketSelect;

type TicketDetailRow = Prisma.TicketGetPayload<{ select: typeof TICKET_DETAIL_SELECT }>;

function serializeAttachment(a: TicketDetailRow["attachments"][number]) {
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

function serializeTicket(t: TicketDetailRow) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    summary: t.summary,
    description: t.description,
    requestedPriority: t.requestedPriority,
    itPriority: t.itPriority,
    status: t.status,
    ticketDate: t.createdAt,
    requester: t.requester,
    category: t.category,
    relatedSystem: t.relatedSystem,
    // No IT Staff model exists yet in Lab 2 — see specification.md §11.
    ticketOwner: null as { id: number; fullName: string } | null,
    attachments: t.attachments.map(serializeAttachment),
  };
}

const MAX_TICKET_NUMBER_RETRIES = 3;

export async function createTicket(requesterId: number, input: CreateTicketInput) {
  const prisma = getPrisma();
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirst({ where: { id: input.categoryId, isActive: true } }),
    prisma.relatedSystem.findFirst({ where: { id: input.relatedSystemId, isActive: true } }),
  ]);
  if (!category) throw new BadRequestError("Unknown or inactive category");
  if (!relatedSystem) throw new BadRequestError("Unknown or inactive related system");

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TICKET_NUMBER_RETRIES; attempt++) {
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const ticketNumber = await nextTicketNumber(tx);
        return tx.ticket.create({
          data: {
            ticketNumber,
            summary: input.summary,
            description: input.description,
            requestedPriority: input.requestedPriority,
            requesterId,
            categoryId: input.categoryId,
            relatedSystemId: input.relatedSystemId,
          },
          select: TICKET_DETAIL_SELECT,
        });
      });
      return serializeTicket(ticket);
    } catch (err) {
      lastError = err;
      // P2002 on ticketNumber is the only case worth retrying (see
      // specification.md §7 — the counter table makes this vanishingly rare,
      // this is a backstop, not the primary correctness mechanism).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw lastError;
}

const SORT_MAP: Record<string, Prisma.TicketOrderByWithRelationInput> = {
  "createdAt:desc": { createdAt: "desc" },
  "createdAt:asc": { createdAt: "asc" },
  "ticketNumber:asc": { ticketNumber: "asc" },
  "ticketNumber:desc": { ticketNumber: "desc" },
  "requestedPriority:desc": { requestedPriority: "desc" },
  "requestedPriority:asc": { requestedPriority: "asc" },
  "summary:asc": { summary: "asc" },
  "summary:desc": { summary: "desc" },
};

function endOfDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function listTickets(requesterId: number, query: TicketQuery) {
  const prisma = getPrisma();

  const where: Prisma.TicketWhereInput = {
    requesterId,
    ...(query.status?.length ? { status: { in: query.status } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.relatedSystemId ? { relatedSystemId: query.relatedSystemId } : {}),
    ...(query.requestedPriority?.length ? { requestedPriority: { in: query.requestedPriority } } : {}),
    ...(query.q
      ? {
          OR: [
            { ticketNumber: { contains: query.q, mode: "insensitive" as const } },
            { summary: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: endOfDay(query.dateTo) } : {}),
          },
        }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy: SORT_MAP[query.sort],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        ticketNumber: true,
        createdAt: true,
        summary: true,
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requestedPriority: true,
        status: true,
        _count: { select: { attachments: { where: { removedAt: null } } } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: items.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      ticketDate: t.createdAt,
      summary: t.summary,
      category: t.category,
      relatedSystem: t.relatedSystem,
      requestedPriority: t.requestedPriority,
      status: t.status,
      activeAttachmentCount: t._count.attachments,
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: query.page > 1,
    hasNextPage: query.page < totalPages,
    sort: query.sort,
  };
}

export async function getTicketById(requesterId: number, ticketId: number) {
  const ticket = await getPrisma().ticket.findFirst({
    where: { id: ticketId, requesterId },
    select: TICKET_DETAIL_SELECT,
  });
  // Same response whether the id doesn't exist or belongs to a different
  // requester — see specification.md §11 on why 404 rather than 403.
  if (!ticket) throw new NotFoundError("Ticket not found");
  return serializeTicket(ticket);
}
