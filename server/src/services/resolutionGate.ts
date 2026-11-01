// Resolution gate (specification.md BR-14): a Ticket can become Resolved only with at least one
// Completed action and no Planned action. Pure so the rule is unit-tested without a database; the
// service runs it inside a transaction with the Ticket row locked.

export type GateReason = "NO_COMPLETED_ACTION" | "OPEN_PLANNED_ACTIONS";

export function evaluateResolutionGate(counts: { completed: number; planned: number }): GateReason[] {
  const unmet: GateReason[] = [];
  if (counts.completed < 1) unmet.push("NO_COMPLETED_ACTION");
  if (counts.planned > 0) unmet.push("OPEN_PLANNED_ACTIONS");
  return unmet;
}
