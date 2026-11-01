import type { Priority, Role, TicketStatus } from "../api/types.js";

// Single source of truth for how Status, Priority, and Role are shown to
// people. Option `value`s stay the raw enum (that is what the API takes); only
// visible text goes through these helpers, so no screen ever shows
// IN_PROGRESS or IT_STAFF (docs/lab-04/ui-spec.md §6).
export const STATUS_VALUES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export const PRIORITY_VALUES: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const ROLE_VALUES: readonly Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

// Fallback for a value the client does not know yet (e.g. a newer server): a
// readable "Some Value" rather than "SOME_VALUE".
function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function statusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? humanize(status);
}

export function priorityLabel(priority: string): string {
  return (PRIORITY_LABELS as Record<string, string>)[priority] ?? humanize(priority);
}

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? humanize(role);
}
