import { ApiError } from "../api/client.js";
import type { TicketStatus } from "../api/types.js";
import { statusLabel } from "./labels.js";

// Turns a failed Ticket workflow request (claim, priority, status) into text a person can act on
// (docs/lab-04/ui-spec.md §5). The server owns the rules and always sends a stable `code`; the screen
// never shows a raw enum value or the server's internal wording for these cases.
export interface WorkflowIssue {
  kind: "stale" | "gate" | "other";
  message: string;
  // Plain-language reasons, one per unmet resolution-gate condition.
  reasons?: string[];
}

const GATE_REASONS: Record<string, string> = {
  NO_COMPLETED_ACTION: "Record at least one completed action.",
  OPEN_PLANNED_ACTIONS: "Complete or cancel all planned actions.",
};

export function describeWorkflowError(err: unknown, fallback: string, currentStatus: TicketStatus): WorkflowIssue {
  if (!(err instanceof ApiError)) return { kind: "other", message: fallback };

  const body = (err.body ?? {}) as { code?: string; unmet?: string[] };
  if (err.status === 409 && body.code === "STALE_VERSION") {
    return { kind: "stale", message: "This ticket was changed by someone else. Reload it to see the latest version before trying again." };
  }
  if (err.status === 409 && body.code === "RESOLUTION_GATE") {
    return {
      kind: "gate",
      message: "This ticket cannot be resolved yet.",
      reasons: (body.unmet ?? []).map((code) => GATE_REASONS[code] ?? "Finish the open work on this ticket."),
    };
  }
  if (err.status === 409 && body.code === "INVALID_TRANSITION") {
    return { kind: "other", message: `That status change is not allowed while the ticket is ${statusLabel(currentStatus)}.` };
  }
  return { kind: "other", message: err.message || fallback };
}
