import { request } from "./client.js";
import type { Role } from "./types.js";

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface UserQuery {
  q?: string;
  role?: Role;
}

export function listUsers(query: UserQuery = {}): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role) params.set("role", query.role);
  const qs = params.toString();
  return request<AdminUser[]>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  role: Role;
  initialPassword: string;
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return request<AdminUser>("/api/admin/users", { method: "POST", body: input });
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

export function updateUser(userId: number, input: UpdateUserInput): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users/${userId}`, { method: "PATCH", body: input });
}

// FR-17/BR-27: always forces mustChangePassword=true server-side.
export function resetPassword(userId: number, newPassword: string): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users/${userId}/reset-password`, { method: "POST", body: { newPassword } });
}
