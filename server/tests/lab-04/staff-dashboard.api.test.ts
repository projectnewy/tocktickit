import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Priority, Role, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";
import { makeAdministrator, makeItStaff, makeRequester, makeTicket, makeUser } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

const prisma = getPrisma();

type Actor = { id: number; role: Role };
const cookie = (user: Actor) => cookieFor(user.id, user.role);
const dashboard = (user: Actor) => request(app).get("/api/dashboard/staff").set("Cookie", cookie(user));

const ACTIVE: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const activeSql = "('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function ticket(requesterId: number, opts: { status?: TicketStatus; ownerId?: number | null; itPriority?: Priority; updatedAt?: Date } = {}) {
  const created = await makeTicket({ requesterId });
  await prisma.ticket.update({
    where: { id: created.id },
    data: { status: opts.status ?? "OPEN", ownerId: opts.ownerId ?? null, itPriority: opts.itPriority ?? "MEDIUM" },
  });
  if (opts.updatedAt) await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = ${opts.updatedAt} WHERE id = ${created.id}`;
  return created;
}

async function plannedAction(ticketId: number, assigneeId: number, actionDateTime: Date, status: "PLANNED" | "COMPLETED" = "PLANNED") {
  return prisma.actionTaken.create({
    data: { ticketId, createdById: assigneeId, assigneeId, status, description: `Action ${actionDateTime.toISOString()}`, actionDateTime, result: status === "COMPLETED" ? "Done" : null, performedById: status === "COMPLETED" ? assigneeId : null },
  });
}

const sqlCount = async (where: string) => {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "Ticket" WHERE ${where}`);
  return rows[0].n;
};

