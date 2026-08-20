import { request } from "./client.js";
import type { Priority, TicketDetail } from "./types.js";

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
