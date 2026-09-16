import { getPrisma } from "../prisma.js";
import { NotFoundError } from "../http/errors.js";

// FR-13/BR-04: staff-only. The 403-for-Requester check (BR-22) happens in
// the route before these are ever called — these two only need to confirm
// the ticket exists (404, no ownership concept for IT Staff/Administrator).
function serializeNote(n: { id: number; ticketId: number; body: string; createdAt: Date; author: { id: number; fullName: string } }) {
  return {
    id: n.id,
    ticketId: n.ticketId,
    body: n.body,
    createdAt: n.createdAt,
    author: n.author,
  };
}

async function ensureTicketExists(ticketId: number) {
  const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket not found");
}

export async function listNotes(ticketId: number) {
  await ensureTicketExists(ticketId);

  const notes = await getPrisma().internalNote.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return notes.map(serializeNote);
}

export async function addNote(authorId: number, ticketId: number, body: string) {
  await ensureTicketExists(ticketId);

  const note = await getPrisma().internalNote.create({
    data: { ticketId, authorId, body },
    select: { id: true, ticketId: true, body: true, createdAt: true, author: { select: { id: true, fullName: true } } },
  });
  return serializeNote(note);
}
