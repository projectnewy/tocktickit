import { describe, expect, it } from "vitest";
import {
  ACTION_STATUSES,
  canTransition,
  editableFieldsFor,
  normalizeFollowUp,
  validateActionFields,
  type ActionFieldsInput,
} from "../../src/services/actionRules.js";

const NOW = new Date("2026-10-29T10:00:00.000Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function input(overrides: Partial<ActionFieldsInput> = {}): ActionFieldsInput {
  return {
    status: "PLANNED",
    description: "Replace the faulty access point",
    result: null,
    actionDateTime: NOW,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    ...overrides,
  };
}

// UNIT-01 (tests.md): BR-07 / AC-05 — each violation names the right field and nothing else.
describe("validateActionFields (UNIT-01)", () => {
  it("accepts a minimal Planned action", () => {
    expect(validateActionFields(input(), NOW)).toEqual({});
  });

  it("accepts a fully populated Completed action", () => {
    const errors = validateActionFields(
      input({
        status: "COMPLETED",
        result: "Replaced and tested",
        followUpRequired: true,
        followUpNote: "Check signal in 24h",
        attachmentNotes: "See the survey PNG on the Ticket",
      }),
      NOW
    );
    expect(errors).toEqual({});
  });

  describe("description (1-2000 characters, required)", () => {
    it.each([
      ["empty", ""],
      ["only spaces", "   \n  "],
      ["2001 characters", "a".repeat(2001)],
    ])("rejects %s", (_label, description) => {
      expect(Object.keys(validateActionFields(input({ description }), NOW))).toEqual(["description"]);
    });

    it.each([
      ["1 character", "a"],
      ["2000 characters", "a".repeat(2000)],
    ])("accepts %s", (_label, description) => {
      expect(validateActionFields(input({ description }), NOW)).toEqual({});
    });
  });

  describe("result (required when Completed, otherwise optional, max 2000)", () => {
    it.each([null, "", "   "])("rejects a Completed action with result %j", (result) => {
      expect(Object.keys(validateActionFields(input({ status: "COMPLETED", result }), NOW))).toEqual(["result"]);
    });

    it("allows a Planned or Cancelled action without a result", () => {
      expect(validateActionFields(input({ status: "PLANNED", result: null }), NOW)).toEqual({});
      expect(validateActionFields(input({ status: "CANCELLED", result: null }), NOW)).toEqual({});
    });

    it("accepts 2000 characters and rejects 2001, whatever the status", () => {
      expect(validateActionFields(input({ status: "COMPLETED", result: "r".repeat(2000) }), NOW)).toEqual({});
      expect(Object.keys(validateActionFields(input({ status: "COMPLETED", result: "r".repeat(2001) }), NOW))).toEqual(["result"]);
      expect(Object.keys(validateActionFields(input({ status: "PLANNED", result: "r".repeat(2001) }), NOW))).toEqual(["result"]);
    });
  });

  describe("follow-up note (required only when follow-up is required, 1-1000)", () => {
    it.each([null, "", "  "])("rejects follow-up required with note %j", (followUpNote) => {
      expect(Object.keys(validateActionFields(input({ followUpRequired: true, followUpNote }), NOW))).toEqual(["followUpNote"]);
    });

    it("accepts 1000 characters and rejects 1001 when follow-up is required", () => {
      expect(validateActionFields(input({ followUpRequired: true, followUpNote: "n".repeat(1000) }), NOW)).toEqual({});
      expect(Object.keys(validateActionFields(input({ followUpRequired: true, followUpNote: "n".repeat(1001) }), NOW))).toEqual(["followUpNote"]);
    });

    it("does not require or validate a note when follow-up is not required", () => {
      expect(validateActionFields(input({ followUpRequired: false, followUpNote: null }), NOW)).toEqual({});
      expect(validateActionFields(input({ followUpRequired: false, followUpNote: "n".repeat(5000) }), NOW)).toEqual({});
    });
  });

  describe("attachment notes (optional, max 500)", () => {
    it("accepts empty, 500 characters; rejects 501", () => {
      expect(validateActionFields(input({ attachmentNotes: null }), NOW)).toEqual({});
      expect(validateActionFields(input({ attachmentNotes: "a".repeat(500) }), NOW)).toEqual({});
      expect(Object.keys(validateActionFields(input({ attachmentNotes: "a".repeat(501) }), NOW))).toEqual(["attachmentNotes"]);
    });
  });

  describe("action date/time", () => {
    it("rejects an invalid date", () => {
      expect(Object.keys(validateActionFields(input({ actionDateTime: new Date("not a date") }), NOW))).toEqual(["actionDateTime"]);
    });

    it("allows a Planned action in the future (it is planned work)", () => {
      expect(validateActionFields(input({ status: "PLANNED", actionDateTime: minutes(60 * 24) }), NOW)).toEqual({});
    });

    it("rejects a Completed action more than 5 minutes in the future, allows up to 5 and any past time", () => {
      const completed = { status: "COMPLETED" as const, result: "Done" };
      expect(Object.keys(validateActionFields(input({ ...completed, actionDateTime: minutes(6) }), NOW))).toEqual(["actionDateTime"]);
      expect(validateActionFields(input({ ...completed, actionDateTime: minutes(5) }), NOW)).toEqual({});
      expect(validateActionFields(input({ ...completed, actionDateTime: minutes(-60 * 24 * 30) }), NOW)).toEqual({});
    });
  });

  it("reports every violated field at once", () => {
    const errors = validateActionFields(
      input({ status: "COMPLETED", description: "", result: null, followUpRequired: true, followUpNote: null, attachmentNotes: "a".repeat(501), actionDateTime: minutes(60) }),
      NOW
    );
    expect(Object.keys(errors).sort()).toEqual(["actionDateTime", "attachmentNotes", "description", "followUpNote", "result"]);
  });
});

