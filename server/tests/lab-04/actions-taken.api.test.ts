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

const asUser = (user: Actor) => cookieFor(user.id, user.role);
const post = (ticketId: number, user: Actor, body: object) =>
  request(app).post(`/api/tickets/${ticketId}/actions`).set("Cookie", asUser(user)).send(body);
const patch = (ticketId: number, actionId: number, user: Actor, body: object) =>
  request(app).patch(`/api/tickets/${ticketId}/actions/${actionId}`).set("Cookie", asUser(user)).send(body);
const list = (ticketId: number, user: Actor) => request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", asUser(user));

async function ticketIn(status: TicketStatus, requesterId: number, ownerId?: number) {
  const ticket = await makeTicket({ requesterId });
  return prisma.ticket.update({ where: { id: ticket.id }, data: { status, ownerId } });
}

async function actionCount(ticketId?: number) {
  return prisma.actionTaken.count(ticketId ? { where: { ticketId } } : undefined);
}

async function seedAction(ticketId: number, userId: number, overrides: Partial<{ description: string; actionDateTime: Date; status: "PLANNED" | "COMPLETED" | "CANCELLED"; result: string }> = {}) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      createdById: userId,
      assigneeId: userId,
      description: overrides.description ?? "Seeded action",
      actionDateTime: overrides.actionDateTime,
      status: overrides.status ?? "PLANNED",
      result: overrides.result,
      performedById: overrides.status === "COMPLETED" ? userId : undefined,
    },
  });
}

