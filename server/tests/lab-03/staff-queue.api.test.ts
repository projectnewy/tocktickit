import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { getPrisma } from "../../src/prisma.js";
import { makeUser, makeItStaff, makeAdministrator, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

describe("GET /api/staff/tickets (FR-08, AC-09..AC-12)", () => {
  beforeEach(resetDb);

  it("rejects a Requester caller with 403", async () => {
    const requester = await makeUser({ role: "REQUESTER" });
    const res = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", cookieFor(requester.id, "REQUESTER"));
    expect(res.status).toBe(403);
  });

  it("lists tickets across every requester, not scoped to the caller", async () => {
    const staff = await makeItStaff();
    const alice = await makeUser({ role: "REQUESTER", fullName: "Alice Requester" });
    const bob = await makeUser({ role: "REQUESTER", fullName: "Bob Requester" });
    await makeTicket({ requesterId: alice.id });
    await makeTicket({ requesterId: bob.id });

    const res = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].requester).toBeTruthy();
  });

  it("filters by ownerId=me to the caller's own claimed tickets", async () => {
    const staff = await makeItStaff();
    const otherStaff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const mine = await makeTicket({ requesterId: requester.id });
    const theirs = await makeTicket({ requesterId: requester.id });

    const prisma = getPrisma();
    await prisma.ticket.update({ where: { id: mine.id }, data: { ownerId: staff.id } });
    await prisma.ticket.update({ where: { id: theirs.id }, data: { ownerId: otherStaff.id } });

    const res = await request(app)
      .get("/api/staff/tickets")
      .query({ ownerId: "me" })
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(mine.id);
  });

  it("filters by ownerId=unassigned", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const unassigned = await makeTicket({ requesterId: requester.id });
    const assigned = await makeTicket({ requesterId: requester.id });

    const prisma = getPrisma();
    await prisma.ticket.update({ where: { id: assigned.id }, data: { ownerId: staff.id } });

    const res = await request(app)
      .get("/api/staff/tickets")
      .query({ ownerId: "unassigned" })
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(unassigned.id);
  });

  it("filters by status array and rejects an invalid sort value", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    await makeTicket({ requesterId: requester.id });

    const res = await request(app)
      .get("/api/staff/tickets")
      .query({ status: "NEW" })
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);

    const badSort = await request(app)
      .get("/api/staff/tickets")
      .query({ sort: "notAField:desc" })
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(badSort.status).toBe(400);
  });

  it("allows an Administrator caller too", async () => {
    const admin = await makeAdministrator();
    const res = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(res.status).toBe(200);
  });
});
