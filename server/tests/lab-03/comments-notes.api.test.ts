import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeUser, makeItStaff, makeAdministrator, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

describe("Requester Public Comments (AC-08, BR-04, BR-19, BR-20, BR-21)", () => {
  beforeEach(resetDb);

  it("posts and lists a comment with server-set author and timestamp", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const post = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(owner.id, "REQUESTER"))
      .send({ body: "Still seeing the issue this morning." });

    expect(post.status).toBe(201);
    expect(post.body.body).toBe("Still seeing the issue this morning.");
    expect(post.body.author).toEqual({ id: owner.id, fullName: owner.fullName });
    expect(post.body.createdAt).toBeTruthy();

    const list = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(owner.id, "REQUESTER"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects an empty or whitespace-only comment (BR-19)", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(owner.id, "REQUESTER"))
      .send({ body: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects reading or posting comments on a ticket the caller does not own (404, uniform with nonexistent)", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const intruder = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const list = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(intruder.id, "REQUESTER"));
    expect(list.status).toBe(404);

    const post = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(intruder.id, "REQUESTER"))
      .send({ body: "Trying to comment on someone else's ticket" });
    expect(post.status).toBe(404);
  });
});

describe("POST /api/tickets/:id/resolution-indication (FR-07, BR-05)", () => {
  beforeEach(resetDb);

  it("sets resolutionIndicated without changing the formal status", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/resolution-indication`)
      .set("Cookie", cookieFor(owner.id, "REQUESTER"));

    expect(res.status).toBe(200);
    expect(res.body.resolutionIndicated).toBe(true);
    expect(res.body.status).toBe("NEW"); // unchanged — only IT Staff/Admin move status (BR-18)
  });

  it("rejects indicating resolution on a ticket the caller does not own", async () => {
    const owner = await makeUser({ role: "REQUESTER" });
    const intruder = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/resolution-indication`)
      .set("Cookie", cookieFor(intruder.id, "REQUESTER"));
    expect(res.status).toBe(404);
  });
});

describe("IT Staff/Administrator Public Comments access (BR-04, FR-13)", () => {
  beforeEach(resetDb);

  it("lets IT Staff read and post comments on a ticket they don't own", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    const post = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ body: "Looking into this now." });
    expect(post.status).toBe(201);
    expect(post.body.author).toEqual({ id: staff.id, fullName: staff.fullName });

    const list = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("404s for IT Staff on a nonexistent ticket", async () => {
    const staff = await makeItStaff();
    const res = await request(app)
      .get(`/api/tickets/999999/comments`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(404);
  });
});

describe("Internal Notes (FR-13, FR-19, BR-04, BR-22, AC-04, AC-09)", () => {
  beforeEach(resetDb);

  it("lets IT Staff and Administrator post and read internal notes", async () => {
    const staff = await makeItStaff();
    const admin = await makeAdministrator();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    const post = await request(app)
      .post(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ body: "Escalating to network team." });
    expect(post.status).toBe(201);
    expect(post.body.author).toEqual({ id: staff.id, fullName: staff.fullName });

    const list = await request(app)
      .get(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejects a Requester with 403 and no note content, even for their own ticket (BR-22, AC-04)", async () => {
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    const list = await request(app)
      .get(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(requester.id, "REQUESTER"));
    expect(list.status).toBe(403);
    expect(list.body).not.toHaveProperty("body");
    expect(JSON.stringify(list.body)).not.toMatch(/note content|Escalating/);

    const post = await request(app)
      .post(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(requester.id, "REQUESTER"))
      .send({ body: "Trying to sneak a note in" });
    expect(post.status).toBe(403);
  });

  it("never surfaces internal notes through the Requester-facing comments endpoint (FR-19, AC-09)", async () => {
    const staff = await makeItStaff();
    const requester = await makeUser({ role: "REQUESTER" });
    const ticket = await makeTicket({ requesterId: requester.id });

    await request(app)
      .post(`/api/tickets/${ticket.id}/notes`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ body: "Staff-only detail that must stay private." });

    const comments = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", cookieFor(requester.id, "REQUESTER"));
    expect(comments.status).toBe(200);
    expect(comments.body).toHaveLength(0);
  });
});
