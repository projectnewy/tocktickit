import { request } from "./client.js";
import type { Priority, TicketDetail, TicketStatus } from "./types.js";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

export function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  return request<TicketDetail>("/api/tickets", { method: "POST", body: input });
}

export function getTicket(ticketId: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${ticketId}`);
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: Priority;
  status: TicketStatus;
  activeAttachmentCount: number;
}

export interface TicketListResponse {
  items: TicketSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  sort: string;
}

export interface TicketListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: string[];
  sort?: string;
}

export function listTickets(query: TicketListQuery = {}): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.q) params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.sort) params.set("sort", query.sort);
  for (const s of query.status ?? []) params.append("status", s);
  for (const p of query.requestedPriority ?? []) params.append("requestedPriority", p);
  const qs = params.toString();
  return request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ""}`);
}
