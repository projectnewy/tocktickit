import type { TicketStatus } from "../api/types.js";

// Mirrors server/src/services/staff.service.ts's STATUS_TRANSITIONS
// (specification.md §6) — used only to populate the Status dropdown with
// valid next states; the server remains the authoritative enforcement
// (BR-17/AC-07), this is UI convenience only.
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS"],
  CANCELLED: [],
};
