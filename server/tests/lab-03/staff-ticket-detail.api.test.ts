import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { getPrisma } from "../../src/prisma.js";
import { makeUser, makeItStaff, makeAdministrator, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

describe("GET /api/staff/assignees (ui-spec.md §4 Reassign dropdown)", () => {
  beforeEach(resetDb);

  it("lists only active IT Staff/Administrator, excluding Requesters and inactive staff", async () => {
    const staff = await makeItStaff();
    const admin = await makeAdministrator();
    const inactiveStaff = await makeItStaff({ isActive: false });
    const requester = await makeUser({ role: "REQUESTER" });

    const res = await request(app)
      .get(`/api/staff/assignees`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(200);
    const ids = res.body.map((a: { id: number }) => a.id);
    expect(ids).toEqual(expect.arrayContaining([staff.id, admin.id]));
    expect(ids).not.toContain(inactiveStaff.id);
    expect(ids).not.toContain(requester.id);
  });

  it("rejects a Requester caller with 403", async () => {
    const requester = await makeUser({ role: "REQUESTER" });
    const res = await request(app)
      .get(`/api/staff/assignees`)
      .set("Cookie", cookieFor(requester.id, "REQUESTER"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/staff/tickets/:id (FR-09, AC-15)", () => {
  beforeEach(resetDb);

  it("returns full ticket detail for any ticket, regardless of owner", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    const res = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
    expect(res.body.requester).toEqual({ id: requester.id, fullName: requester.fullName });
  });

  it("404s for a nonexistent ticket", async () => {
    const staff = await makeItStaff();
    const res = await request(app)
      .get(`/api/staff/tickets/999999`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(404);
  });

  it("rejects a Requester caller with 403", async () => {
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });
    const res = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(requester.id, "REQUESTER"));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/staff/tickets/:id/claim (FR-10, BR-14, BR-15, AC-06)", () => {
  beforeEach(resetDb);

  it("claims an unassigned New ticket for self and implicitly moves it to Open", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });
    expect(ticket.status).toBe("NEW");

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ticketOwner).toEqual({ id: staff.id, fullName: staff.fullName });
    expect(res.body.status).toBe("OPEN");
  });

  it("reassigns to a target active IT Staff/Administrator without the previous owner's consent", async () => {
    const staff = await makeItStaff();
    const otherStaff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    await getPrisma().ticket.update({ where: { id: ticket.id }, data: { ownerId: staff.id, status: "OPEN" } });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ targetUserId: otherStaff.id });
    expect(res.status).toBe(200);
    expect(res.body.ticketOwner).toEqual({ id: otherStaff.id, fullName: otherStaff.fullName });
  });

  it("rejects assigning to an inactive or non-staff target", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const inactiveStaff = await makeItStaff({ isActive: false });
    const ticket = await makeTicket({ requesterId: requester.id });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ targetUserId: inactiveStaff.id });
    expect(res.status).toBe(400);

    const toRequester = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/claim`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ targetUserId: requester.id });
    expect(toRequester.status).toBe(400);
  });
});

describe("PATCH /api/staff/tickets/:id/priority (FR-11, BR-16)", () => {
  beforeEach(resetDb);

  it("sets itPriority independently of requestedPriority", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id, requestedPriority: "LOW" });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/priority`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ itPriority: "URGENT" });
    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("URGENT");
    expect(res.body.requestedPriority).toBe("LOW");
  });
});

describe("PATCH /api/staff/tickets/:id/status (FR-12, BR-17, BR-18, AC-07)", () => {
  beforeEach(resetDb);

  it("allows a valid transition", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });
    await getPrisma().ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("rejects an invalid transition with 409 and leaves status unchanged (AC-07)", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id }); // NEW

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ status: "RESOLVED" });
    expect(res.status).toBe(409);

    const detail = await request(app)
      .get(`/api/staff/tickets/${ticket.id}`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(detail.body.status).toBe("NEW");
  });

  it("allows an Administrator to move Resolved -> Closed", async () => {
    const admin = await makeAdministrator();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });
    await getPrisma().ticket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });

    const res = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/status`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ status: "CLOSED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CLOSED");
  });
});
