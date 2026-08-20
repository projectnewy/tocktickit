import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeRequester, makeTicket } from "../helpers/factories.js";

describe("GET /api/tickets/:ticketId", () => {
  beforeEach(resetDb);

  it("retrieves one owned ticket with its attachments array (API-12)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("X-Requester-Id", "1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
    expect(res.body.attachments).toEqual([]);
  });

  it("rejects access to a ticket owned by a different requester with 404 and no ticket data (API-13, AC-03)", async () => {
    const owner = await makeRequester();
    const ticket = await makeTicket({ requesterId: owner.id });

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set("X-Requester-Id", "1");

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("summary");
    expect(res.body).not.toHaveProperty("description");
  });

  it("returns the identical 404 shape for a nonexistent ticket id (API-14)", async () => {
    const owner = await makeRequester();
    const ownedTicket = await makeTicket({ requesterId: owner.id });

    const notOwned = await request(app).get(`/api/tickets/${ownedTicket.id}`).set("X-Requester-Id", "1");
    const notFound = await request(app).get("/api/tickets/999999").set("X-Requester-Id", "1");

    expect(notOwned.status).toBe(404);
    expect(notFound.status).toBe(404);
    expect(notOwned.body).toEqual(notFound.body);
  });

  it("rejects a non-numeric ticket id", async () => {
    const res = await request(app).get("/api/tickets/not-a-number").set("X-Requester-Id", "1");
    expect(res.status).toBe(400);
  });
});
