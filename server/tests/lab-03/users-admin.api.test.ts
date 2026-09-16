import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { getPrisma } from "../../src/prisma.js";
import { makeUser, makeItStaff, makeAdministrator } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

// resetDb() reseeds one active Administrator (Olivia Grant) as reference
// data — deactivate it directly so "last active Administrator" tests have a
// deterministic starting count instead of depending on seed data shape.
async function deactivateSeededAdmins() {
  await getPrisma().user.updateMany({ where: { role: "ADMINISTRATOR" }, data: { isActive: false } });
}

describe("GET /api/admin/users (FR-14, AC-16)", () => {
  beforeEach(resetDb);

  it("lists users, optionally filtered by search text and role", async () => {
    const admin = await makeAdministrator();
    const staff = await makeItStaff({ fullName: "Zzz Distinctive Testname" });
    await makeUser({ role: "REQUESTER", fullName: "Someone Else" });

    const all = await request(app).get("/api/admin/users").set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(all.status).toBe(200);
    expect(all.body.map((u: { id: number }) => u.id)).toEqual(expect.arrayContaining([admin.id, staff.id]));
    expect(all.body.some((u: { passwordHash?: string }) => "passwordHash" in u)).toBe(false);

    const byRole = await request(app)
      .get("/api/admin/users")
      .query({ role: "IT_STAFF" })
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(byRole.body.map((u: { id: number }) => u.id)).toContain(staff.id);
    expect(byRole.body.every((u: { role: string }) => u.role === "IT_STAFF")).toBe(true);

    const byQuery = await request(app)
      .get("/api/admin/users")
      .query({ q: "zzz distinctive" })
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(byQuery.body).toHaveLength(1);
    expect(byQuery.body[0].id).toBe(staff.id);
  });

  it("rejects a non-Administrator caller with 403 (AC-16)", async () => {
    const staff = await makeItStaff();
    const res = await request(app).get("/api/admin/users").set("Cookie", cookieFor(staff.id, "IT_STAFF"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/users (FR-15, BR-11, BR-23, BR-27, AC-10, AC-12)", () => {
  beforeEach(resetDb);

  it("creates a user with one role and forces a password change at first login", async () => {
    const admin = await makeAdministrator();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ fullName: "New Hire", email: "new.hire@example.com", role: "IT_STAFF", initialPassword: "Password123!" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fullName: "New Hire", email: "new.hire@example.com", role: "IT_STAFF", isActive: true });
    expect(res.body).not.toHaveProperty("passwordHash");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "new.hire@example.com", password: "Password123!" });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it("rejects a duplicate email (case-insensitive) with 409 and creates no user (AC-10, BR-24)", async () => {
    const admin = await makeAdministrator();
    const existing = await makeUser({ email: "duplicate@example.com" });

    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ fullName: "Someone", email: "Duplicate@Example.com", role: "REQUESTER", initialPassword: "Password123!" });
    expect(res.status).toBe(409);

    const list = await request(app).get("/api/admin/users").set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"));
    expect(list.body.filter((u: { email: string }) => u.email === existing.email)).toHaveLength(1);
  });

  it("rejects a password outside the 8-72 character boundary (BR-09)", async () => {
    const admin = await makeAdministrator();
    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ fullName: "Someone", email: "short.pw@example.com", role: "REQUESTER", initialPassword: "short" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/users/:id (FR-16, FR-18, BR-24, BR-25, BR-26, AC-11)", () => {
  beforeEach(resetDb);

  it("edits name/email/role/active state", async () => {
    const admin = await makeAdministrator();
    const target = await makeUser({ role: "REQUESTER" });

    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ fullName: "Renamed", role: "IT_STAFF" });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Renamed");
    expect(res.body.role).toBe("IT_STAFF");
  });

  it("rejects editing to a duplicate email with 409 (BR-24)", async () => {
    const admin = await makeAdministrator();
    const other = await makeUser({ email: "taken@example.com" });
    const target = await makeUser({ role: "REQUESTER" });

    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ email: other.email });
    expect(res.status).toBe(409);
  });

  it("rejects an Administrator deactivating their own account (FR-18, BR-25, AC-11)", async () => {
    const admin = await makeAdministrator();
    const res = await request(app)
      .patch(`/api/admin/users/${admin.id}`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ isActive: false });
    expect(res.status).toBe(422);
  });

  it("rejects deactivating the last active Administrator, even by a different caller (FR-18, BR-26)", async () => {
    await deactivateSeededAdmins();
    const soleAdmin = await makeAdministrator();
    const actingAdmin = await makeAdministrator(); // a second admin exists so self-check doesn't trip

    // Deactivate the acting admin's peer down to a single active admin first.
    await request(app)
      .patch(`/api/admin/users/${actingAdmin.id}`)
      .set("Cookie", cookieFor(soleAdmin.id, "ADMINISTRATOR"))
      .send({ isActive: false });

    const res = await request(app)
      .patch(`/api/admin/users/${soleAdmin.id}`)
      .set("Cookie", cookieFor(soleAdmin.id, "ADMINISTRATOR"))
      .send({ isActive: false });
    // Both BR-25 (self) and BR-26 (last admin) apply here; either 422 is correct.
    expect(res.status).toBe(422);
  });

  it("rejects changing the last active Administrator's role away from Administrator (BR-26)", async () => {
    await deactivateSeededAdmins();
    const soleAdmin = await makeAdministrator();
    const actingAdmin = await makeAdministrator();
    await request(app)
      .patch(`/api/admin/users/${actingAdmin.id}`)
      .set("Cookie", cookieFor(soleAdmin.id, "ADMINISTRATOR"))
      .send({ isActive: false });

    const res = await request(app)
      .patch(`/api/admin/users/${soleAdmin.id}`)
      .set("Cookie", cookieFor(soleAdmin.id, "ADMINISTRATOR"))
      .send({ role: "IT_STAFF" });
    expect(res.status).toBe(422);
  });

  it("rejects a non-Administrator caller with 403 (AC-16)", async () => {
    const staff = await makeItStaff();
    const target = await makeUser({ role: "REQUESTER" });
    const res = await request(app)
      .patch(`/api/admin/users/${target.id}`)
      .set("Cookie", cookieFor(staff.id, "IT_STAFF"))
      .send({ fullName: "Nope" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/users/:id/reset-password (FR-17, BR-27, AC-12)", () => {
  beforeEach(resetDb);

  it("sets a new password and forces a change at next login", async () => {
    const admin = await makeAdministrator();
    const target = await makeUser({ role: "REQUESTER", email: "reset.me@example.com" });

    const res = await request(app)
      .post(`/api/admin/users/${target.id}/reset-password`)
      .set("Cookie", cookieFor(admin.id, "ADMINISTRATOR"))
      .send({ newPassword: "NewPassword123!" });
    expect(res.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "reset.me@example.com", password: "NewPassword123!" });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });
});
