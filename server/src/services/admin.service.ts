import type { Prisma, Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { hashPassword } from "../auth/password.js";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "../http/errors.js";
import type { CreateUserInput, UpdateUserInput } from "../validation/admin.schemas.js";

// Never selects passwordHash — same "never expose the hash" rule as
// auth.service.ts's AuthenticatedUser (BR-12's analog for the admin screen).
const USER_SELECT = { id: true, fullName: true, email: true, role: true, isActive: true } satisfies Prisma.UserSelect;

export async function listUsers(query: { q?: string; role?: Role }) {
  return getPrisma().user.findMany({
    where: {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: USER_SELECT,
    orderBy: { fullName: "asc" },
  });
}

// FR-15/BR-11: "Initial Password" is temporary by design (ui-spec.md §5) —
// force a change at first login, the same as an admin-issued password reset
// (BR-27), even though BR-27 itself only names the reset-password action.
export async function createUser(input: CreateUserInput) {
  const email = input.email.toLowerCase();
  const existing = await getPrisma().user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("A user with this email already exists");

  const passwordHash = await hashPassword(input.initialPassword);
  return getPrisma().user.create({
    data: { fullName: input.fullName, email, role: input.role, passwordHash, mustChangePassword: true },
    select: USER_SELECT,
  });
}

// BR-26: blocks any update (deactivate OR role change away from
// Administrator) that would leave zero active Administrators.
async function wouldRemoveLastActiveAdmin(
  current: { role: Role; isActive: boolean },
  nextRole: Role,
  nextIsActive: boolean
): Promise<boolean> {
  const staysActiveAdmin = nextRole === "ADMINISTRATOR" && nextIsActive;
  if (current.role !== "ADMINISTRATOR" || !current.isActive || staysActiveAdmin) return false;

  const activeAdminCount = await getPrisma().user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
  return activeAdminCount <= 1;
}

export async function updateUser(actingAdminId: number, targetId: number, input: UpdateUserInput) {
  const existing = await getPrisma().user.findUnique({ where: { id: targetId } });
  if (!existing) throw new NotFoundError("User not found");

  // BR-25: checked before the last-admin count query — self-deactivation is
  // rejected outright regardless of how many other admins exist.
  if (input.isActive === false && targetId === actingAdminId) {
    throw new UnprocessableEntityError("You cannot deactivate your own account");
  }

  const nextRole = input.role ?? existing.role;
  const nextIsActive = input.isActive ?? existing.isActive;
  if (await wouldRemoveLastActiveAdmin(existing, nextRole, nextIsActive)) {
    throw new UnprocessableEntityError("This would leave zero active Administrators");
  }

  let email: string | undefined;
  if (input.email !== undefined) {
    email = input.email.toLowerCase();
    if (email !== existing.email) {
      const duplicate = await getPrisma().user.findUnique({ where: { email } });
      if (duplicate) throw new ConflictError("A user with this email already exists");
    }
  }

  return getPrisma().user.update({
    where: { id: targetId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: USER_SELECT,
  });
}

// FR-17/BR-27: always forces mustChangePassword=true, regardless of the
// target's current state.
export async function resetPassword(targetId: number, newPassword: string) {
  const existing = await getPrisma().user.findUnique({ where: { id: targetId } });
  if (!existing) throw new NotFoundError("User not found");

  const passwordHash = await hashPassword(newPassword);
  return getPrisma().user.update({
    where: { id: targetId },
    data: { passwordHash, mustChangePassword: true },
    select: USER_SELECT,
  });
}
