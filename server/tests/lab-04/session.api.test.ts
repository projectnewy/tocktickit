import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeItStaff, makeRequester, makeUser } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";
import { SESSION_COOKIE, signSession } from "../../src/auth/token.js";

// GET /api/auth/session (FR-17, BR-33): the probe the client asks on every page load. It answers 200 either way
// so a signed-out visit is not a failed request, while /me keeps its Lab 3 contract.
describe("GET /api/auth/session", () => {
  beforeEach(resetDb);

  it("returns the signed-in user, with the fields the client needs", async () => {
    const staff = await makeItStaff();
    const res = await request(app).get("/api/auth/session").set("Cookie", cookieFor(staff.id, "IT_STAFF"));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: staff.id, fullName: staff.fullName, email: staff.email, role: "IT_STAFF", mustChangePassword: false });
    expect(Object.keys(res.body.user).sort()).toEqual(["email", "fullName", "id", "mustChangePassword", "role"]); // never a hash
  });

  it("returns 200 with user null — not 401 — when there is no cookie", async () => {
    const res = await request(app).get("/api/auth/session");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("returns user null for a garbage cookie and for a cookie signed with another secret", async () => {
    const garbage = await request(app).get("/api/auth/session").set("Cookie", `${SESSION_COOKIE}=not-a-token`);
    expect(garbage.status).toBe(200);
    expect(garbage.body).toEqual({ user: null });

    const forged = signSession({ userId: 1, role: "ADMINISTRATOR" }).split(".").slice(0, 2).join(".") + ".forged-signature";
    const res = await request(app).get("/api/auth/session").set("Cookie", `${SESSION_COOKIE}=${forged}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("returns user null once the account is deactivated, or when it no longer exists", async () => {
    const requester = await makeRequester();
    const cookie = cookieFor(requester.id, "REQUESTER");
    expect((await request(app).get("/api/auth/session").set("Cookie", cookie)).body.user).not.toBeNull();

    const { getPrisma } = await import("../../src/prisma.js");
    await getPrisma().user.update({ where: { id: requester.id }, data: { isActive: false } });
    expect((await request(app).get("/api/auth/session").set("Cookie", cookie)).body).toEqual({ user: null });

    expect((await request(app).get("/api/auth/session").set("Cookie", cookieFor(999999, "REQUESTER"))).body).toEqual({ user: null });
  });

  it("still reports mustChangePassword so the client can send the user to Change Password", async () => {
    const user = await makeUser({ role: "REQUESTER", mustChangePassword: true });
    const res = await request(app).get("/api/auth/session").set("Cookie", cookieFor(user.id, "REQUESTER"));
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it("leaves /api/auth/me exactly as it was: 401 without a session", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });
});

describe("a session that has ended returns 401 on every feature endpoint (AC-22, BR-33)", () => {
  beforeEach(resetDb);

  it.each([
    "/api/tickets",
    "/api/dashboard/requester",
    "/api/dashboard/staff",
    "/api/staff/tickets",
    "/api/tickets/1/actions",
    "/api/admin/users",
  ])("GET %s without a session is a safe 401", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });
});