// A fixed, varied dataset used by the "matches direct database queries" tests.
async function seedVariedDataset() {
  const requester = await makeRequester();
  const me = await makeItStaff();
  const other = await makeItStaff();
  const statuses: TicketStatus[] = ["NEW", "NEW", "OPEN", "OPEN", "OPEN", "IN_PROGRESS", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"];
  const priorities: Priority[] = ["URGENT", "LOW", "HIGH", "URGENT", "MEDIUM", "LOW", "URGENT", "HIGH", "MEDIUM", "URGENT", "LOW", "HIGH"];
  const owners = [null, null, me.id, other.id, me.id, me.id, other.id, null, other.id, me.id, other.id, null];
  for (let i = 0; i < statuses.length; i++) {
    const t = await ticket(requester.id, { status: statuses[i], itPriority: priorities[i], ownerId: owners[i] });
    if (i < 4) await plannedAction(t.id, me.id, daysAgo(i));
  }
  return { requester, me, other };
}

describe("GET /api/dashboard/staff", () => {
  beforeEach(resetDb);

  describe("shape", () => {
    it("returns the documented keys for IT Staff, without account counts", async () => {
      const staff = await makeItStaff();
      const res = await dashboard(staff);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ["byItPriority", "byStatus", "myPlannedActions", "ownedByMe", "recentlyUpdated", "timeZone", "unassigned", "urgentTickets", "windowStart"]
      );
      expect(res.body.timeZone).toBe("Asia/Bangkok");
      expect(res.body.userCounts).toBeUndefined();
    });

    it("always lists all five active statuses and all four priorities, in order, with their links", async () => {
      const staff = await makeItStaff();
      const res = await dashboard(staff);
      expect(res.body.byStatus.map((r: { status: string }) => r.status)).toEqual(ACTIVE);
      expect(res.body.byStatus.map((r: { link: string }) => r.link)).toEqual(ACTIVE.map((s) => `/staff/tickets?status=${s}`));
      expect(res.body.byItPriority.map((r: { itPriority: string }) => r.itPriority)).toEqual(PRIORITIES);
    });
  });

  describe("metrics match direct database queries (API-21, AC-14)", () => {
    it("every count and list equals what separate SQL returns", async () => {
      const { me } = await seedVariedDataset();
      const res = await dashboard(me);
      const b = res.body;

      expect(b.unassigned.count).toBe(await sqlCount(`"ownerId" IS NULL AND status IN ${activeSql}`));
      expect(b.ownedByMe.count).toBe(await sqlCount(`"ownerId" = ${me.id} AND status IN ${activeSql}`));
      for (const row of b.byStatus) expect(row.count, row.status).toBe(await sqlCount(`status = '${row.status}'`));
      for (const row of b.byItPriority) expect(row.count, row.itPriority).toBe(await sqlCount(`"itPriority" = '${row.itPriority}' AND status IN ${activeSql}`));

      const urgentIds = await prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM "Ticket" WHERE "itPriority" = 'URGENT' AND status IN ${activeSql} ORDER BY "updatedAt" DESC, id DESC LIMIT 5`
      );
      expect(b.urgentTickets.items.map((i: { id: number }) => i.id)).toEqual(urgentIds.map((r) => r.id));

      const planned = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "ActionTaken" WHERE "assigneeId" = ${me.id} AND status = 'PLANNED'`);
      expect(b.myPlannedActions.count).toBe(planned[0].n);
      expect(planned[0].n).toBe(4);
    });

    it("ownedByMe and My Planned Actions belong to the signed-in user, not to everyone", async () => {
      const { me, other } = await seedVariedDataset();
      const mine = await dashboard(me);
      const theirs = await dashboard(other);
      expect(mine.body.ownedByMe.count).toBe(await sqlCount(`"ownerId" = ${me.id} AND status IN ${activeSql}`));
      expect(theirs.body.ownedByMe.count).toBe(await sqlCount(`"ownerId" = ${other.id} AND status IN ${activeSql}`));
      expect(mine.body.myPlannedActions.count).toBe(4);
      expect(theirs.body.myPlannedActions.count).toBe(0);
      expect(theirs.body.unassigned.count).toBe(mine.body.unassigned.count); // shared, not per user
    });

    it("an Administrator sees the same metrics as IT Staff", async () => {
      const { me } = await seedVariedDataset();
      const admin = await makeAdministrator();
      const asStaff = (await dashboard(me)).body;
      const asAdmin = (await dashboard(admin)).body;
      expect(asAdmin.unassigned).toEqual(asStaff.unassigned);
      expect(asAdmin.byStatus).toEqual(asStaff.byStatus);
      expect(asAdmin.byItPriority).toEqual(asStaff.byItPriority);
    });
  });

  describe("lists", () => {
    it("urgent Tickets: only active Urgent ones, newest update first, at most 5, with the owner", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ids: number[] = [];
      for (let i = 1; i <= 7; i++) ids.push((await ticket(requester.id, { itPriority: "URGENT", ownerId: staff.id, updatedAt: daysAgo(i) })).id);
      await ticket(requester.id, { itPriority: "URGENT", status: "RESOLVED" }); // not active
      await ticket(requester.id, { itPriority: "HIGH" }); // not urgent

      const items = (await dashboard(staff)).body.urgentTickets.items;
      expect(items.map((i: { id: number }) => i.id)).toEqual(ids.slice(0, 5));
      expect(items[0].owner).toEqual({ id: staff.id, fullName: staff.fullName });
      expect(Object.keys(items[0]).sort()).toEqual(["id", "itPriority", "owner", "status", "summary", "ticketNumber", "updatedAt"]);
    });

    it("recently updated: any status, newest first, at most 5, inside the Bangkok window only (API-25)", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const windowStart = new Date((await dashboard(staff)).body.windowStart);
      const inside = await ticket(requester.id, { status: "CLOSED", updatedAt: windowStart });
      const outside = await ticket(requester.id, { updatedAt: new Date(windowStart.getTime() - 1) });
      for (let i = 0; i < 6; i++) await ticket(requester.id, { updatedAt: new Date(Date.now() - (i + 1) * 3_600_000) });

      const ids = (await dashboard(staff)).body.recentlyUpdated.items.map((i: { id: number }) => i.id);
      expect(ids).toHaveLength(5);
      expect(ids).not.toContain(outside.id);
      const limited = await prisma.ticket.findMany({ where: { updatedAt: { gte: windowStart } } });
      expect(limited.map((t) => t.id)).toContain(inside.id);
    });

    it("My Planned Actions: only mine, only Planned, earliest first, the count is the full total while the list is capped at 5", async () => {
      const requester = await makeRequester();
      const me = await makeItStaff();
      const other = await makeItStaff();
      const t = await ticket(requester.id, { ownerId: me.id });
      const actions = [];
      for (const day of [6, 2, 5, 1, 4, 3, 7]) actions.push(await plannedAction(t.id, me.id, daysAgo(day)));
      await plannedAction(t.id, me.id, daysAgo(9), "COMPLETED");
      await plannedAction(t.id, other.id, daysAgo(8));

      const planned = (await dashboard(me)).body.myPlannedActions;
      expect(planned.count).toBe(7);
      expect(planned.items).toHaveLength(5);
      const byDateAsc = [...actions].sort((a, b) => a.actionDateTime.getTime() - b.actionDateTime.getTime()).slice(0, 5);
      expect(planned.items.map((i: { id: number }) => i.id)).toEqual(byDateAsc.map((a) => a.id));
      expect(planned.items[0]).toMatchObject({ ticketId: t.id, ticketNumber: t.ticketNumber });
      expect(Object.keys(planned.items[0]).sort()).toEqual(["actionDateTime", "description", "id", "ticketId", "ticketNumber"]);
    });
  });

  describe("empty behavior (API-22, AC-15, BR-28)", () => {
    it("with nothing in the system, counts are 0, every row is still listed, and lists are empty — never null", async () => {
      const staff = await makeItStaff();
      const res = await dashboard(staff);
      expect(res.status).toBe(200);
      expect(res.body.unassigned.count).toBe(0);
      expect(res.body.ownedByMe.count).toBe(0);
      expect(res.body.byStatus.every((r: { count: number }) => r.count === 0)).toBe(true);
      expect(res.body.byItPriority.every((r: { count: number }) => r.count === 0)).toBe(true);
      expect(res.body.urgentTickets.items).toEqual([]);
      expect(res.body.recentlyUpdated.items).toEqual([]);
      expect(res.body.myPlannedActions).toEqual({ count: 0, items: [] });
      expect(JSON.stringify(res.body)).not.toContain("null");
    });
  });

  describe("drill-down links (API-23, AC-16, BR-29)", () => {
    it("every count's link, used as Ticket Queue filters, lists exactly as many Tickets as the count says", async () => {
      const { me } = await seedVariedDataset();
      const b = (await dashboard(me)).body;
      const countLinks: { label: string; count: number; link: string }[] = [
        { label: "unassigned", ...b.unassigned },
        { label: "ownedByMe", ...b.ownedByMe },
        ...b.byStatus.map((r: { status: string; count: number; link: string }) => ({ label: r.status, count: r.count, link: r.link })),
        ...b.byItPriority.map((r: { itPriority: string; count: number; link: string }) => ({ label: r.itPriority, count: r.count, link: r.link })),
      ];
      expect(countLinks.length).toBe(2 + 5 + 4);
      for (const { label, count, link } of countLinks) {
        const [path, query] = link.split("?");
        expect(path).toBe("/staff/tickets");
        const list = await request(app).get(`/api/staff/tickets?${query}&pageSize=50`).set("Cookie", cookie(me));
        expect(list.status, `${label} ${link}`).toBe(200);
        expect(list.body.totalItems, `${label} ${link}`).toBe(count);
      }
    });

    it("the list links (urgent, recently updated) are valid Ticket Queue queries", async () => {
      const staff = await makeItStaff();
      const b = (await dashboard(staff)).body;
      for (const link of [b.urgentTickets.link, b.recentlyUpdated.link]) {
        const res = await request(app).get(`/api/staff/tickets?${link.split("?")[1]}`).set("Cookie", cookie(staff));
        expect(res.status, link).toBe(200);
      }
    });
  });

  describe("user account counts (API-24, BR-27)", () => {
    it("only an Administrator gets them, and they match the database", async () => {
      const staff = await makeItStaff();
      const admin = await makeAdministrator();
      await makeRequester();
      await makeRequester();
      await makeRequester({ isActive: false });
      await makeItStaff({ isActive: false });

      const adminRes = await dashboard(admin);
      const expected = {
        REQUESTER: await prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
        IT_STAFF: await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }),
        ADMINISTRATOR: await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }),
        inactive: await prisma.user.count({ where: { isActive: false } }),
      };
      expect(adminRes.body.userCounts).toEqual(expected);
      expect(expected.inactive).toBeGreaterThanOrEqual(2);
      expect((await dashboard(staff)).body).not.toHaveProperty("userCounts");
    });
  });

  describe("authorization (AUTHZ-03, AUTHZ-02)", () => {
    it("a Requester gets 403 and nothing about anyone else's work", async () => {
      const requester = await makeRequester();
      await seedVariedDataset();
      const res = await dashboard(requester);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/count|items/);
    });

    it("unauthenticated is 401 and a user who must change their password is 403", async () => {
      const mustChange = await makeUser({ role: "IT_STAFF", mustChangePassword: true });
      expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
      expect((await dashboard(mustChange)).status).toBe(403);
    });
  });
});

