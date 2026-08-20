import type { TicketStatus } from "../../api/types.js";

const LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const CLASSES: Record<TicketStatus, string> = {
  NEW: "text-bg-primary",
  ASSIGNED: "text-bg-info",
  IN_PROGRESS: "text-bg-warning",
  RESOLVED: "text-bg-success",
  CLOSED: "text-bg-secondary",
  CANCELLED: "text-bg-dark",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
