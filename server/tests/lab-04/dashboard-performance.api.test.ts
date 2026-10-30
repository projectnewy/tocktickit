import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Priority, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";
import { makeAdministrator, makeItStaff, makeRequester } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

const prisma = getPrisma();

// PERF-01 (tests.md, BR-22): both dashboards on a larger dataset answer quickly and return short lists, never
// whole collections. A smoke test with a generous bound, not a benchmark: it catches a missing index or an
// unbounded query, not a few milliseconds.
const TICKETS = 360;
const ACTIONS = 720;
const LIMIT_MS = 1000;
const STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

describe("dashboards on a larger dataset (PERF-01)", () => {
  let requester: { id: number };
  let staff: { id: number };
  let admin: { id: number };

  beforeAll(async () => {
    await resetDb();
    requester = await makeRequester();
    const other = await makeRequester();
    staff = await makeItStaff();
    admin = await makeAdministrator();
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const now = Date.now();

    await prisma.ticket.createMany({
      data: Array.from({ length: TICKETS }, (_, i) => {
        const status = STATUSES[i % STATUSES.length];
        return {
          ticketNumber: `TKT-PERF-${String(i + 1).padStart(6, "0")}`,
          summary: `Performance ticket ${i + 1}`,
          description: "Generated for the dashboard performance smoke test.",
          requestedPriority: PRIORITIES[i % PRIORITIES.length],
          itPriority: PRIORITIES[(i + 1) % PRIORITIES.length],
          status,
          requesterId: i % 3 === 0 ? other.id : requester.id,
          ownerId: i % 4 === 0 ? null : staff.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date(now - (i % 6) * 86_400_000) : null,
          updatedAt: new Date(now - (i % 10) * 3_600_000 * 7),
        };
      }),
    });

    const ids = (await prisma.ticket.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
    await prisma.actionTaken.createMany({
      data: Array.from({ length: ACTIONS }, (_, i) => ({
        ticketId: ids[i % ids.length],
        createdById: staff.id,
        assigneeId: staff.id,
        status: i % 2 === 0 ? ("PLANNED" as const) : ("COMPLETED" as const),
        description: `Performance action ${i + 1}`,
        result: i % 2 === 0 ? null : "Done",
        performedById: i % 2 === 0 ? null : staff.id,
        actionDateTime: new Date(now - i * 60_000),
      })),
    });
  }, 60_000);

  const timed = async (path: string, userId: number, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") => {
    const started = performance.now();
    const res = await request(app).get(path).set("Cookie", cookieFor(userId, role));
    return { res, ms: performance.now() - started };
  };

  it("the dataset really is large", async () => {
    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(300);
    expect(await prisma.actionTaken.count()).toBeGreaterThanOrEqual(600);
  });

  it(`the Requester Dashboard answers in under ${LIMIT_MS} ms with lists capped at 5`, async () => {
    await timed("/api/dashboard/requester", requester.id, "REQUESTER"); // warm the connection and query plans
    const { res, ms } = await timed("/api/dashboard/requester", requester.id, "REQUESTER");

    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(LIMIT_MS);
    expect(res.body.recentlyUpdated.items.length).toBeLessThanOrEqual(5);
    expect(res.body.recentlyResolved.items.length).toBeLessThanOrEqual(5);
    expect(res.body.openTickets.count).toBeGreaterThan(5); // many Tickets counted, few returned
    expect(JSON.stringify(res.body).length).toBeLessThan(8_000);
  });

  it(`the IT Staff Dashboard answers in under ${LIMIT_MS} ms with every list capped at 5`, async () => {
    await timed("/api/dashboard/staff", staff.id, "IT_STAFF");
    const { res, ms } = await timed("/api/dashboard/staff", staff.id, "IT_STAFF");

    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(LIMIT_MS);
    for (const list of [res.body.urgentTickets.items, res.body.recentlyUpdated.items, res.body.myPlannedActions.items]) expect(list.length).toBeLessThanOrEqual(5);
    expect(res.body.myPlannedActions.count).toBeGreaterThan(5);
    expect(res.body.ownedByMe.count).toBeGreaterThan(5);
    expect(JSON.stringify(res.body).length).toBeLessThan(10_000);
  });

  it(`the Administrator's version, with account counts, is just as fast`, async () => {
    await timed("/api/dashboard/staff", admin.id, "ADMINISTRATOR");
    const { res, ms } = await timed("/api/dashboard/staff", admin.id, "ADMINISTRATOR");
    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(LIMIT_MS);
    expect(res.body.userCounts).toBeDefined();
  });

  it("the counts still match a direct query on the large dataset", async () => {
    const { res } = await timed("/api/dashboard/staff", staff.id, "IT_STAFF");
    const active = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as TicketStatus[];
    expect(res.body.ownedByMe.count).toBe(await prisma.ticket.count({ where: { ownerId: staff.id, status: { in: active } } }));
    expect(res.body.unassigned.count).toBe(await prisma.ticket.count({ where: { ownerId: null, status: { in: active } } }));
    expect(res.body.myPlannedActions.count).toBe(await prisma.actionTaken.count({ where: { assigneeId: staff.id, status: "PLANNED" } }));
  });
});
