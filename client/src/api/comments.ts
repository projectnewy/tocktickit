import { request } from "./client.js";
import type { Comment, TicketDetail } from "./types.js";

export function listComments(ticketId: number): Promise<Comment[]> {
  return request<Comment[]>(`/api/tickets/${ticketId}/comments`);
}

export function addComment(ticketId: number, body: string): Promise<Comment> {
  return request<Comment>(`/api/tickets/${ticketId}/comments`, { method: "POST", body: { body } });
}

export function indicateResolution(ticketId: number): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${ticketId}/resolution-indication`, { method: "POST" });
}
