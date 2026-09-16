import { z } from "zod";

const ROLE_VALUES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;

export const userQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_VALUES).optional(),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Full name must be at most 100 characters"),
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  role: z.enum(ROLE_VALUES),
  // BR-09: same 8-72 char rule as a self-service password change.
  initialPassword: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// FR-16: fullName/email/role/isActive, all optional — a PATCH may touch any subset.
export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Full name must be at most 100 characters").optional(),
  email: z.string().trim().min(1, "Email is required").email("Invalid email address").optional(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
});
