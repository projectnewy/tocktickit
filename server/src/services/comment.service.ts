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

// Requester-scoped: only the owning Requester may read/post Public Comments
// through these functions. IT Staff/Administrator access the same Comments
// (any ticket, not just owned ones) through the staff routes added in
// Issue #35 — kept as a separate entry point rather than an `isStaff` flag
// here, since the staff side also needs to see Internal Notes in the same
// call and has a different ownership check entirely.
export async function listCommentsForRequester(requesterId: number, ticketId: number) {
  const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId } });
  if (!ticket) throw new NotFoundError("Ticket not found");

  const comments = await getPrisma().comment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return comments.map(serializeComment);
}

export async function addCommentAsRequester(requesterId: number, ticketId: number, body: string) {
  const ticket = await getPrisma().ticket.findFirst({ where: { id: ticketId, requesterId } });
  if (!ticket) throw new NotFoundError("Ticket not found");

  const comment = await getPrisma().comment.create({
    data: { ticketId, authorId: requesterId, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return serializeComment(comment);
}
