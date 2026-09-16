import { getPrisma } from "../prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signSession } from "../auth/token.js";
import { UnauthorizedError } from "../http/errors.js";

export interface AuthenticatedUser {
  id: number;
  fullName: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  mustChangePassword: boolean;
}

function toAuthenticatedUser(user: {
  id: number;
  fullName: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  mustChangePassword: boolean;
}): AuthenticatedUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

// BR-06/BR-07: bad credentials and inactive accounts return the same generic
// error — never reveal whether the email exists or why login failed.
export async function login(email: string, password: string): Promise<{ user: AuthenticatedUser; token: string }> {
  const user = await getPrisma().user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = signSession({ userId: user.id, role: user.role });
  return { user: toAuthenticatedUser(user), token };
}

export async function getCurrentUser(userId: number): Promise<AuthenticatedUser> {
  const user = await getPrisma().user.findUniqueOrThrow({ where: { id: userId } });
  return toAuthenticatedUser(user);
}

// BR-09: 8-72 chars enforced by validation before this is called.
// BR-02/BR-27: clears mustChangePassword on self-service change.
export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const user = await getPrisma().user.findUniqueOrThrow({ where: { id: userId } });

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);
  await getPrisma().user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}
