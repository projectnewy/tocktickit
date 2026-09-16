import { describe, it, expect } from "vitest";
import { STATUS_TRANSITIONS } from "../../src/services/staff.service.js";

// UNIT-01 (tests.md): BR-17 — every pair of the 8 statuses, checked against
// an independently-transcribed copy of specification.md §6's matrix (not
// just re-reading STATUS_TRANSITIONS back at itself).
const ALL_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

// Transcribed directly from specification.md §6's table.
const EXPECTED_VALID_PAIRS = new Set([
  "NEW->OPEN",
  "NEW->CANCELLED",
  "OPEN->IN_PROGRESS",
  "OPEN->CANCELLED",
  "IN_PROGRESS->WAITING_FOR_REQUESTER",
  "IN_PROGRESS->RESOLVED",
  "WAITING_FOR_REQUESTER->IN_PROGRESS",
  "WAITING_FOR_REQUESTER->RESOLVED",
  "RESOLVED->CLOSED",
  "RESOLVED->REOPENED",
  "CLOSED->REOPENED",
  "REOPENED->IN_PROGRESS",
]);

describe("STATUS_TRANSITIONS (BR-17, specification.md §6)", () => {
  it.each(ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => [from, to] as const)))(
    "%s -> %s",
    (from, to) => {
      const actuallyAllowed = STATUS_TRANSITIONS[from].includes(to);
      const expectedAllowed = EXPECTED_VALID_PAIRS.has(`${from}->${to}`);
      expect(actuallyAllowed).toBe(expectedAllowed);
    }
  );

  it("CANCELLED is terminal — no outgoing transitions", () => {
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
