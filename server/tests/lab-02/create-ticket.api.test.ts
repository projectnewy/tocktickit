import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeRequester } from "../helpers/factories.js";
import { getPrisma } from "../../src/prisma.js";

const VALID_TICKET = {
  categoryId: 2, // Hardware
  relatedSystemId: 7, // Corporate Laptop
  summary: "Laptop battery drains quickly",
  description: "The battery drains much faster than usual even when the system is idle.",
  requestedPriority: "MEDIUM",
};

describe("POST /api/tickets", () => {
  beforeEach(resetDb);

  it("creates a ticket with a unique, backend-generated ticket number and status NEW (API-01)", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(VALID_TICKET);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("NEW");
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.requester).toEqual({ id: 1, fullName: "Jennifer Anderson" });
    expect(res.body.attachments).toEqual([]);

    const saved = await getPrisma().ticket.findUnique({ where: { id: res.body.id } });
    expect(saved?.requesterId).toBe(1);
  });

  it("generates 20 distinct ticket numbers under 20 concurrent creates (API-02)", async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).post("/api/tickets").set("X-Requester-Id", "1").send(VALID_TICKET)
      )
    );

    for (const res of responses) expect(res.status).toBe(201);
    const numbers = responses.map((res) => res.body.ticketNumber);
    expect(new Set(numbers).size).toBe(20);
  });

  it("rejects missing/invalid fields with field-level details and creates nothing (API-03)", async () => {
    const before = await getPrisma().ticket.count();
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({ categoryId: 2, relatedSystemId: 7, summary: "hi", description: "short", requestedPriority: "SUPER" });

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
    expect(await getPrisma().ticket.count()).toBe(before);
  });

  it("rejects an inactive category reference (API-04)", async () => {
    await getPrisma().category.updateMany({ where: { id: 2 }, data: { isActive: false } });
    const res = await request(app).post("/api/tickets").set("X-Requester-Id", "1").send(VALID_TICKET);
    expect(res.status).toBe(400);
  });

  it("rejects a request with no requester context (API-05)", async () => {
    const res = await request(app).post("/api/tickets").send(VALID_TICKET);
    expect(res.status).toBe(401);
  });

  it("rejects a request whose requester id belongs to an inactive requester (API-05, AC-18)", async () => {
    const inactive = await makeRequester({ isActive: false });
    const res = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(inactive.id))
      .send(VALID_TICKET);
    expect(res.status).toBe(401);
  });
});
