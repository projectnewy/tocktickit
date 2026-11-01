import { describe, expect, it } from "vitest";
import { bangkokWindowStart } from "../../src/services/dashboardWindow.js";

// UNIT-05 (tests.md): BR-23 — "recent" starts at 00:00 Bangkok time six days before today (7 calendar days,
// today included). Bangkok is a fixed UTC+7, so 00:00 Bangkok is 17:00 UTC the previous day.
const start = (iso: string) => bangkokWindowStart(new Date(iso)).toISOString();

describe("bangkokWindowStart (UNIT-05)", () => {
  it("at 00:00:00 Bangkok on 30 Oct (17:00 UTC on 29 Oct) starts at 00:00 Bangkok on 24 Oct", () => {
    expect(start("2026-10-29T17:00:00.000Z")).toBe("2026-10-23T17:00:00.000Z");
  });

  it("one millisecond before that midnight it is still 29 Oct in Bangkok, so the window starts a day earlier", () => {
    expect(start("2026-10-29T16:59:59.999Z")).toBe("2026-10-22T17:00:00.000Z");
  });

  it("at 23:59:59.999 Bangkok on 30 Oct the window is the same as at 00:00 that day", () => {
    expect(start("2026-10-30T16:59:59.999Z")).toBe(start("2026-10-29T17:00:00.000Z"));
  });

  it("is the same for every instant inside one Bangkok day, even across the UTC date change", () => {
    const sameDay = ["2026-10-29T17:00:00.000Z", "2026-10-29T23:59:00.000Z", "2026-10-30T00:00:00.000Z", "2026-10-30T12:30:00.000Z", "2026-10-30T16:59:59.999Z"];
    expect(new Set(sameDay.map(start)).size).toBe(1);
  });

  it("differs between two Bangkok days", () => {
    expect(start("2026-10-30T16:59:59.999Z")).not.toBe(start("2026-10-30T17:00:00.000Z"));
  });

  it("crosses a month boundary", () => {
    // 2 Nov 12:00 Bangkok -> 27 Oct 00:00 Bangkok
    expect(start("2026-11-02T05:00:00.000Z")).toBe("2026-10-26T17:00:00.000Z");
  });

  it("crosses a year boundary", () => {
    // 3 Jan 2027 Bangkok -> 28 Dec 2026 00:00 Bangkok
    expect(start("2027-01-03T03:00:00.000Z")).toBe("2026-12-27T17:00:00.000Z");
  });

  it("handles a leap day (1 Mar 2028 Bangkok -> 24 Feb 2028 Bangkok)", () => {
    expect(start("2028-03-01T03:00:00.000Z")).toBe("2028-02-23T17:00:00.000Z");
  });

  it("always covers between six and seven days back from now (7 calendar days inclusive)", () => {
    const day = 24 * 60 * 60 * 1000;
    for (const iso of ["2026-10-29T17:00:00.000Z", "2026-10-30T03:17:00.000Z", "2026-10-30T16:59:59.999Z", "2026-02-28T23:00:00.000Z"]) {
      const now = new Date(iso);
      const span = now.getTime() - bangkokWindowStart(now).getTime();
      expect(span).toBeGreaterThanOrEqual(6 * day);
      expect(span).toBeLessThan(7 * day);
    }
  });
});
