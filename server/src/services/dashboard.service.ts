import type { Prisma, Priority, TicketStatus } from "@prisma/client";
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

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STAFF_ITEM_SELECT = {
  ...ITEM_SELECT,
  owner: { select: { id: true, fullName: true } },
} satisfies Prisma.TicketSelect;

// api-spec.md "GET /api/dashboard/staff". Open-work metrics use only active statuses (BR-24); every list
// is capped at 5 (BR-22); `byStatus` and `byItPriority` always list every row, zeros included, so an
// empty state is explicit. Each `link` is an app route whose list total equals the count (BR-29).
export async function getStaffDashboard(userId: number, includeUserCounts: boolean, now: Date = new Date()) {
  const prisma = getPrisma();
  const windowStart = bangkokWindowStart(now);
  const active = { status: { in: ACTIVE_STATUSES } } satisfies Prisma.TicketWhereInput;
  const activeQuery = statusQuery(ACTIVE_STATUSES);

  const [unassigned, ownedByMe, urgent, recentlyUpdated, plannedCount, plannedItems, ...rowCounts] = await prisma.$transaction([
    prisma.ticket.count({ where: { ...active, ownerId: null } }),
    prisma.ticket.count({ where: { ...active, ownerId: userId } }),
    prisma.ticket.findMany({
      where: { ...active, itPriority: "URGENT" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_LIST_ITEMS,
      select: STAFF_ITEM_SELECT,
    }),
    prisma.ticket.findMany({
      where: { updatedAt: { gte: windowStart } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_LIST_ITEMS,
      select: STAFF_ITEM_SELECT,
    }),
    prisma.actionTaken.count({ where: { assigneeId: userId, status: "PLANNED" } }),
    prisma.actionTaken.findMany({
      where: { assigneeId: userId, status: "PLANNED" },
      orderBy: [{ actionDateTime: "asc" }, { id: "asc" }],
      take: MAX_LIST_ITEMS,
      select: { id: true, ticketId: true, description: true, actionDateTime: true, ticket: { select: { ticketNumber: true } } },
    }),
    ...ACTIVE_STATUSES.map((status) => prisma.ticket.count({ where: { status } })),
    ...PRIORITIES.map((itPriority) => prisma.ticket.count({ where: { ...active, itPriority } })),
  ]);

  const statusCounts = rowCounts.slice(0, ACTIVE_STATUSES.length) as number[];
  const priorityCounts = rowCounts.slice(ACTIVE_STATUSES.length) as number[];

  const result = {
    timeZone: DASHBOARD_TIME_ZONE,
    windowStart: windowStart.toISOString(),
    unassigned: { count: unassigned, link: `/staff/tickets?ownerId=unassigned&${activeQuery}` },
    ownedByMe: { count: ownedByMe, link: `/staff/tickets?ownerId=me&${activeQuery}` },
    byStatus: ACTIVE_STATUSES.map((status, i) => ({ status, count: statusCounts[i], link: `/staff/tickets?status=${status}` })),
    byItPriority: PRIORITIES.map((itPriority, i) => ({
      itPriority,
      count: priorityCounts[i],
      link: `/staff/tickets?itPriority=${itPriority}&${activeQuery}`,
    })),
    urgentTickets: { items: urgent, link: `/staff/tickets?itPriority=URGENT&${activeQuery}` },
    recentlyUpdated: { items: recentlyUpdated, link: "/staff/tickets?sort=updatedAt:desc" },
    myPlannedActions: {
      count: plannedCount,
      items: plannedItems.map((a) => ({
        id: a.id,
        ticketId: a.ticketId,
        ticketNumber: a.ticket.ticketNumber,
        description: a.description,
        actionDateTime: a.actionDateTime,
      })),
    },
  };

  // BR-27: only an Administrator sees the account counts.
  if (!includeUserCounts) return result;
  const [requesters, itStaff, administrators, inactive] = await prisma.$transaction([
    prisma.user.count({ where: { isActive: true, role: "REQUESTER" } }),
    prisma.user.count({ where: { isActive: true, role: "IT_STAFF" } }),
    prisma.user.count({ where: { isActive: true, role: "ADMINISTRATOR" } }),
    prisma.user.count({ where: { isActive: false } }),
  ]);
  return { ...result, userCounts: { REQUESTER: requesters, IT_STAFF: itStaff, ADMINISTRATOR: administrators, inactive } };
}
