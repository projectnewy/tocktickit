import type { Priority } from "../../api/types.js";

const CLASSES: Record<Priority, string> = {
  LOW: "text-bg-secondary",
  MEDIUM: "text-bg-info",
  HIGH: "text-bg-warning",
  URGENT: "text-bg-danger",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${CLASSES[priority]}`}>{priority}</span>;
}
