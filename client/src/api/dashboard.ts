import { request } from "./client.js";
import type { Priority, TicketStatus } from "./types.js";

// docs/lab-04/api-spec.md "GET /api/dashboard/requester": counts and short lists, never whole collections.
export interface DashboardTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  status: TicketStatus;
  itPriority: Priority | null;
  updatedAt: string;
}

export interface RequesterDashboard {
  timeZone: string;
  windowStart: string;
  openTickets: { count: number; link: string };
  waitingForRequester: { count: number; link: string };
  recentlyUpdated: { items: DashboardTicket[]; link: string };
  recentlyResolved: { items: DashboardTicket[]; link: string };
}

export function getRequesterDashboard(): Promise<RequesterDashboard> {
  return request<RequesterDashboard>("/api/dashboard/requester");
}
