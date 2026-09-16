import { request } from "./client.js";
import type { Comment } from "./types.js";

// Internal Notes share the Comment shape (id/ticketId/body/createdAt/author)
// — see server/src/services/internalNote.service.ts. IT Staff/Admin only;
// a Requester calling these gets 403 with no note content (BR-22).
export function listNotes(ticketId: number): Promise<Comment[]> {
  return request<Comment[]>(`/api/tickets/${ticketId}/notes`);
}

export function addNote(ticketId: number, body: string): Promise<Comment> {
  return request<Comment>(`/api/tickets/${ticketId}/notes`, { method: "POST", body: { body } });
}