describe("normalizeFollowUp (BR-07: the note is discarded when follow-up is not required)", () => {
  it("drops the note when follow-up is not required", () => {
    expect(normalizeFollowUp({ followUpRequired: false, followUpNote: "stale note" })).toEqual({ followUpRequired: false, followUpNote: null });
  });

  it("keeps a trimmed note when follow-up is required", () => {
    expect(normalizeFollowUp({ followUpRequired: true, followUpNote: "  check later  " })).toEqual({ followUpRequired: true, followUpNote: "check later" });
  });
});

// UNIT-02 (tests.md): BR-06 / BR-10 — all 9 (from, to) pairs against an independent copy of the table.
describe("action status transitions (UNIT-02)", () => {
  const ALLOWED = new Set(["PLANNED->COMPLETED", "PLANNED->CANCELLED"]);

  it("covers the three statuses", () => {
    expect([...ACTION_STATUSES]).toEqual(["PLANNED", "COMPLETED", "CANCELLED"]);
  });

  for (const from of ["PLANNED", "COMPLETED", "CANCELLED"] as const) {
    for (const to of ["PLANNED", "COMPLETED", "CANCELLED"] as const) {
      const expected = ALLOWED.has(`${from}->${to}`);
      it(`${from} -> ${to} is ${expected ? "allowed" : "rejected"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe("editable fields per status (BR-10)", () => {
  it("lets a Planned action change everything, including assignee and status", () => {
    expect([...editableFieldsFor("PLANNED")].sort()).toEqual(
      ["actionDateTime", "assigneeId", "attachmentNotes", "description", "followUpNote", "followUpRequired", "result", "status"]
    );
  });

  it("lets a Completed action correct content only, not status or assignee", () => {
    const fields = [...editableFieldsFor("COMPLETED")].sort();
    expect(fields).toEqual(["actionDateTime", "attachmentNotes", "description", "followUpNote", "followUpRequired", "result"]);
    expect(fields).not.toContain("status");
    expect(fields).not.toContain("assigneeId");
  });

  it("makes a Cancelled action read-only", () => {
    expect([...editableFieldsFor("CANCELLED")]).toEqual([]);
  });
});
