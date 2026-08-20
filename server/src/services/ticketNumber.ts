import type { Prisma, PrismaClient } from "@prisma/client";

// Ticket numbers look like TKT-2026-000042: 6-digit, zero-padded, resetting each year.
// Pinned to Asia/Bangkok so a Dec-31 demo doesn't roll over to the wrong year on a
// server running in a different timezone.
const TICKET_NUMBER_TIMEZONE = "Asia/Bangkok";
const MAX_RETRIES = 3;

function currentYear(): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TICKET_NUMBER_TIMEZONE, year: "numeric" })
    .formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  return Number(year);
}

function formatTicketNumber(year: number, sequence: number): string {
  return `TKT-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Must be called inside the same transaction as the Ticket insert. The
 * `ON CONFLICT ... DO UPDATE` row-locks the TicketCounter row for `year`, so a second
 * concurrent transaction requesting the same year blocks until the first commits —
 * two tickets can never receive the same number. `Ticket.ticketNumber` is additionally
 * `@unique` as a database-enforced backstop.
 */
export async function nextTicketNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  year: number = currentYear()
): Promise<string> {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "TicketCounter" (year, "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET "lastNumber" = "TicketCounter"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  return formatTicketNumber(year, rows[0].lastNumber);
}

export { MAX_RETRIES, formatTicketNumber, currentYear };
