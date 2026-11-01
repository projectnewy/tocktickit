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

// docs/lab-04/api-spec.md "GET /api/dashboard/staff".
export interface StaffDashboardTicket extends DashboardTicket {
  owner: { id: number; fullName: string } | null;
}

export interface StaffDashboard {
  timeZone: string;
  windowStart: string;
  unassigned: { count: number; link: string };
  ownedByMe: { count: number; link: string };
  byStatus: { status: TicketStatus; count: number; link: string }[];
  byItPriority: { itPriority: Priority; count: number; link: string }[];
  urgentTickets: { items: StaffDashboardTicket[]; link: string };
  recentlyUpdated: { items: StaffDashboardTicket[]; link: string };
  myPlannedActions: {
    count: number;
    items: { id: number; ticketId: number; ticketNumber: string; description: string; actionDateTime: string }[];
  };
  // Present only for an Administrator.
  userCounts?: { REQUESTER: number; IT_STAFF: number; ADMINISTRATOR: number; inactive: number };
}

export function getStaffDashboard(): Promise<StaffDashboard> {
  return request<StaffDashboard>("/api/dashboard/staff");
}
