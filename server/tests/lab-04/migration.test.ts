import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";
import { makeAttachment, makeComment, makeInternalNote, makeItStaff, makeRequester, makeTicket } from "../helpers/factories.js";

// MIG-01..04 (docs/lab-04/tests.md): the Lab 4 migration applied to a database holding Lab 3
// data, and its documented rollback. The test database already has the migration applied by
// globalSetup, so this file rolls it back with the shipped rollback.sql, then re-applies the
// shipped migration.sql — the same two scripts a real recovery would use — and compares rows.
const MIGRATION_DIR = "../../prisma/migrations/20261029150326_lab4_actions_taken/";
const MIGRATION_SQL = readFileSync(fileURLToPath(new URL(`${MIGRATION_DIR}migration.sql`, import.meta.url)), "utf8");
const ROLLBACK_SQL = readFileSync(fileURLToPath(new URL(`${MIGRATION_DIR}rollback.sql`, import.meta.url)), "utf8");

const prisma = getPrisma();

// Prisma cannot run several statements in one call, so drop the comment lines and run them one by one.
function statements(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function run(sql: string) {
  for (const statement of statements(sql)) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function isMigrated() {
  const rows = await prisma.$queryRawUnsafe<{ present: string | null }[]>(`SELECT to_regclass('"ActionTaken"')::text AS present`);
  return rows[0].present !== null;
}

async function ticketColumns() {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Ticket' ORDER BY column_name`
  );
  return rows.map((row) => row.column_name);
}

// Every Lab 3 table, read with raw SQL so the result does not depend on the Prisma client's idea of the schema.
async function snapshot() {
  const read = (sql: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  return {
    users: await read(`SELECT * FROM "RequesterUser" ORDER BY id`),
    tickets: await read(
      `SELECT id, "ticketNumber", summary, description, "requestedPriority", "itPriority", status, "resolutionIndicated",
              "requesterId", "ownerId", "categoryId", "relatedSystemId", "createdAt", "updatedAt"
       FROM "Ticket" ORDER BY id`
    ),
    attachments: await read(`SELECT * FROM "Attachment" ORDER BY id`),
    comments: await read(`SELECT * FROM "Comment" ORDER BY id`),
    notes: await read(`SELECT * FROM "InternalNote" ORDER BY id`),
  };
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;
const withoutItPriority = (tickets: Snapshot["tickets"]) => tickets.map(({ itPriority: _itPriority, ...rest }) => rest);

let before: Snapshot;
let duringRollback: { migrated: boolean; columns: string[]; snapshot: Snapshot };
let after: Snapshot;
let columnsAfter: string[];
let legacyIds: { resolved: number; closed: number; open: number; withPriority: number };

beforeAll(async () => {
  await resetDb();

  // Lab 3-shaped data: users, tickets in several statuses, attachment, comment, internal note.
  const requester = await makeRequester();
  const staff = await makeItStaff();
  const open = await makeTicket({ requesterId: requester.id, requestedPriority: "HIGH" });
  const resolved = await makeTicket({ requesterId: requester.id, requestedPriority: "LOW" });
  const closed = await makeTicket({ requesterId: requester.id, requestedPriority: "URGENT" });
  const withPriority = await makeTicket({ requesterId: requester.id, requestedPriority: "LOW" });
  await prisma.ticket.update({ where: { id: open.id }, data: { status: "IN_PROGRESS", ownerId: staff.id } });
  await prisma.ticket.update({ where: { id: resolved.id }, data: { status: "RESOLVED", ownerId: staff.id } });
  await prisma.ticket.update({ where: { id: closed.id }, data: { status: "CLOSED", ownerId: staff.id } });
  // Staff chose a priority different from the requested one: the backfill must not touch it.
  await prisma.ticket.update({ where: { id: withPriority.id }, data: { itPriority: "URGENT" } });
  await makeAttachment({ ticketId: open.id, uploadedById: requester.id });
  await makeComment({ ticketId: open.id, authorId: staff.id });
  await makeInternalNote({ ticketId: open.id, authorId: staff.id });
  legacyIds = { resolved: resolved.id, closed: closed.id, open: open.id, withPriority: withPriority.id };

  before = await snapshot();

  // Roll back to the Lab 3 shape, then re-apply, capturing each state.
  await run(ROLLBACK_SQL);
  duringRollback = { migrated: await isMigrated(), columns: await ticketColumns(), snapshot: await snapshot() };
  await run(MIGRATION_SQL);
  after = await snapshot();
  columnsAfter = await ticketColumns();
});

afterAll(async () => {
  // Leave the shared test database migrated even if a step above failed half-way.
  if (!(await isMigrated())) await run(MIGRATION_SQL);
});

describe("Lab 4 migration on Lab 3 data", () => {
  it("MIG-01: every earlier User, Ticket, Attachment, Comment and Note is unchanged (AC-19, BR-32)", () => {
    expect(after.users).toEqual(before.users);
    expect(after.attachments).toEqual(before.attachments);
    expect(after.comments).toEqual(before.comments);
    expect(after.notes).toEqual(before.notes);
    expect(withoutItPriority(after.tickets)).toEqual(withoutItPriority(before.tickets));
    expect(before.tickets).toHaveLength(4);
    expect(before.users.length).toBeGreaterThanOrEqual(2); // seeded reference users plus the two made above
  });

  it("MIG-02: Resolved/Closed Tickets get resolvedAt = updatedAt; null IT Priority takes the requested one; set values are kept (AC-19, BR-34)", async () => {
    const rows = await prisma.$queryRawUnsafe<{ id: number; status: string; resolvedAt: Date | null; updatedAt: Date; itPriority: string | null; version: number }[]>(
      `SELECT id, status, "resolvedAt", "updatedAt", "itPriority", version FROM "Ticket" ORDER BY id`
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const id of [legacyIds.resolved, legacyIds.closed]) {
      const row = byId.get(id)!;
      expect(row.resolvedAt).not.toBeNull();
      expect(row.resolvedAt!.getTime()).toBe(row.updatedAt.getTime());
    }
    expect(byId.get(legacyIds.open)!.resolvedAt).toBeNull();
    expect(byId.get(legacyIds.withPriority)!.resolvedAt).toBeNull();

    const beforeById = new Map(before.tickets.map((row) => [row.id as number, row]));
    expect(beforeById.get(legacyIds.open)!.itPriority).toBeNull();
    expect(byId.get(legacyIds.open)!.itPriority).toBe("HIGH"); // requested HIGH, was null
    expect(byId.get(legacyIds.resolved)!.itPriority).toBe("LOW");
    expect(byId.get(legacyIds.closed)!.itPriority).toBe("URGENT");
    expect(byId.get(legacyIds.withPriority)!.itPriority).toBe("URGENT"); // staff-chosen, requested LOW
    expect(rows.every((row) => row.version === 0)).toBe(true);
  });

  it("MIG-03: legacy Tickets have zero Actions Taken and every Ticket survives (BR-32)", async () => {
    const counts = await prisma.$queryRawUnsafe<{ actions: number; tickets: number }[]>(
      `SELECT (SELECT count(*)::int FROM "ActionTaken") AS actions, (SELECT count(*)::int FROM "Ticket") AS tickets`
    );
    expect(counts[0]).toEqual({ actions: 0, tickets: 4 });
  });

  it("MIG-04: rollback removes only the Lab 4 objects, keeps all earlier data, and the migration re-applies cleanly", () => {
    expect(duringRollback.migrated).toBe(false);
    expect(duringRollback.columns).not.toContain("version");
    expect(duringRollback.columns).not.toContain("resolvedAt");
    expect(duringRollback.snapshot.users).toEqual(before.users);
    expect(duringRollback.snapshot.attachments).toEqual(before.attachments);
    expect(duringRollback.snapshot.comments).toEqual(before.comments);
    expect(duringRollback.snapshot.notes).toEqual(before.notes);
    expect(duringRollback.snapshot.tickets).toEqual(before.tickets);
    expect(columnsAfter).toContain("version");
    expect(columnsAfter).toContain("resolvedAt");
  });
});

describe("ActionTaken table constraints (specification.md §7)", () => {
  async function seedTicket() {
    await resetDb();
    const requester = await makeRequester();
    const staff = await makeItStaff();
    const ticket = await makeTicket({ requesterId: requester.id });
    return { staff, ticket };
  }

  const insert = (ticketId: number, userId: number, clientRequestId: string | null) =>
    prisma.actionTaken.create({
      data: { ticketId, createdById: userId, assigneeId: userId, description: "Replace access point", clientRequestId },
    });

  it("defaults to PLANNED, version 0, no follow-up, and no performer", async () => {
    const { staff, ticket } = await seedTicket();
    const action = await insert(ticket.id, staff.id, null);
    expect(action).toMatchObject({ status: "PLANNED", version: 0, followUpRequired: false, performedById: null, result: null });
  });

  it("allows many actions without a clientRequestId but rejects a repeated one on the same Ticket (BR-21)", async () => {
    const { staff, ticket } = await seedTicket();
    await insert(ticket.id, staff.id, null);
    await insert(ticket.id, staff.id, null);
    await insert(ticket.id, staff.id, "11111111-1111-4111-8111-111111111111");
    await expect(insert(ticket.id, staff.id, "11111111-1111-4111-8111-111111111111")).rejects.toThrow();
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(3);
  });

  it("deleting a Ticket deletes its actions, but a User with actions cannot be deleted (append-only, BR-11)", async () => {
    const { staff, ticket } = await seedTicket();
    await insert(ticket.id, staff.id, null);
    await expect(prisma.user.delete({ where: { id: staff.id } })).rejects.toThrow();
    await prisma.ticket.delete({ where: { id: ticket.id } });
    expect(await prisma.actionTaken.count()).toBe(0);
  });
});
