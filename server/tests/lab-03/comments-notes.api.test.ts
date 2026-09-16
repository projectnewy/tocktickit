import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeUser, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

// Requester-side Public Comments only (owner-scoped). IT Staff/Administrator
// access to Comments (any ticket) and Internal Notes lands in Issue #35's
// staff routes — this file gains those tests then, per the labsheet's
// required server/tests/lab-03/comments-notes.api.test.ts path.
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
