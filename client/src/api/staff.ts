import { request } from "./client.js";
import type { Priority, TicketStatus } from "./types.js";

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
