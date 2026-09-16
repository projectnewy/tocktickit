import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

// UNIT-02 (tests.md): BR-08 — passwords are stored only as a bcrypt hash,
// never plaintext. No database involved — pure round-trip of the two
// functions every password-touching code path relies on.
describe("hashPassword/verifyPassword (BR-08)", () => {
  it("hashes to something other than the plaintext and verifies correctly", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toBe("Password123!");
    expect(await verifyPassword("Password123!", hash)).toBe(true);
  });

  it("rejects a wrong password against the hash", async () => {
    const hash = await hashPassword("Password123!");
    expect(await verifyPassword("WrongPassword1!", hash)).toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const [a, b] = await Promise.all([hashPassword("Password123!"), hashPassword("Password123!")]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("Password123!", a)).toBe(true);
    expect(await verifyPassword("Password123!", b)).toBe(true);
  });
});
