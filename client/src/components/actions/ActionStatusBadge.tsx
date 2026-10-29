import type { ActionStatus } from "../../api/actions.js";

const LABELS: Record<ActionStatus, string> = { PLANNED: "Planned", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const CLASSES: Record<ActionStatus, string> = { PLANNED: "text-bg-info", COMPLETED: "text-bg-success", CANCELLED: "text-bg-secondary" };

// Friendly text is always rendered, so the status is never conveyed by colour alone.
export function actionStatusLabel(status: string): string {
  return (LABELS as Record<string, string>)[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <span className={`badge ${CLASSES[status]}`}>{actionStatusLabel(status)}</span>;
}
