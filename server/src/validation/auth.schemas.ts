import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });
