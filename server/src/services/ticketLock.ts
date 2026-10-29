import type { Prisma } from "@prisma/client";

// Row lock on one Ticket for the rest of the surrounding transaction. Everything that decides something
// from a Ticket together with its Actions Taken (the resolution gate, creating or changing an action,
// cancelling a Ticket) takes this lock first, so two such requests run one after the other and each sees
// the other's committed result (specification.md decision 3, BR-14).
export async function lockTicket(tx: Prisma.TransactionClient, ticketId: number) {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
}
