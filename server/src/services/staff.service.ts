import { Prisma, type Priority, type TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../http/errors.js";
import { TICKET_DETAIL_SELECT, serializeTicket } from "./ticket.service.js";
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

// ui-spec.md §4: populates the "Reassign" dropdown — every active IT
// Staff/Administrator is a legal Ticket owner per BR-15, so this is the
// complete assignee pool, not scoped to the caller.
export async function listAssignableStaff() {
  return getPrisma().user.findMany({
    where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
}

// FR-09: IT Staff/Admin can open any ticket, regardless of owner — same
// detail shape as the Requester's own ticket.service.ts getTicketById, minus
// the requesterId ownership predicate.
export async function getTicketDetail(ticketId: number) {
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: TICKET_DETAIL_SELECT });
  if (!ticket) throw new NotFoundError("Ticket not found");
  return serializeTicket(ticket);
}

// §6: New -> Open happens implicitly whenever a ticket is claimed from
// unassigned — this is the only place the transition matrix is touched
// outside setStatus(), per specification.md §6's "(implicit on claim)" note.
export async function claimTicket(ticketId: number, callerId: number, targetUserId?: number) {
  const ownerId = targetUserId ?? callerId;

  const [existing, owner] = await Promise.all([
    getPrisma().ticket.findUnique({ where: { id: ticketId } }),
    getPrisma().user.findFirst({ where: { id: ownerId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } } }),
  ]);
  if (!existing) throw new NotFoundError("Ticket not found");
  if (!owner) throw new BadRequestError("Target user must be an active IT Staff or Administrator");

  const ticket = await getPrisma().ticket.update({
    where: { id: ticketId },
    data: { ownerId, ...(existing.status === "NEW" ? { status: "OPEN" as TicketStatus } : {}) },
    select: TICKET_DETAIL_SELECT,
  });
  return serializeTicket(ticket);
}

// FR-11/BR-16: itPriority is independent of requestedPriority and only
// changeable by IT Staff/Admin, after ticket creation.
export async function setPriority(ticketId: number, itPriority: Priority) {
  const existing = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new NotFoundError("Ticket not found");

  const ticket = await getPrisma().ticket.update({
    where: { id: ticketId },
    data: { itPriority },
    select: TICKET_DETAIL_SELECT,
  });
  return serializeTicket(ticket);
}

// specification.md §6 — declared as "from status -> allowed next statuses";
// any pair not listed here is rejected with 409 (BR-17/AC-07). Exported for
// UNIT-01 (tests.md) — a direct table test, independent of the DB-backed
// setStatus() below.
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS"],
  CANCELLED: [],
};

export async function setStatus(ticketId: number, status: TicketStatus) {
  const existing = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new NotFoundError("Ticket not found");

  const allowed = STATUS_TRANSITIONS[existing.status];
  if (!allowed.includes(status)) {
    throw new ConflictError(`Cannot transition from ${existing.status} to ${status}`);
  }

  const ticket = await getPrisma().ticket.update({
    where: { id: ticketId },
    data: { status },
    select: TICKET_DETAIL_SELECT,
  });
  return serializeTicket(ticket);
}
