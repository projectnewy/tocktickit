import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { getPrisma } from "../../src/prisma.js";

describe("reference endpoints", () => {
  beforeEach(resetDb);

  it("GET /api/related-systems returns only active systems, ordered by name", async () => {
    const prisma = getPrisma();
    await prisma.relatedSystem.updateMany({ where: { name: "Printer" }, data: { isActive: false } });

    const res = await request(app).get("/api/related-systems");
    expect(res.status).toBe(200);
    const names = res.body.map((s: { name: string }) => s.name);
    expect(names).not.toContain("Printer");
    expect(names).toEqual([...names].sort());
  });

  it("GET /api/requesters returns only active requesters, ordered by full name, and excludes the inactive seed row", async () => {
    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
    expect(res.body.some((r: { fullName: string }) => r.fullName === "Alex Wong")).toBe(false);
    const names = res.body.map((r: { fullName: string }) => r.fullName);
    expect(names).toEqual([...names].sort());
    for (const r of res.body) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("fullName");
      expect(r).toHaveProperty("email");
      expect(r).toHaveProperty("department");
    }
  });

  it("GET /api/nonexistent-route returns a JSON 404, not an HTML page", async () => {
    const res = await request(app).get("/api/nonexistent-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Route not found" });
  });
});
