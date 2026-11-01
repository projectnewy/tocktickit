import { describe, it, expect } from "vitest";
import {
  PRIORITY_LABELS,
  PRIORITY_VALUES,
  ROLE_LABELS,
  ROLE_VALUES,
  STATUS_LABELS,
  STATUS_VALUES,
  priorityLabel,
  roleLabel,
  statusLabel,
} from "../../src/config/labels.js";

// UNIT-06 (tests.md): FR-18 — Status/Priority/Role always render friendly
// labels, never the raw enum value.
describe("label helpers", () => {
  it.each(STATUS_VALUES.map((s) => [s]))("status %s has a friendly label", (status) => {
    const label = statusLabel(status);
    expect(label).toBe(STATUS_LABELS[status]);
    expect(label).not.toBe(status);
    expect(label).not.toMatch(/_/);
  });

  it.each(PRIORITY_VALUES.map((p) => [p]))("priority %s has a friendly label", (priority) => {
    const label = priorityLabel(priority);
    expect(label).toBe(PRIORITY_LABELS[priority]);
    expect(label).not.toBe(priority);
  });

  it.each(ROLE_VALUES.map((r) => [r]))("role %s has a friendly label", (role) => {
    const label = roleLabel(role);
    expect(label).toBe(ROLE_LABELS[role]);
    expect(label).not.toBe(role);
    expect(label).not.toMatch(/_/);
  });

  it("uses distinct labels within each set", () => {
    expect(new Set(STATUS_VALUES.map(statusLabel)).size).toBe(STATUS_VALUES.length);
    expect(new Set(PRIORITY_VALUES.map(priorityLabel)).size).toBe(PRIORITY_VALUES.length);
    expect(new Set(ROLE_VALUES.map(roleLabel)).size).toBe(ROLE_VALUES.length);
  });

  it("falls back to a readable label for a value the client does not know", () => {
    expect(statusLabel("PENDING_REVIEW")).toBe("Pending Review");
    expect(priorityLabel("CRITICAL")).toBe("Critical");
    expect(roleLabel("AUDITOR")).toBe("Auditor");
  });
});
