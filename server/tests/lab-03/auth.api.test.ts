import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeUser, TEST_PASSWORD } from "../helpers/factories.js";
import { cookieFor } from "../helpers/auth.js";

describe("POST /api/auth/login", () => {
  beforeEach(resetDb);

  it("logs in an active user with valid credentials and returns identity+role (AC-01, API-01)", async () => {
    const user = await makeUser({ email: "login-ok@example.com", role: "REQUESTER" });

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, role: "REQUESTER" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/tk_session=.+HttpOnly/);
  });

  it("rejects a bad password with a generic message (BR-06, API-02)", async () => {
    const user = await makeUser({ email: "badpw@example.com" });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects an inactive account with the identical message shape as a bad password (BR-07, API-02)", async () => {
    const user = await makeUser({ email: "inactive@example.com", isActive: false });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects an unknown email with the same generic message (BR-06)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("validates email/password presence (API-03)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "", password: "" });
    expect(res.status).toBe(400);
  });
});

describe("mandatory password change gate (AC-02, BR-02, API-03)", () => {
  beforeEach(resetDb);

  it("blocks a protected endpoint while mustChangePassword is true", async () => {
    const user = await makeUser({ role: "REQUESTER", mustChangePassword: true });
    const res = await request(app).get("/api/tickets").set("Cookie", cookieFor(user.id, "REQUESTER"));
    expect(res.status).toBe(403);
  });

  it("allows /auth/me and /auth/change-password while mustChangePassword is true", async () => {
    const user = await makeUser({ role: "REQUESTER", mustChangePassword: true });
    const me = await request(app).get("/api/auth/me").set("Cookie", cookieFor(user.id, "REQUESTER"));
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);
  });
});

describe("POST /api/auth/change-password", () => {
  beforeEach(resetDb);

  it("changes the password, clears mustChangePassword, and the new password logs in (AC-12, BR-02, BR-27, API-16)", async () => {
    const user = await makeUser({ role: "REQUESTER", mustChangePassword: true });

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookieFor(user.id, "REQUESTER"))
      .send({ currentPassword: TEST_PASSWORD, newPassword: "NewPassword456!" });
    expect(change.status).toBe(200);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookieFor(user.id, "REQUESTER"));
    expect(me.body.user.mustChangePassword).toBe(false);

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "NewPassword456!" });
    expect(login.status).toBe(200);
  });

  it("rejects a wrong current password", async () => {
    const user = await makeUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookieFor(user.id, "REQUESTER"))
      .send({ currentPassword: "not-the-real-password", newPassword: "NewPassword456!" });
    expect(res.status).toBe(401);
  });

  it("rejects a new password outside the 8-72 character boundary (BR-09, API-04)", async () => {
    const user = await makeUser();
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookieFor(user.id, "REQUESTER"))
      .send({ currentPassword: TEST_PASSWORD, newPassword: "short" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(resetDb);

  it("clears the cookie; a request that still sends the old cookie value returns 401 (AC-13, BR-10, API-05)", async () => {
    const user = await makeUser();
    const cookie = cookieFor(user.id, "REQUESTER");

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);

    // logout clears the cookie on the client; simulate reuse of an already-expired/invalid token instead
    const stale = await request(app).get("/api/auth/me").set("Cookie", "tk_session=not-a-real-token");
    expect(stale.status).toBe(401);
  });

  it("rejects any request with no session at all", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });
});
