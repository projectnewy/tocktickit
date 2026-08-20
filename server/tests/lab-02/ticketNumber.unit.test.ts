import { describe, it, expect, beforeEach } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { nextTicketNumber, formatTicketNumber } from "../../src/services/ticketNumber.js";
import { resetDb } from "../helpers/db.js";

describe("formatTicketNumber", () => {
  it("zero-pads the sequence to 6 digits", () => {
    expect(formatTicketNumber(2026, 42)).toBe("TKT-2026-000042");
    expect(formatTicketNumber(2026, 1)).toBe("TKT-2026-000001");
    expect(formatTicketNumber(2026, 123456)).toBe("TKT-2026-123456");
  });
});

describe("nextTicketNumber", () => {
  beforeEach(resetDb);

  it("returns sequential numbers for the same year", async () => {
    const prisma = getPrisma();
    const first = await prisma.$transaction((tx) => nextTicketNumber(tx, 2026));
    const second = await prisma.$transaction((tx) => nextTicketNumber(tx, 2026));
    expect(first).toBe("TKT-2026-000001");
    expect(second).toBe("TKT-2026-000002");
  });

  it("generates 20 distinct numbers under concurrent calls", async () => {
    const prisma = getPrisma();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => prisma.$transaction((tx) => nextTicketNumber(tx, 2026)))
    );
    expect(new Set(results).size).toBe(20);
  });

  it("tracks separate counters per year", async () => {
    const prisma = getPrisma();
    const y2026 = await prisma.$transaction((tx) => nextTicketNumber(tx, 2026));
    const y2027 = await prisma.$transaction((tx) => nextTicketNumber(tx, 2027));
    expect(y2026).toBe("TKT-2026-000001");
    expect(y2027).toBe("TKT-2027-000001");
  });
});
