import { describe, expect, it } from "vitest";
import { STATUS_TRANSITIONS } from "../../src/services/staff.service.js";

// UNIT-04 (tests.md): BR-13 — every (from, to) pair of the 8 statuses, checked against an independent
// transcription of specification.md §5.3's table (not by reading STATUS_TRANSITIONS back at itself).
const ALL = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

const SPEC_TABLE_ROWS: Array<[from: string[], to: string]> = [
  [["NEW"], "OPEN"], // implicit on claim
  [["NEW", "OPEN"], "CANCELLED"],
  [["OPEN"], "IN_PROGRESS"],
  [["IN_PROGRESS"], "WAITING_FOR_REQUESTER"],
  [["WAITING_FOR_REQUESTER"], "IN_PROGRESS"],
  [["IN_PROGRESS", "WAITING_FOR_REQUESTER"], "RESOLVED"],
  [["RESOLVED"], "CLOSED"],
  [["RESOLVED", "CLOSED"], "REOPENED"],
  [["REOPENED"], "IN_PROGRESS"],
];
const EXPECTED = new Set(SPEC_TABLE_ROWS.flatMap(([froms, to]) => froms.map((from) => `${from}->${to}`)));

describe("ticket status transition matrix (UNIT-04)", () => {
  it("lists exactly the 12 pairs of the specification", () => {
    expect(EXPECTED.size).toBe(12);
  });

  for (const from of ALL) {
    for (const to of ALL) {
      const allowed = EXPECTED.has(`${from}->${to}`);
      it(`${from} -> ${to} is ${allowed ? "allowed" : "rejected"}`, () => {
        expect(STATUS_TRANSITIONS[from].includes(to)).toBe(allowed);
      });
    }
  }
});
