import type { TicketStatus } from "../../api/types.js";

const LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

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
  return <span className={`badge ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