describe("Ticket Queue drill-down parameters (FR-13, API-26)", () => {
  beforeEach(resetDb);
  const queue = (user: Actor, qs: string) => request(app).get(`/api/staff/tickets?${qs}`).set("Cookie", cookie(user));

  it("itPriority filters by one or several priorities", async () => {
    const requester = await makeRequester();
    const staff = await makeItStaff();
    await ticket(requester.id, { itPriority: "URGENT" });
    await ticket(requester.id, { itPriority: "URGENT" });
    await ticket(requester.id, { itPriority: "HIGH" });
    await ticket(requester.id, { itPriority: "LOW" });

    expect((await queue(staff, "itPriority=URGENT")).body.totalItems).toBe(2);
    expect((await queue(staff, "itPriority=URGENT&itPriority=HIGH")).body.totalItems).toBe(3);
    expect((await queue(staff, "")).body.totalItems).toBe(4);
  });

  it("combines with status and owner filters", async () => {
    const requester = await makeRequester();
    const staff = await makeItStaff();
    await ticket(requester.id, { itPriority: "URGENT", status: "OPEN", ownerId: staff.id });
    await ticket(requester.id, { itPriority: "URGENT", status: "RESOLVED", ownerId: staff.id });
    await ticket(requester.id, { itPriority: "URGENT", status: "OPEN", ownerId: null });
    expect((await queue(staff, "itPriority=URGENT&status=OPEN&ownerId=me")).body.totalItems).toBe(1);
  });

  it("rejects an unknown priority with 400 instead of ignoring it", async () => {
    const staff = await makeItStaff();
    expect((await queue(staff, "itPriority=EXTREME")).status).toBe(400);
  });

  it("sort=updatedAt orders by the last update, not the creation date, in both directions", async () => {
    const requester = await makeRequester();
    const staff = await makeItStaff();
    const first = await ticket(requester.id, { updatedAt: daysAgo(3) });
    const second = await ticket(requester.id, { updatedAt: daysAgo(1) });
    const third = await ticket(requester.id, { updatedAt: daysAgo(2) });

    expect((await queue(staff, "sort=updatedAt:desc")).body.items.map((i: { id: number }) => i.id)).toEqual([second.id, third.id, first.id]);
    expect((await queue(staff, "sort=updatedAt:asc")).body.items.map((i: { id: number }) => i.id)).toEqual([first.id, third.id, second.id]);
    expect((await queue(staff, "sort=updatedAt")).status).toBe(400);
  });
});
