import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { NotFoundError } from "../http/errors.js";

function serializeComment(c: { id: number; ticketId: number; body: string; createdAt: Date; author: { id: number; fullName: string } }) {
  return {
    id: c.id,
    ticketId: c.ticketId,
    body: c.body,
    createdAt: c.createdAt,
    author: c.author,
  };
}

// BR-04/api-spec.md: the owning Requester, IT Staff, and Administrator can
// all read/post Public Comments on a ticket — a Requester is scoped to their
// own ticket (404 if not owned, uniform with nonexistent, per Lab 2's
// ownership convention), while IT Staff/Administrator can reach any ticket.
async function ensureTicketVisible(callerId: number, role: Role, ticketId: number) {
  const ticket =
    role === "REQUESTER"
      ? await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId: callerId } })
      : await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

export async function listComments(callerId: number, role: Role, ticketId: number) {
  await ensureTicketVisible(callerId, role, ticketId);

  const comments = await getPrisma().comment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return comments.map(serializeComment);
}

export async function addComment(callerId: number, role: Role, ticketId: number, body: string) {
  await ensureTicketVisible(callerId, role, ticketId);

  const comment = await getPrisma().comment.create({
    data: { ticketId, authorId: callerId, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return serializeComment(comment);
}
