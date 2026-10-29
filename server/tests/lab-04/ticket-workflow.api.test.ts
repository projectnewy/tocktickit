import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Role, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";
import { makeAdministrator, makeItStaff, makeRequester, makeTicket } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

const prisma = getPrisma();

type Actor = { id: number; role: Role };
const cookie = (user: Actor) => cookieFor(user.id, user.role);

const status = (ticketId: number, user: Actor, body: object) =>
  request(app).patch(`/api/staff/tickets/${ticketId}/status`).set("Cookie", cookie(user)).send(body);
const claim = (ticketId: number, user: Actor, body: object) =>
  request(app).patch(`/api/staff/tickets/${ticketId}/claim`).set("Cookie", cookie(user)).send(body);
const priority = (ticketId: number, user: Actor, body: object) =>
  request(app).patch(`/api/staff/tickets/${ticketId}/priority`).set("Cookie", cookie(user)).send(body);
const indicate = (ticketId: number, user: Actor) =>
  request(app).post(`/api/tickets/${ticketId}/resolution-indication`).set("Cookie", cookie(user));

async function ticketIn(statusValue: TicketStatus, requesterId: number, ownerId?: number) {
  const ticket = await makeTicket({ requesterId });
  return prisma.ticket.update({ where: { id: ticket.id }, data: { status: statusValue, ownerId } });
}

async function addAction(ticketId: number, userId: number, actionStatus: "PLANNED" | "COMPLETED" | "CANCELLED") {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      createdById: userId,
      assigneeId: userId,
      status: actionStatus,
      description: `${actionStatus} action`,
      result: actionStatus === "COMPLETED" ? "Done" : null,
      performedById: actionStatus === "COMPLETED" ? userId : null,
    },
  });
}

const reload = (ticketId: number) => prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

const ALL: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
// specification.md §5.3, transcribed independently of the service's table.
const ALLOWED = new Set([
  "NEW->OPEN", "NEW->CANCELLED", "OPEN->CANCELLED", "OPEN->IN_PROGRESS", "IN_PROGRESS->WAITING_FOR_REQUESTER",
  "WAITING_FOR_REQUESTER->IN_PROGRESS", "IN_PROGRESS->RESOLVED", "WAITING_FOR_REQUESTER->RESOLVED",
  "RESOLVED->CLOSED", "RESOLVED->REOPENED", "CLOSED->REOPENED", "REOPENED->IN_PROGRESS",
]);

