import type { Prisma, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { DASHBOARD_TIME_ZONE, bangkokWindowStart } from "./dashboardWindow.js";

// BR-24: the statuses that count as open work.
export const ACTIVE_STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

const MAX_LIST_ITEMS = 5; // BR-22: short lists, never whole collections

const ITEM_SELECT = { id: true, ticketNumber: true, summary: true, status: true, itPriority: true, updatedAt: true } satisfies Prisma.TicketSelect;

const statusQuery = (statuses: TicketStatus[]) => statuses.map((status) => `status=${status}`).join("&");

// api-spec.md "GET /api/dashboard/requester". Every number is computed here, from the database, in one
// transaction, for the signed-in Requester's own Tickets only (BR-25) — the id comes from the session,
// never from the request, so another Requester's data cannot be asked for.
export async function getRequesterDashboard(requesterId: number, now: Date = new Date()) {
  const prisma = getPrisma();
  const windowStart = bangkokWindowStart(now);
  const mine: Prisma.TicketWhereInput = { requesterId };

  const [openTickets, waitingForRequester, recentlyUpdated, recentlyResolved] = await prisma.$transaction([
    prisma.ticket.count({ where: { ...mine, status: { in: ACTIVE_STATUSES } } }),
    prisma.ticket.count({ where: { ...mine, status: "WAITING_FOR_REQUESTER" } }),
    prisma.ticket.findMany({
      where: { ...mine, updatedAt: { gte: windowStart } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_LIST_ITEMS,
      select: ITEM_SELECT,
    }),
    prisma.ticket.findMany({
      where: { ...mine, resolvedAt: { gte: windowStart } },
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
      take: MAX_LIST_ITEMS,
      select: ITEM_SELECT,
    }),
  ]);

  return {
    timeZone: DASHBOARD_TIME_ZONE,
    windowStart: windowStart.toISOString(),
    // BR-29: each count's link opens My Tickets with exactly the filter the count was computed from.
    openTickets: { count: openTickets, link: `/tickets?${statusQuery(ACTIVE_STATUSES)}` },
    waitingForRequester: { count: waitingForRequester, link: "/tickets?status=WAITING_FOR_REQUESTER" },
    recentlyUpdated: { items: recentlyUpdated, link: "/tickets?sort=updatedAt:desc" },
    recentlyResolved: { items: recentlyResolved, link: "/tickets?status=RESOLVED&status=CLOSED&sort=updatedAt:desc" },
  };
}
