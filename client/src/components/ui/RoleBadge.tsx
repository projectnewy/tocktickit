import type { Role } from "../../api/types.js";

const LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

const CLASSES: Record<Role, string> = {
  REQUESTER: "text-bg-secondary",
  IT_STAFF: "text-bg-info",
  ADMINISTRATOR: "text-bg-dark",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${CLASSES[role]}`}>{LABELS[role]}</span>;
}
