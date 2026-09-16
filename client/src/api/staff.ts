import { request } from "./client.js";
import type { Priority, TicketDetail, TicketStatus } from "./types.js";

export interface StaffTicketSummary {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  lastUpdated: string;
  summary: string;
  category: { id: number; name: string };
  requestedPriority: Priority;
  itPriority: Priority | null;
  status: TicketStatus;
  requester: { id: number; fullName: string };
  owner: { id: number; fullName: string } | null;
}

export interface StaffTicketListResponse {
  items: StaffTicketSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  sort: string;
}

export type OwnerFilter = "me" | "unassigned" | number;

export interface StaffTicketListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  categoryId?: number;
  ownerId?: OwnerFilter;
  sort?: string;
}

export function listStaffTickets(query: StaffTicketListQuery = {}): Promise<StaffTicketListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.q) params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", String(query.categoryId));
  if (query.ownerId !== undefined) params.set("ownerId", String(query.ownerId));
  if (query.sort) params.set("sort", query.sort);
  for (const s of query.status ?? []) params.append("status", s);
  const qs = params.toString();
  return request<StaffTicketListResponse>(`/api/staff/tickets${qs ? `?${qs}` : ""}`);
}

// FR-09..FR-12: IT Staff/Admin Ticket Detail operations. The detail shape is
// the same TicketDetail as the Requester's own getTicket() — see
// server/src/services/ticket.service.ts's shared TICKET_DETAIL_SELECT.
export function getStaffTicket(ticketId: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/staff/tickets/${ticketId}`);
}

// Omitting targetUserId claims for the caller themself (also used to
// "reassign to me" — see specification.md §12).
export function claimTicket(ticketId: number, targetUserId?: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/staff/tickets/${ticketId}/claim`, {
    method: "PATCH",
    body: targetUserId ? { targetUserId } : {},
  });
}

export function setTicketPriority(ticketId: number, itPriority: Priority): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/staff/tickets/${ticketId}/priority`, { method: "PATCH", body: { itPriority } });
}

export function setTicketStatus(ticketId: number, status: TicketStatus): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/staff/tickets/${ticketId}/status`, { method: "PATCH", body: { status } });
}
