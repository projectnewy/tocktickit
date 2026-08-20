export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  fullName: string;
  email: string;
  department: string | null;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";

export interface AttachmentMeta {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: { id: number; fullName: string };
  isRemoved: boolean;
  removedAt: string | null;
  removedReason: string | null;
  removedBy: { id: number; fullName: string } | null;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  status: TicketStatus;
  ticketDate: string;
  requester: { id: number; fullName: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  ticketOwner: { id: number; fullName: string } | null;
  attachments: AttachmentMeta[];
}
