import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Role, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";
import { makeAdministrator, makeItStaff, makeRequester, makeTicket, makeUser } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

const prisma = getPrisma();

type Actor = { id: number; role: Role };
const cookie = (user: Actor) => cookieFor(user.id, user.role);
const dashboard = (user: Actor) => request(app).get("/api/dashboard/requester").set("Cookie", cookie(user));

// updatedAt is set by the database layer on every write, so tests that need a specific value write it directly.
async function ticket(requesterId: number, status: TicketStatus, opts: { updatedAt?: Date; resolvedAt?: Date | null } = {}) {
  const created = await makeTicket({ requesterId });
  await prisma.ticket.update({ where: { id: created.id }, data: { status, resolvedAt: opts.resolvedAt ?? null } });
  if (opts.updatedAt) await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = ${opts.updatedAt} WHERE id = ${created.id}`;
  return created;
}

const ACTIVE: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const NOT_ACTIVE: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("GET /api/dashboard/requester", () => {
  beforeEach(resetDb);

  describe("shape and calculation (BR-25)", () => {
    it("returns the documented shape with the Bangkok time zone and window start", async () => {
      const me = await makeRequester();
      const res = await dashboard(me);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["openTickets", "recentlyResolved", "recentlyUpdated", "timeZone", "waitingForRequester", "windowStart"]);
      expect(res.body.timeZone).toBe("Asia/Bangkok");
      expect(new Date(res.body.windowStart).getTime()).toBeLessThanOrEqual(Date.now() - 6 * 86_400_000);
      expect(new Date(res.body.windowStart).toISOString()).toBe(res.body.windowStart);
    });

    it("counts only active statuses as open Tickets and only Waiting for Requester as waiting", async () => {
      const me = await makeRequester();
      for (const status of [...ACTIVE, ...NOT_ACTIVE]) await ticket(me.id, status);
      await ticket(me.id, "WAITING_FOR_REQUESTER");

      const res = await dashboard(me);
      expect(res.body.openTickets.count).toBe(ACTIVE.length + 1); // the extra Waiting Ticket is active too
      expect(res.body.waitingForRequester.count).toBe(2);
    });

    it("lists up to 5 recently updated Tickets, newest first, with only the documented fields", async () => {
      const me = await makeRequester();
      const times = [1, 2, 3, 4, 5, 6, 0.5].map((d) => daysAgo(d));
      const made = [];
      for (const updatedAt of times) made.push(await ticket(me.id, "OPEN", { updatedAt }));

      const res = await dashboard(me);
      const items = res.body.recentlyUpdated.items;
      expect(items).toHaveLength(5);
      expect(items.map((i: { id: number }) => i.id)).toEqual([made[6], made[0], made[1], made[2], made[3]].map((t) => t.id));
      expect(Object.keys(items[0]).sort()).toEqual(["id", "itPriority", "status", "summary", "ticketNumber", "updatedAt"]);
    });

    it("lists recently resolved Tickets by resolvedAt, newest first, and ignores ones resolved before the window or since reopened", async () => {
      const me = await makeRequester();
      const recent = await ticket(me.id, "RESOLVED", { resolvedAt: daysAgo(1) });
      const newer = await ticket(me.id, "CLOSED", { resolvedAt: daysAgo(0.2) });
      await ticket(me.id, "RESOLVED", { resolvedAt: daysAgo(30) });
      await ticket(me.id, "REOPENED", { resolvedAt: null });

      const res = await dashboard(me);
      expect(res.body.recentlyResolved.items.map((i: { id: number }) => i.id)).toEqual([newer.id, recent.id]);
    });
  });

  describe("ownership (API-20, AC-02)", () => {
    it("only ever reports the signed-in Requester's own Tickets, counts and lists alike", async () => {
      const me = await makeRequester();
      const other = await makeRequester();
      const staff = await makeItStaff();
      await ticket(me.id, "OPEN");
      await ticket(me.id, "WAITING_FOR_REQUESTER");
      const mine = await ticket(me.id, "RESOLVED", { resolvedAt: daysAgo(1) });
      for (let i = 0; i < 4; i++) await ticket(other.id, "WAITING_FOR_REQUESTER");
      await ticket(other.id, "RESOLVED", { resolvedAt: daysAgo(1) });
      await prisma.ticket.updateMany({ where: { requesterId: other.id }, data: { ownerId: staff.id } });

      const res = await dashboard(me);
      expect(res.body.openTickets.count).toBe(2);
      expect(res.body.waitingForRequester.count).toBe(1);
      expect(res.body.recentlyResolved.items.map((i: { id: number }) => i.id)).toEqual([mine.id]);
      const everyId = [...res.body.recentlyUpdated.items, ...res.body.recentlyResolved.items].map((i: { id: number }) => i.id);
      const theirs = await prisma.ticket.findMany({ where: { requesterId: other.id }, select: { id: true } });
      for (const { id } of theirs) expect(everyId).not.toContain(id);
    });

    it("ignores any requester id, user id or query parameter the client sends", async () => {
      const me = await makeRequester();
      const other = await makeRequester();
      await ticket(other.id, "OPEN");
      const res = await request(app)
        .get(`/api/dashboard/requester?requesterId=${other.id}&userId=${other.id}`)
        .set("Cookie", cookie(me))
        .set("X-Requester-Id", String(other.id));
      expect(res.status).toBe(200);
      expect(res.body.openTickets.count).toBe(0);
    });
  });

  describe("empty behavior (API-22, AC-15, BR-28)", () => {
    it("a Requester with no Tickets gets zeros and empty lists — never null, never an error", async () => {
      const me = await makeRequester();
      const res = await dashboard(me);
      expect(res.status).toBe(200);
      expect(res.body.openTickets.count).toBe(0);
      expect(res.body.waitingForRequester.count).toBe(0);
      expect(res.body.recentlyUpdated.items).toEqual([]);
      expect(res.body.recentlyResolved.items).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain("null");
    });

    it("a legacy Requester whose Tickets have no Actions Taken is counted normally", async () => {
      const me = await makeRequester();
      await ticket(me.id, "IN_PROGRESS");
      expect((await dashboard(me)).body.openTickets.count).toBe(1);
    });
  });

  describe("recent window boundary (API-25, BR-23)", () => {
    it("includes a Ticket updated exactly at windowStart and excludes one a millisecond earlier", async () => {
      const me = await makeRequester();
      const probe = await dashboard(me);
      const windowStart = new Date(probe.body.windowStart);

      const inside = await ticket(me.id, "OPEN", { updatedAt: windowStart });
      const outside = await ticket(me.id, "OPEN", { updatedAt: new Date(windowStart.getTime() - 1) });

      const ids = (await dashboard(me)).body.recentlyUpdated.items.map((i: { id: number }) => i.id);
      expect(ids).toContain(inside.id);
      expect(ids).not.toContain(outside.id);
    });

    it("applies the same boundary to recently resolved", async () => {
      const me = await makeRequester();
      const windowStart = new Date((await dashboard(me)).body.windowStart);
      const inside = await ticket(me.id, "RESOLVED", { resolvedAt: windowStart });
      const outside = await ticket(me.id, "RESOLVED", { resolvedAt: new Date(windowStart.getTime() - 1) });

      const ids = (await dashboard(me)).body.recentlyResolved.items.map((i: { id: number }) => i.id);
      expect(ids).toContain(inside.id);
      expect(ids).not.toContain(outside.id);
    });
  });

  describe("drill-down links (API-23, AC-16, BR-29)", () => {
    it("each count card's link, used as My Tickets filters, lists exactly as many Tickets as the card says", async () => {
      const me = await makeRequester();
      for (const status of [...ACTIVE, ...NOT_ACTIVE, "WAITING_FOR_REQUESTER", "OPEN"] as TicketStatus[]) await ticket(me.id, status);
      const other = await makeRequester();
      await ticket(other.id, "WAITING_FOR_REQUESTER");

      const res = await dashboard(me);
      for (const card of [res.body.openTickets, res.body.waitingForRequester]) {
        const [path, query] = card.link.split("?");
        expect(path).toBe("/tickets");
        const list = await request(app).get(`/api/tickets?${query}&pageSize=50`).set("Cookie", cookie(me));
        expect(list.status).toBe(200);
        expect(list.body.totalItems, card.link).toBe(card.count);
      }
    });

    it("every documented link is an app route with a query that the API accepts", async () => {
      const me = await makeRequester();
      const res = await dashboard(me);
      for (const link of [res.body.openTickets.link, res.body.waitingForRequester.link, res.body.recentlyUpdated.link, res.body.recentlyResolved.link]) {
        expect(link.startsWith("/tickets?")).toBe(true);
        const list = await request(app).get(`/api/tickets?${link.split("?")[1]}`).set("Cookie", cookie(me));
        expect(list.status, link).toBe(200);
      }
    });
  });

  describe("authorization (AUTHZ-03, AUTHZ-02)", () => {
    it("IT Staff and Administrators get 403", async () => {
      const staff = await makeItStaff();
      const admin = await makeAdministrator();
      expect((await dashboard(staff)).status).toBe(403);
      expect((await dashboard(admin)).status).toBe(403);
    });

    it("unauthenticated is 401 and a user who must change their password is 403", async () => {
      const mustChange = await makeUser({ role: "REQUESTER", mustChangePassword: true });
      expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
      expect((await dashboard(mustChange)).status).toBe(403);
    });
  });
});

describe("My Tickets sorted by last update (FR-13, API-26 part)", () => {
  beforeEach(resetDb);

  it("sort=updatedAt orders by the last update, not the creation date, in both directions", async () => {
    const me = await makeRequester();
    const first = await ticket(me.id, "OPEN", { updatedAt: daysAgo(3) });
    const second = await ticket(me.id, "OPEN", { updatedAt: daysAgo(1) });
    const third = await ticket(me.id, "OPEN", { updatedAt: daysAgo(2) });

    const desc = await request(app).get("/api/tickets?sort=updatedAt:desc").set("Cookie", cookie(me));
    expect(desc.body.items.map((i: { id: number }) => i.id)).toEqual([second.id, third.id, first.id]);
    expect(desc.body.sort).toBe("updatedAt:desc");

    const asc = await request(app).get("/api/tickets?sort=updatedAt:asc").set("Cookie", cookie(me));
    expect(asc.body.items.map((i: { id: number }) => i.id)).toEqual([first.id, third.id, second.id]);
  });

  it("still rejects an unknown sort", async () => {
    const me = await makeRequester();
    expect((await request(app).get("/api/tickets?sort=updatedAt").set("Cookie", cookie(me))).status).toBe(400);
    expect((await request(app).get("/api/tickets?sort=password:asc").set("Cookie", cookie(me))).status).toBe(400);
  });
});
