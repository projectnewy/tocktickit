import type { Role } from "../../api/types.js";
import { roleLabel } from "../../config/labels.js";

const CLASSES: Record<Role, string> = {
  REQUESTER: "text-bg-secondary",
  IT_STAFF: "text-bg-info",
  ADMINISTRATOR: "text-bg-dark",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${CLASSES[role]}`}>{roleLabel(role)}</span>;
}
