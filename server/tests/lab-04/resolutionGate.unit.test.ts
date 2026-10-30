import { describe, expect, it } from "vitest";
import { evaluateResolutionGate } from "../../src/services/resolutionGate.js";

// UNIT-03 (tests.md): BR-14 / AC-10 — passes only with at least one Completed and no Planned action.
describe("evaluateResolutionGate (UNIT-03)", () => {
  it("passes with one Completed action and no Planned action", () => {
    expect(evaluateResolutionGate({ completed: 1, planned: 0 })).toEqual([]);
  });

  it("passes with many Completed actions and no Planned action", () => {
    expect(evaluateResolutionGate({ completed: 7, planned: 0 })).toEqual([]);
  });

  it("reports NO_COMPLETED_ACTION when nothing was completed and nothing is planned", () => {
    expect(evaluateResolutionGate({ completed: 0, planned: 0 })).toEqual(["NO_COMPLETED_ACTION"]);
  });

  it("reports OPEN_PLANNED_ACTIONS when work is completed but another action is still Planned", () => {
    expect(evaluateResolutionGate({ completed: 2, planned: 1 })).toEqual(["OPEN_PLANNED_ACTIONS"]);
  });

  it("reports both reasons, in a stable order, when nothing is completed and something is planned", () => {
    expect(evaluateResolutionGate({ completed: 0, planned: 3 })).toEqual(["NO_COMPLETED_ACTION", "OPEN_PLANNED_ACTIONS"]);
  });
});