describe("Ticket workflow API", () => {
  beforeEach(resetDb);

  describe("version on Ticket detail (BR-19)", () => {
    it("staff and Requester detail responses include version and resolvedAt", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const asStaff = await request(app).get(`/api/staff/tickets/${ticket.id}`).set("Cookie", cookie(staff));
      const asRequester = await request(app).get(`/api/tickets/${ticket.id}`).set("Cookie", cookie(requester));
      for (const res of [asStaff, asRequester]) {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ version: 0, resolvedAt: null });
      }
    });

    it("claim, priority and status require a version", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      expect((await claim(ticket.id, staff, {})).status).toBe(400);
      expect((await priority(ticket.id, staff, { itPriority: "HIGH" })).status).toBe(400);
      expect((await status(ticket.id, staff, { status: "IN_PROGRESS" })).status).toBe(400);
      expect((await status(ticket.id, staff, { status: "IN_PROGRESS", version: "0" })).status).toBe(400);
      expect((await reload(ticket.id)).version).toBe(0);
    });

    it("every successful write bumps the version by exactly 1 and returns the full Ticket detail", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("NEW", requester.id);

      const claimed = await claim(ticket.id, staff, { version: 0 });
      expect(claimed.status).toBe(200);
      expect(claimed.body).toMatchObject({ status: "OPEN", version: 1, ticketOwner: { id: staff.id } });

      const prioritised = await priority(ticket.id, staff, { version: 1, itPriority: "URGENT" });
      expect(prioritised.body).toMatchObject({ itPriority: "URGENT", version: 2 });

      const moved = await status(ticket.id, staff, { version: 2, status: "IN_PROGRESS" });
      expect(moved.body).toMatchObject({ status: "IN_PROGRESS", version: 3 });
    });
  });

  describe("stale updates (WF-01, WF-02, AC-09)", () => {
    it("WF-01: the second staff member using the old version gets 409 STALE_VERSION on status, owner and priority", async () => {
      const requester = await makeRequester();
      const first = await makeItStaff();
      const second = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, first.id);

      expect((await status(ticket.id, first, { version: 0, status: "IN_PROGRESS" })).status).toBe(200);

      const results = [
        await status(ticket.id, second, { version: 0, status: "CANCELLED" }),
        await claim(ticket.id, second, { version: 0 }),
        await priority(ticket.id, second, { version: 0, itPriority: "LOW" }),
      ];
      for (const res of results) {
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "STALE_VERSION", currentVersion: 1 });
      }
      const after = await reload(ticket.id);
      expect(after).toMatchObject({ status: "IN_PROGRESS", ownerId: first.id, version: 1 });
    });

    it("WF-02: two staff claiming the same New Ticket at once — exactly one wins", async () => {
      const requester = await makeRequester();
      const a = await makeItStaff();
      const b = await makeItStaff();
      const ticket = await ticketIn("NEW", requester.id);

      const [ra, rb] = await Promise.all([claim(ticket.id, a, { version: 0 }), claim(ticket.id, b, { version: 0 })]);
      const winners = [ra, rb].filter((r) => r.status === 200);
      const losers = [ra, rb].filter((r) => r.status === 409);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0].body.code).toBe("STALE_VERSION");

      const after = await reload(ticket.id);
      expect(after.version).toBe(1);
      expect(after.ownerId).toBe(winners[0] === ra ? a.id : b.id);
    });
  });

  describe("resolution gate (WF-03, WF-04, AC-10, AC-11)", () => {
    it("WF-03: Resolved is refused with the reasons when nothing is completed, when work is planned, and both; the Ticket is unchanged", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();

      const none = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      const noneRes = await status(none.id, staff, { version: 0, status: "RESOLVED" });
      expect(noneRes.status).toBe(409);
      expect(noneRes.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["NO_COMPLETED_ACTION"] });

      const planned = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      await addAction(planned.id, staff.id, "COMPLETED");
      await addAction(planned.id, staff.id, "PLANNED");
      const plannedRes = await status(planned.id, staff, { version: 0, status: "RESOLVED" });
      expect(plannedRes.status).toBe(409);
      expect(plannedRes.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["OPEN_PLANNED_ACTIONS"] });

      const both = await ticketIn("WAITING_FOR_REQUESTER", requester.id, staff.id);
      await addAction(both.id, staff.id, "PLANNED");
      await addAction(both.id, staff.id, "CANCELLED");
      const bothRes = await status(both.id, staff, { version: 0, status: "RESOLVED" });
      expect(bothRes.body).toMatchObject({ code: "RESOLUTION_GATE", unmet: ["NO_COMPLETED_ACTION", "OPEN_PLANNED_ACTIONS"] });

      for (const [t, expected] of [[none, "IN_PROGRESS"], [planned, "IN_PROGRESS"], [both, "WAITING_FOR_REQUESTER"]] as const) {
        expect(await reload(t.id)).toMatchObject({ status: expected, version: 0, resolvedAt: null });
      }
    });

    it("WF-03: cancelled actions do not count as completed work", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      await addAction(ticket.id, staff.id, "CANCELLED");
      const res = await status(ticket.id, staff, { version: 0, status: "RESOLVED" });
      expect(res.body.unmet).toEqual(["NO_COMPLETED_ACTION"]);
    });

    it("WF-04: with a Completed action and no Planned one, Resolved succeeds without a Requester indication, then Closed keeps resolvedAt", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      await addAction(ticket.id, staff.id, "COMPLETED");

      const resolved = await status(ticket.id, staff, { version: 0, status: "RESOLVED" });
      expect(resolved.status).toBe(200);
      expect(resolved.body).toMatchObject({ status: "RESOLVED", version: 1, resolutionIndicated: false });
      expect(resolved.body.resolvedAt).toBeTruthy();

      const closed = await status(ticket.id, staff, { version: 1, status: "CLOSED" });
      expect(closed.status).toBe(200);
      expect(closed.body.status).toBe("CLOSED");
      expect(closed.body.resolvedAt).toBe(resolved.body.resolvedAt);
    });

    it("an Administrator resolves under the same gate", async () => {
      const requester = await makeRequester();
      const admin = await makeAdministrator();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, admin.id);
      expect((await status(ticket.id, admin, { version: 0, status: "RESOLVED" })).status).toBe(409);
      await addAction(ticket.id, admin.id, "COMPLETED");
      expect((await status(ticket.id, admin, { version: 0, status: "RESOLVED" })).status).toBe(200);
    });
  });

  describe("transition matrix (WF-05, BR-13)", () => {
    it("WF-05: every pair outside the matrix is 409 INVALID_TRANSITION and leaves the Ticket unchanged", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      let checked = 0;
      for (const from of ALL) {
        const ticket = await ticketIn(from, requester.id, from === "NEW" ? undefined : staff.id);
        for (const to of ALL) {
          if (ALLOWED.has(`${from}->${to}`)) continue;
          const res = await status(ticket.id, staff, { version: 0, status: to });
          expect(res.status, `${from} -> ${to}`).toBe(409);
          expect(res.body.code, `${from} -> ${to}`).toBe("INVALID_TRANSITION");
          checked++;
        }
        expect(await reload(ticket.id)).toMatchObject({ status: from, version: 0 });
      }
      expect(checked).toBe(64 - 12);
    });

    it("WF-05: a Requester can never change status, even for a permitted pair or their own Ticket", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const res = await status(ticket.id, requester, { version: 0, status: "IN_PROGRESS" });
      expect(res.status).toBe(403);
      expect((await reload(ticket.id)).status).toBe("OPEN");
    });

    it("walks the permitted lifecycle end to end", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("NEW", requester.id);
      let version = 0;
      const step = async (user: Actor, to: TicketStatus) => {
        const res = await status(ticket.id, user, { version, status: to });
        expect(res.status, `-> ${to}`).toBe(200);
        version = res.body.version;
      };
      await step(staff, "OPEN");
      await step(staff, "IN_PROGRESS");
      await step(staff, "WAITING_FOR_REQUESTER");
      await step(staff, "IN_PROGRESS");
      await addAction(ticket.id, staff.id, "COMPLETED");
      await step(staff, "RESOLVED");
      await step(staff, "CLOSED");
      await step(staff, "REOPENED");
      await step(staff, "IN_PROGRESS");
      expect(version).toBe(8);
    });
  });

  describe("Requester resolution indication (WF-06, BR-15, AC-12)", () => {
    it("WF-06: sets only the advisory flag, never the status, and bumps the Ticket version", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);

      const res = await indicate(ticket.id, requester);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ resolutionIndicated: true, status: "IN_PROGRESS", version: 1 });
    });

    it.each(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as TicketStatus[])("WF-06: accepted while the Ticket is %s", async (s) => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn(s, requester.id, staff.id);
      expect((await indicate(ticket.id, requester)).status).toBe(200);
      expect((await reload(ticket.id)).status).toBe(s);
    });

    it.each(["NEW", "RESOLVED", "CLOSED", "CANCELLED"] as TicketStatus[])("WF-06: refused with 409 while the Ticket is %s", async (s) => {
      const requester = await makeRequester();
      const ticket = await ticketIn(s, requester.id);
      const res = await indicate(ticket.id, requester);
      expect(res.status).toBe(409);
      expect(await reload(ticket.id)).toMatchObject({ status: s, resolutionIndicated: false, version: 0 });
    });

    it("WF-06: a staff member holding the older copy then gets 409 STALE_VERSION", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);

      await indicate(ticket.id, requester);
      const res = await priority(ticket.id, staff, { version: 0, itPriority: "HIGH" });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: "STALE_VERSION", currentVersion: 1 });
    });

    it("WF-06: the indication does not satisfy the gate, and IT Staff cannot indicate", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      await indicate(ticket.id, requester);

      const gate = await status(ticket.id, staff, { version: 1, status: "RESOLVED" });
      expect(gate.status).toBe(409);
      expect(gate.body.code).toBe("RESOLUTION_GATE");
      expect((await indicate(ticket.id, staff)).status).toBe(403);
    });

    it("another Requester gets 404 for a Ticket that is not theirs", async () => {
      const owner = await makeRequester();
      const other = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", owner.id, staff.id);
      expect((await indicate(ticket.id, other)).status).toBe(404);
    });
  });

  describe("cancel and reopen (WF-07, WF-08, BR-16..18)", () => {
    it.each(["NEW", "OPEN"] as TicketStatus[])("WF-07: cancelling a %s Ticket cancels its Planned actions and leaves other actions alone", async (from) => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn(from, requester.id, staff.id);
      const planned1 = await addAction(ticket.id, staff.id, "PLANNED");
      const planned2 = await addAction(ticket.id, staff.id, "PLANNED");
      const completed = await addAction(ticket.id, staff.id, "COMPLETED");

      const res = await status(ticket.id, staff, { version: 0, status: "CANCELLED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");

      const actions = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } });
      expect(actions.map((a) => [a.id, a.status])).toEqual([
        [planned1.id, "CANCELLED"],
        [planned2.id, "CANCELLED"],
        [completed.id, "COMPLETED"],
      ]);
      expect(actions[0].version).toBe(1);
    });

    it("WF-07: a refused cancel (stale version) leaves the Planned actions Planned", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      await addAction(ticket.id, staff.id, "PLANNED");
      const res = await status(ticket.id, staff, { version: 5, status: "CANCELLED" });
      expect(res.status).toBe(409);
      expect((await prisma.actionTaken.findFirstOrThrow({ where: { ticketId: ticket.id } })).status).toBe("PLANNED");
    });

    it.each(["RESOLVED", "CLOSED"] as TicketStatus[])("WF-08: reopening from %s clears resolvedAt and resolutionIndicated", async (from) => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await prisma.ticket.update({
        where: { id: (await makeTicket({ requesterId: requester.id })).id },
        data: { status: from, ownerId: staff.id, resolutionIndicated: true, resolvedAt: new Date() },
      });
      const res = await status(ticket.id, staff, { version: 0, status: "REOPENED" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "REOPENED", resolvedAt: null, resolutionIndicated: false });
    });
  });

  describe("gate under concurrency (WF-09, BR-14)", () => {
    it("never ends Resolved with a Planned action when a resolve and an add race", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const other = await makeItStaff();

      for (let round = 0; round < 12; round++) {
        const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);
        await addAction(ticket.id, staff.id, "COMPLETED");

        const [resolve, add] = await Promise.all([
          status(ticket.id, staff, { version: 0, status: "RESOLVED" }),
          request(app).post(`/api/tickets/${ticket.id}/actions`).set("Cookie", cookie(other)).send({ description: "Late planned work" }),
        ]);

        expect([200, 409]).toContain(resolve.status);
        expect([201, 409]).toContain(add.status);
        const after = await reload(ticket.id);
        const planned = await prisma.actionTaken.count({ where: { ticketId: ticket.id, status: "PLANNED" } });
        expect(after.status === "RESOLVED" && planned > 0, `round ${round}: ${after.status} with ${planned} planned`).toBe(false);
        // Exactly one of the two won the race.
        expect(resolve.status === 200 && add.status === 201).toBe(false);
        if (resolve.status === 409) expect(resolve.body.code).toBe("RESOLUTION_GATE");
        if (add.status === 409) expect(add.body.code).toBe("TICKET_NOT_ACTIONABLE");
      }
    });
  });

  describe("IT Priority default (WF-10, BR-34)", () => {
    it("a new Ticket's IT Priority starts as the requested priority", async () => {
      const requester = await makeRequester();
      const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
      const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });

      for (const requestedPriority of ["LOW", "HIGH", "URGENT"]) {
        const res = await request(app)
          .post("/api/tickets")
          .set("Cookie", cookie(requester))
          .send({ summary: "Printer is jammed", description: "The printer on floor three jams on every job.", requestedPriority, categoryId: category.id, relatedSystemId: system.id });
        expect(res.status).toBe(201);
        expect(res.body.itPriority).toBe(requestedPriority);
        expect(res.body.version).toBe(0);
      }
    });
  });
});
