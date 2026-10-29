import { Prisma, type Priority, type TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, BadRequestError, NotFoundError } from "../http/errors.js";
import { lockTicket } from "./ticketLock.js";
import { evaluateResolutionGate } from "./resolutionGate.js";
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

// BR-19: every workflow write on a Ticket runs in one transaction with the Ticket row locked, compares
// the `version` the client last read with the stored one, and bumps it. A mismatch is a safe 409 that
// tells the client the current version, never a silent overwrite.
function staleVersion(currentVersion: number): never {
  throw new AppError(409, "This ticket was changed by someone else", "STALE_VERSION", { currentVersion });
}

async function loadForWrite(tx: Prisma.TransactionClient, ticketId: number, version: number) {
  await lockTicket(tx, ticketId);
  const existing = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw new NotFoundError("Ticket not found");
  if (existing.version !== version) staleVersion(existing.version);
  return existing;
}

// §5.3: New -> Open happens implicitly whenever a ticket is claimed from unassigned — this is the only
// place the transition matrix is touched outside setStatus().
export async function claimTicket(ticketId: number, callerId: number, version: number, targetUserId?: number) {
  const ownerId = targetUserId ?? callerId;

  return getPrisma().$transaction(async (tx) => {
    const existing = await loadForWrite(tx, ticketId, version);
    const owner = await tx.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } } });
    if (!owner) throw new BadRequestError("Target user must be an active IT Staff or Administrator");

    const ticket = await tx.ticket.update({
      where: { id: ticketId },
      data: { ownerId, version: { increment: 1 }, ...(existing.status === "NEW" ? { status: "OPEN" as TicketStatus } : {}) },
      select: TICKET_DETAIL_SELECT,
    });
    return serializeTicket(ticket);
  });
}

// FR-11/BR-16: itPriority is independent of requestedPriority and only changeable by IT Staff/Admin.
export async function setPriority(ticketId: number, version: number, itPriority: Priority) {
  return getPrisma().$transaction(async (tx) => {
    await loadForWrite(tx, ticketId, version);
    const ticket = await tx.ticket.update({
      where: { id: ticketId },
      data: { itPriority, version: { increment: 1 } },
      select: TICKET_DETAIL_SELECT,
    });
    return serializeTicket(ticket);
  });
}

// specification.md §5.3 — declared as "from status -> allowed next statuses"; any pair not listed here is
// rejected with 409 INVALID_TRANSITION (BR-13). Exported for UNIT-04 (tests.md) — a direct table test,
// independent of the DB-backed setStatus() below.
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

export async function setStatus(ticketId: number, version: number, status: TicketStatus) {
  return getPrisma().$transaction(async (tx) => {
    const existing = await loadForWrite(tx, ticketId, version);

    if (!STATUS_TRANSITIONS[existing.status].includes(status)) {
      throw new AppError(409, `Cannot transition from ${existing.status} to ${status}`, "INVALID_TRANSITION");
    }

    const data: Prisma.TicketUpdateInput = { status, version: { increment: 1 } };

    if (status === "RESOLVED") {
      // BR-14: evaluated here, inside the transaction that holds the Ticket lock, so no action can be
      // added or completed between this check and the status write.
      const [completed, planned] = await Promise.all([
        tx.actionTaken.count({ where: { ticketId, status: "COMPLETED" } }),
        tx.actionTaken.count({ where: { ticketId, status: "PLANNED" } }),
      ]);
      const unmet = evaluateResolutionGate({ completed, planned });
      if (unmet.length > 0) {
        throw new AppError(409, "This ticket cannot be resolved yet", "RESOLUTION_GATE", { unmet });
      }
      data.resolvedAt = new Date(); // BR-18: kept through Closed
    }

    if (status === "REOPENED") {
      data.resolvedAt = null; // BR-17/BR-18
      data.resolutionIndicated = false;
    }

    if (status === "CANCELLED") {
      // BR-16: cancelling a Ticket cancels its Planned actions in the same transaction.
      await tx.actionTaken.updateMany({
        where: { ticketId, status: "PLANNED" },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
    }

    const ticket = await tx.ticket.update({ where: { id: ticketId }, data, select: TICKET_DETAIL_SELECT });
    return serializeTicket(ticket);
  });
}
