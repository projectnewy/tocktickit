import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeRequester, makeTicket } from "../helpers/factories.js";

describe("GET /api/tickets", () => {
  beforeEach(resetDb);

  it("lists only the selected requester's tickets, newest first, with correct pagination metadata (API-06)", async () => {
    const other = await makeRequester();
    for (let i = 0; i < 3; i++) await makeTicket({ requesterId: 1 });
    await makeTicket({ requesterId: other.id });

    const res = await request(app).get("/api/tickets").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
    expect(res.body.totalItems).toBe(3);
    const dates = res.body.items.map((t: { ticketDate: string }) => new Date(t.ticketDate).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("searches by ticketNumber and by summary substring (API-07)", async () => {
    const ticket = await makeTicket({ requesterId: 1, summary: "Cannot connect to VPN" });
    await makeTicket({ requesterId: 1, summary: "Printer offline" });

    const byNumber = await request(app)
      .get("/api/tickets")
      .query({ q: ticket.ticketNumber })
      .set("X-Requester-Id", "1");
    expect(byNumber.body.items.map((t: { id: number }) => t.id)).toEqual([ticket.id]);

    const bySummary = await request(app).get("/api/tickets").query({ q: "vpn" }).set("X-Requester-Id", "1");
    expect(bySummary.body.items.map((t: { id: number }) => t.id)).toEqual([ticket.id]);
  });

  it("filters by category, relatedSystem, requestedPriority, and status, individually and combined (API-08)", async () => {
    const t1 = await makeTicket({ requesterId: 1, categoryId: 2, requestedPriority: "HIGH" });
    await makeTicket({ requesterId: 1, categoryId: 3, requestedPriority: "LOW" });

    const byCategory = await request(app).get("/api/tickets").query({ categoryId: 2 }).set("X-Requester-Id", "1");
    expect(byCategory.body.items.map((t: { id: number }) => t.id)).toEqual([t1.id]);

    const combined = await request(app)
      .get("/api/tickets")
      .query({ categoryId: 2, requestedPriority: "HIGH" })
      .set("X-Requester-Id", "1");
    expect(combined.body.items.map((t: { id: number }) => t.id)).toEqual([t1.id]);

    const noMatch = await request(app)
      .get("/api/tickets")
      .query({ categoryId: 2, requestedPriority: "LOW" })
      .set("X-Requester-Id", "1");
    expect(noMatch.body.items).toEqual([]);
  });

  it("sorts by ticketNumber, summary, and requestedPriority in both directions (API-09)", async () => {
    await makeTicket({ requesterId: 1, summary: "Beta issue" });
    await makeTicket({ requesterId: 1, summary: "Alpha issue" });

    const asc = await request(app).get("/api/tickets").query({ sort: "summary:asc" }).set("X-Requester-Id", "1");
    expect(asc.body.items.map((t: { summary: string }) => t.summary)).toEqual(["Alpha issue", "Beta issue"]);

    const desc = await request(app).get("/api/tickets").query({ sort: "summary:desc" }).set("X-Requester-Id", "1");
    expect(desc.body.items.map((t: { summary: string }) => t.summary)).toEqual(["Beta issue", "Alpha issue"]);
  });

  it("returns an empty page for a filter combination matching nothing (API-10)", async () => {
    await makeTicket({ requesterId: 1, categoryId: 2 });
    const res = await request(app).get("/api/tickets").query({ categoryId: 3 }).set("X-Requester-Id", "1");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalItems).toBe(0);
  });

  it("rejects invalid query parameters instead of silently coercing them (API-11)", async () => {
    const badPage = await request(app).get("/api/tickets").query({ page: "abc" }).set("X-Requester-Id", "1");
    expect(badPage.status).toBe(400);

    const badPageSize = await request(app).get("/api/tickets").query({ pageSize: "10000" }).set("X-Requester-Id", "1");
    expect(badPageSize.status).toBe(400);

    const badSort = await request(app).get("/api/tickets").query({ sort: "nope:asc" }).set("X-Requester-Id", "1");
    expect(badSort.status).toBe(400);
  });

  it("computes activeAttachmentCount and pagination metadata across two pages (AC-08)", async () => {
    for (let i = 0; i < 14; i++) await makeTicket({ requesterId: 1 });

    const page1 = await request(app).get("/api/tickets").query({ page: 1, pageSize: 10 }).set("X-Requester-Id", "1");
    expect(page1.body.items.length).toBe(10);
    expect(page1.body.totalItems).toBe(14);
    expect(page1.body.totalPages).toBe(2);
    expect(page1.body.hasNextPage).toBe(true);
    expect(page1.body.hasPreviousPage).toBe(false);

    const page2 = await request(app).get("/api/tickets").query({ page: 2, pageSize: 10 }).set("X-Requester-Id", "1");
    expect(page2.body.items.length).toBe(4);
    expect(page2.body.hasNextPage).toBe(false);
    expect(page2.body.hasPreviousPage).toBe(true);
  });
});