describe("Actions Taken API", () => {
  beforeEach(resetDb);

  describe("create (API-01, API-02, API-03)", () => {
    it("API-01: IT Staff creates an action on an Open Ticket with the authenticated creator and default assignee", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const res = await post(ticket.id, staff, { description: "Replace the faulty access point" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        ticketId: ticket.id,
        status: "PLANNED",
        description: "Replace the faulty access point",
        result: null,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        version: 0,
        createdBy: { id: staff.id, fullName: staff.fullName },
        assignee: { id: staff.id, fullName: staff.fullName },
        performedBy: null,
      });
      expect(res.body.actionDateTime).toBeTruthy();
      expect(await actionCount(ticket.id)).toBe(1);
    });

    it("API-01: assigns to another active IT Staff or Administrator, and an Administrator can create", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const other = await makeItStaff();
      const admin = await makeAdministrator();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);

      const toStaff = await post(ticket.id, staff, { description: "Check cabling", assigneeId: other.id });
      expect(toStaff.status).toBe(201);
      expect(toStaff.body.assignee.id).toBe(other.id);
      expect(toStaff.body.createdBy.id).toBe(staff.id);

      const byAdmin = await post(ticket.id, admin, { description: "Audit config", assigneeId: admin.id });
      expect(byAdmin.status).toBe(201);
      expect(byAdmin.body.createdBy.id).toBe(admin.id);
    });

    it("API-01: stores follow-up, attachment notes and a completed action with its result", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const res = await post(ticket.id, staff, {
        description: "Replaced the access point",
        status: "COMPLETED",
        result: "Signal restored",
        followUpRequired: true,
        followUpNote: "Verify signal after 24h",
        attachmentNotes: "See the survey PNG on the Ticket",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: "COMPLETED",
        result: "Signal restored",
        followUpRequired: true,
        followUpNote: "Verify signal after 24h",
        attachmentNotes: "See the survey PNG on the Ticket",
        performedBy: { id: staff.id },
      });
    });

    it("API-02: a non-owner IT Staff creates and completes an action; Performed By is the completer, Owner unchanged", async () => {
      const requester = await makeRequester();
      const owner = await makeItStaff();
      const colleague = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, owner.id);

      const created = await post(ticket.id, colleague, { description: "Swap the switch", assigneeId: colleague.id });
      expect(created.status).toBe(201);

      const done = await patch(ticket.id, created.body.id, colleague, { version: 0, status: "COMPLETED", result: "Switch swapped" });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ status: "COMPLETED", version: 1, performedBy: { id: colleague.id }, createdBy: { id: colleague.id } });

      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.ownerId).toBe(owner.id);
    });

    it("API-03: client-supplied createdBy/performedBy/version/status-bookkeeping are ignored", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const other = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const res = await post(ticket.id, staff, {
        description: "Spoof attempt",
        createdById: other.id,
        createdBy: { id: other.id },
        performedById: other.id,
        performedBy: { id: other.id },
        version: 99,
        id: 12345,
        createdAt: "2000-01-01T00:00:00.000Z",
      });

      expect(res.status).toBe(201);
      expect(res.body.createdBy.id).toBe(staff.id);
      expect(res.body.performedBy).toBeNull();
      expect(res.body.version).toBe(0);
      expect(res.body.id).not.toBe(12345);
      expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2000);

      const patched = await patch(ticket.id, res.body.id, staff, { version: 0, description: "Edited", performedById: other.id, createdById: other.id });
      expect(patched.status).toBe(200);
      expect(patched.body.createdBy.id).toBe(staff.id);
      expect(patched.body.performedBy).toBeNull();
    });
  });

  describe("list (API-04, API-05)", () => {
    it("API-04: the owning Requester sees all actions and all fields, ordered by date then id", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("IN_PROGRESS", requester.id, staff.id);
      const late = await seedAction(ticket.id, staff.id, { description: "late", actionDateTime: new Date("2026-10-03T10:00:00Z") });
      const sameA = await seedAction(ticket.id, staff.id, { description: "same-a", actionDateTime: new Date("2026-10-02T10:00:00Z") });
      const sameB = await seedAction(ticket.id, staff.id, { description: "same-b", actionDateTime: new Date("2026-10-02T10:00:00Z") });
      const early = await seedAction(ticket.id, staff.id, { description: "early", actionDateTime: new Date("2026-10-01T10:00:00Z") });

      const res = await list(ticket.id, requester);

      expect(res.status).toBe(200);
      expect(res.body.map((a: { id: number }) => a.id)).toEqual([early.id, sameA.id, sameB.id, late.id]);
      expect(Object.keys(res.body[0]).sort()).toEqual(
        ["actionDateTime", "assignee", "attachmentNotes", "createdAt", "createdBy", "description", "followUpNote", "followUpRequired", "id", "performedBy", "result", "status", "ticketId", "updatedAt", "version"]
      );
    });

    it("API-04: IT Staff and Administrators can list any Ticket's actions; an empty Ticket returns []", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const admin = await makeAdministrator();
      const ticket = await ticketIn("OPEN", requester.id);

      const empty = await list(ticket.id, staff);
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual([]);

      await seedAction(ticket.id, staff.id);
      expect((await list(ticket.id, admin)).body).toHaveLength(1);
    });

    it("API-05: another Requester's Ticket and a nonexistent Ticket give an identical 404", async () => {
      const owner = await makeRequester();
      const intruder = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", owner.id);
      await seedAction(ticket.id, staff.id);

      const notOwned = await list(ticket.id, intruder);
      const missing = await list(999999, intruder);

      expect(notOwned.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(notOwned.body).toEqual(missing.body);
      expect(JSON.stringify(notOwned.body)).not.toContain("Seeded action");
    });
  });

  describe("validation (API-06, API-07)", () => {
    it("API-06: rejects missing result on Completed, missing follow-up note, bad lengths and dates; nothing is written", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const bodies: object[] = [
        { description: "No result", status: "COMPLETED" },
        { description: "No note", followUpRequired: true },
        { description: "   " },
        { description: "d".repeat(2001) },
        { description: "ok", result: "r".repeat(2001) },
        { description: "ok", attachmentNotes: "a".repeat(501) },
        { description: "ok", actionDateTime: "yesterday-ish" },
        { description: "Future and done", status: "COMPLETED", result: "x", actionDateTime: new Date(Date.now() + 3_600_000).toISOString() },
        { description: "ok", status: "CANCELLED" },
        { description: "ok", assigneeId: "seven" },
      ];
      for (const body of bodies) {
        const res = await post(ticket.id, staff, body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error).toBeTruthy();
      }
      expect(await actionCount()).toBe(0);
    });

    it("API-06: a Planned action may be dated in the future; the follow-up note is dropped when follow-up is off", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const res = await post(ticket.id, staff, {
        description: "Scheduled maintenance",
        actionDateTime: new Date(Date.now() + 86_400_000).toISOString(),
        followUpRequired: false,
        followUpNote: "should be discarded",
      });
      expect(res.status).toBe(201);
      expect(res.body.followUpNote).toBeNull();
    });

    it("API-06: completing without a result is rejected and leaves the action Planned", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const res = await patch(ticket.id, action.id, staff, { version: 0, status: "COMPLETED" });
      expect(res.status).toBe(400);
      const after = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      expect(after).toMatchObject({ status: "PLANNED", version: 0, performedById: null });
    });

    it("API-06: PATCH rejects a missing or non-integer version and bad ids", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      expect((await patch(ticket.id, action.id, staff, { description: "no version" })).status).toBe(400);
      expect((await patch(ticket.id, action.id, staff, { version: "0", description: "x" })).status).toBe(400);
      expect((await patch(ticket.id, action.id, staff, { version: -1, description: "x" })).status).toBe(400);
      expect((await patch(ticket.id, 0, staff, { version: 0 })).status).toBe(400);
      expect((await post(0, staff, { description: "x" })).status).toBe(400);
    });

    it("API-07: an inactive, Requester or nonexistent assignee is rejected with 422 on create and reassign; nothing is written", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const inactive = await makeItStaff({ isActive: false });
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      for (const assigneeId of [inactive.id, requester.id, 999999]) {
        const created = await post(ticket.id, staff, { description: "Bad assignee", assigneeId });
        expect(created.status, `create ${assigneeId}`).toBe(422);
        const reassigned = await patch(ticket.id, action.id, staff, { version: 0, assigneeId });
        expect(reassigned.status, `reassign ${assigneeId}`).toBe(422);
      }
      expect(await actionCount()).toBe(1);
      const after = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      expect(after).toMatchObject({ assigneeId: staff.id, version: 0 });
    });

    it("API-07: reassigns a Planned action to another active staff member", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const other = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const res = await patch(ticket.id, action.id, staff, { version: 0, assigneeId: other.id });
      expect(res.status).toBe(200);
      expect(res.body.assignee.id).toBe(other.id);
      expect(res.body.version).toBe(1);
    });
  });

  describe("Ticket state (API-08)", () => {
    it.each(["NEW", "RESOLVED", "CLOSED", "CANCELLED"] as TicketStatus[])("rejects create and update on a %s Ticket with 409 TICKET_NOT_ACTIONABLE", async (status) => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn(status, requester.id, status === "NEW" ? undefined : staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const created = await post(ticket.id, staff, { description: "Too late" });
      expect(created.status).toBe(409);
      expect(created.body.code).toBe("TICKET_NOT_ACTIONABLE");

      const updated = await patch(ticket.id, action.id, staff, { version: 0, description: "Edit" });
      expect(updated.status).toBe(409);
      expect(updated.body.code).toBe("TICKET_NOT_ACTIONABLE");

      expect(await actionCount(ticket.id)).toBe(1);
      expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).description).toBe("Seeded action");
    });

    it.each(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as TicketStatus[])("allows actions on a %s Ticket", async (status) => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn(status, requester.id, staff.id);
      expect((await post(ticket.id, staff, { description: "Fine" })).status).toBe(201);
    });

    it("a nonexistent Ticket is 404 for staff, and an action under a different Ticket is 404", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticketA = await ticketIn("OPEN", requester.id, staff.id);
      const ticketB = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticketA.id, staff.id);

      expect((await post(999999, staff, { description: "x" })).status).toBe(404);
      expect((await patch(ticketB.id, action.id, staff, { version: 0, description: "x" })).status).toBe(404);
      expect((await patch(ticketA.id, 999999, staff, { version: 0, description: "x" })).status).toBe(404);
    });
  });

  describe("concurrency and idempotency (API-09, API-10)", () => {
    it("API-09: the second client saving with the old version gets 409 STALE_VERSION and the first change survives", async () => {
      const requester = await makeRequester();
      const first = await makeItStaff();
      const second = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, first.id);
      const action = await seedAction(ticket.id, first.id);

      const a = await patch(ticket.id, action.id, first, { version: 0, description: "First edit" });
      expect(a.status).toBe(200);
      expect(a.body.version).toBe(1);

      const b = await patch(ticket.id, action.id, second, { version: 0, description: "Second edit" });
      expect(b.status).toBe(409);
      expect(b.body).toMatchObject({ code: "STALE_VERSION", currentVersion: 1 });

      const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      expect(stored).toMatchObject({ description: "First edit", version: 1 });
    });

    it("API-09: simultaneous updates with the same version let exactly one win", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const results = await Promise.all(
        [1, 2, 3, 4].map((n) => patch(ticket.id, action.id, staff, { version: 0, description: `Edit ${n}` }))
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409 && r.body.code === "STALE_VERSION")).toHaveLength(3);
      expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).version).toBe(1);
    });

    it("API-10: the same clientRequestId returns the original action instead of a second one", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const clientRequestId = "6f1c1c1e-3b0e-4d6a-9a53-0a9a1e7d2b11";

      const first = await post(ticket.id, staff, { description: "Once only", clientRequestId });
      const second = await post(ticket.id, staff, { description: "Once only", clientRequestId });

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
      expect(await actionCount(ticket.id)).toBe(1);
    });

    it("API-10: parallel creates with one clientRequestId produce exactly one row", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const clientRequestId = "0b8a7d2e-91a4-4c53-8d6f-5e2a3c4b1f90";

      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() => post(ticket.id, staff, { description: "Double click", clientRequestId }))
      );

      expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await actionCount(ticket.id)).toBe(1);
    });

    it("API-10: the same clientRequestId on a different Ticket is a separate action; a malformed id is 400", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const one = await ticketIn("OPEN", requester.id, staff.id);
      const two = await ticketIn("OPEN", requester.id, staff.id);
      const clientRequestId = "3d6f6f6e-0c7a-4b8b-8f3e-2a9c1d5e7b40";

      expect((await post(one.id, staff, { description: "A", clientRequestId })).status).toBe(201);
      expect((await post(two.id, staff, { description: "B", clientRequestId })).status).toBe(201);
      expect((await post(one.id, staff, { description: "C", clientRequestId: "not-a-uuid" })).status).toBe(400);
    });
  });

  describe("action state (API-11, API-12)", () => {
    it("API-11: cancelling a Planned action works and then it is read-only", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const cancelled = await patch(ticket.id, action.id, staff, { version: 0, status: "CANCELLED" });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body).toMatchObject({ status: "CANCELLED", performedBy: null, version: 1 });

      for (const body of [{ description: "Edit" }, { result: "x" }, { status: "PLANNED" }, { assigneeId: staff.id + 0, attachmentNotes: "n" }]) {
        const res = await patch(ticket.id, action.id, staff, { version: 1, ...body });
        expect(res.status, JSON.stringify(body)).toBe(409);
        expect(res.body.code).toBe("INVALID_ACTION_STATE");
      }
    });

    it("API-11: a Completed action cannot be reverted, cancelled or reassigned", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const other = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id, { status: "COMPLETED", result: "Done" });

      for (const body of [{ status: "PLANNED" }, { status: "CANCELLED" }, { assigneeId: other.id }]) {
        const res = await patch(ticket.id, action.id, staff, { version: 0, ...body });
        expect(res.status, JSON.stringify(body)).toBe(409);
        expect(res.body.code).toBe("INVALID_ACTION_STATE");
      }
      const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      expect(stored).toMatchObject({ status: "COMPLETED", assigneeId: staff.id, version: 0 });
    });

    it("API-11: a Completed action's content can be corrected, including a past date, but not a future one", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id, { status: "COMPLETED", result: "Done" });

      const corrected = await patch(ticket.id, action.id, staff, {
        version: 0,
        description: "Corrected description",
        result: "Corrected result",
        actionDateTime: "2026-09-01T08:00:00.000Z",
        followUpRequired: true,
        followUpNote: "Look again next week",
        attachmentNotes: "Photo on the Ticket",
        status: "COMPLETED", // unchanged value is tolerated
      });
      expect(corrected.status).toBe(200);
      expect(corrected.body).toMatchObject({
        description: "Corrected description",
        result: "Corrected result",
        actionDateTime: "2026-09-01T08:00:00.000Z",
        followUpRequired: true,
        followUpNote: "Look again next week",
        version: 1,
      });

      const future = await patch(ticket.id, action.id, staff, { version: 1, actionDateTime: new Date(Date.now() + 3_600_000).toISOString() });
      expect(future.status).toBe(400);
      const emptied = await patch(ticket.id, action.id, staff, { version: 1, result: "" });
      expect(emptied.status).toBe(400);
    });

    it("API-11: a no-op update changes nothing and does not bump the version", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const res = await patch(ticket.id, action.id, staff, { version: 0, description: "Seeded action" });
      expect(res.status).toBe(200);
      expect(res.body.version).toBe(0);
    });

    it("API-12: there is no DELETE endpoint", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);

      const res = await request(app).delete(`/api/tickets/${ticket.id}/actions/${action.id}`).set("Cookie", asUser(staff));
      expect([404, 405]).toContain(res.status);
      expect(await actionCount(ticket.id)).toBe(1);
    });
  });

  describe("authorization (AUTHZ-01, AUTHZ-02)", () => {
    it("AUTHZ-01: a Requester cannot create or update actions, on their own or anyone else's Ticket", async () => {
      const owner = await makeRequester();
      const other = await makeRequester();
      const staff = await makeItStaff();
      const own = await ticketIn("OPEN", owner.id, staff.id);
      const foreign = await ticketIn("OPEN", other.id, staff.id);
      const action = await seedAction(own.id, staff.id);

      for (const ticketId of [own.id, foreign.id, 999999]) {
        const created = await post(ticketId, owner, { description: "Sneaky" });
        expect(created.status, `post ${ticketId}`).toBe(403);
      }
      const updated = await patch(own.id, action.id, owner, { version: 0, description: "Sneaky edit" });
      expect(updated.status).toBe(403);
      const foreignUpdate = await patch(foreign.id, action.id, owner, { version: 0, description: "Sneaky edit" });
      expect(foreignUpdate.status).toBe(403);

      expect(await actionCount()).toBe(1);
      expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).description).toBe("Seeded action");
    });

    it("AUTHZ-02: unauthenticated calls get 401 and a user who must change their password gets 403", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const mustChange = await makeUser({ role: "IT_STAFF", mustChangePassword: true });
      const ticket = await ticketIn("OPEN", requester.id, staff.id);
      const action = await seedAction(ticket.id, staff.id);
      const base = `/api/tickets/${ticket.id}/actions`;

      expect((await request(app).get(base)).status).toBe(401);
      expect((await request(app).post(base).send({ description: "x" })).status).toBe(401);
      expect((await request(app).patch(`${base}/${action.id}`).send({ version: 0 })).status).toBe(401);

      const cookie = asUser(mustChange);
      expect((await request(app).get(base).set("Cookie", cookie)).status).toBe(403);
      expect((await request(app).post(base).set("Cookie", cookie).send({ description: "x" })).status).toBe(403);
      expect((await request(app).patch(`${base}/${action.id}`).set("Cookie", cookie).send({ version: 0 })).status).toBe(403);
      expect(await actionCount()).toBe(1);
    });

    it("never returns a stack trace or raw database error", async () => {
      const requester = await makeRequester();
      const staff = await makeItStaff();
      const ticket = await ticketIn("OPEN", requester.id, staff.id);

      const res = await post(ticket.id, staff, { description: "x", assigneeId: 2 ** 40 });
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|stack|at .*\.ts/i);
    });
  });
});
