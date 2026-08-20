import { request } from "./client.js";
import type { AttachmentMeta } from "./types.js";

export function uploadAttachment(ticketId: number, file: File): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  return request<AttachmentMeta>(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: formData });
}
