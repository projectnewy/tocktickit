import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeUser, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";
import { requireRole } from "../../src/http/authContext.js";
import { ForbiddenError } from "../../src/http/errors.js";

describe("requireRole middleware (unit)", () => {
  it("calls next() when the request's role is in the allowed set", () => {
    const req = { userRole: "IT_STAFF" } as any;
    let called = false;
    requireRole("IT_STAFF", "ADMINISTRATOR")(req, {} as any, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("throws ForbiddenError when the role is not allowed", () => {
    const req = { userRole: "REQUESTER" } as any;
    expect(() => requireRole("ADMINISTRATOR")(req, {} as any, () => {})).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when there is no role at all", () => {
    const req = {} as any;
    expect(() => requireRole("REQUESTER")(req, {} as any, () => {})).toThrow(ForbiddenError);
  });
});

describe("Lab 2 -> Lab 3 auth migration regression (AC-03, AC-17, BR-03, BR-29)", () => {
  beforeEach(resetDb);

  it("no longer honors the retired X-Requester-Id header — only the session cookie counts", async () => {
    const res = await request(app).get("/api/tickets").set("X-Requester-Id", "1");
    expect(res.status).toBe(401);
  });

  it("scopes My Tickets to the session identity, not any client-supplied id (AC-03, BR-03)", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const other = await makeUser({ role: "REQUESTER" });
    await makeTicket({ requesterId: owner.id, summary: "Owner's own ticket, 12+ chars" });
    await makeTicket({ requesterId: other.id, summary: "Someone else's ticket, 12+ chars" });

    const res = await request(app).get("/api/tickets").set("Cookie", cookieFor(owner.id, "REQUESTER"));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].summary).toBe("Owner's own ticket, 12+ chars");
  });

  it("still 404s (not 403) on cross-requester ticket access under session auth (BR-29)", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const intruder = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(intruder.id, "REQUESTER"));

    expect(res.status).toBe(404);
  });

  it("rejects an IT Staff or Administrator identity on Requester-only ticket routes exactly like any other non-owner (BR-03)", async () => {
    // Lab 3 doesn't grant staff a Requester-route bypass — staff get their own
    // /api/staff/* routes (later Issues). Until those exist, a staff session
    // hitting a Requester's ticket by id is just another non-owner: 404.
    const owner = await makeUser({ role: "REQUESTER" });
    const staff = await makeUser({ role: "IT_STAFF" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(404);
  });
});
