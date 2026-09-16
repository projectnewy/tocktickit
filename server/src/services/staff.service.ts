import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import type { StaffTicketQuery } from "../validation/staff.schemas.js";

const SORT_MAP: Record<string, Prisma.TicketOrderByWithRelationInput> = {
  "createdAt:desc": { createdAt: "desc" },
  "createdAt:asc": { createdAt: "asc" },
  "itPriority:desc": { itPriority: "desc" },
  "itPriority:asc": { itPriority: "asc" },
  "status:asc": { status: "asc" },
  "status:desc": { status: "desc" },
  "ticketNumber:asc": { ticketNumber: "asc" },
  "ticketNumber:desc": { ticketNumber: "desc" },
};

// FR-08/§6.3: the shared Ticket Queue — every Ticket regardless of owner,
// scoped only by the query filters (not by caller identity the way Requester
// listTickets() is). callerId resolves the "me" owner-filter token.
export async function listQueueTickets(callerId: number, query: StaffTicketQuery) {
  const prisma = getPrisma();

  let ownerFilter: Prisma.TicketWhereInput["ownerId"];
  if (query.ownerId === "me") ownerFilter = callerId;
  else if (query.ownerId === "unassigned") ownerFilter = null;
  else if (typeof query.ownerId === "number") ownerFilter = query.ownerId;

  const where: Prisma.TicketWhereInput = {
    ...(query.status?.length ? { status: { in: query.status } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.ownerId !== undefined ? { ownerId: ownerFilter } : {}),
    ...(query.q
      ? {
          OR: [
            { ticketNumber: { contains: query.q, mode: "insensitive" as const } },
            { summary: { contains: query.q, mode: "insensitive" as const } },
            { requester: { fullName: { contains: query.q, mode: "insensitive" as const } } },
          ],
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
        updatedAt: true,
        summary: true,
        category: { select: { id: true, name: true } },
        requestedPriority: true,
        itPriority: true,
        status: true,
        requester: { select: { id: true, fullName: true } },
        owner: { select: { id: true, fullName: true } },
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
      lastUpdated: t.updatedAt,
      summary: t.summary,
      category: t.category,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      status: t.status,
      requester: t.requester,
      owner: t.owner,
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
