import { request, requestBlob } from "./client.js";
import type { AttachmentMeta } from "./types.js";

export function uploadAttachment(ticketId: number, file: File): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  return request<AttachmentMeta>(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: formData });
}

export function removeAttachment(attachmentId: number, reason: string): Promise<AttachmentMeta> {
  return request<AttachmentMeta>(`/api/attachments/${attachmentId}`, { method: "DELETE", body: { reason } });
}

export async function downloadAttachment(attachmentId: number, filename: string): Promise<void> {
  const blob = await requestBlob(`/api/attachments/${attachmentId}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
