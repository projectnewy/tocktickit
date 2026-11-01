import type { TicketStatus } from "../../api/types.js";
import { statusLabel } from "../../config/labels.js";

const CLASSES: Record<TicketStatus, string> = {
  NEW: "text-bg-primary",
  OPEN: "text-bg-info",
  IN_PROGRESS: "text-bg-warning",
  WAITING_FOR_REQUESTER: "text-bg-warning",
  RESOLVED: "text-bg-success",
  CLOSED: "text-bg-secondary",
  REOPENED: "text-bg-info",
  CANCELLED: "text-bg-dark",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge ${CLASSES[status]}`}>{statusLabel(status)}</span>;
}
