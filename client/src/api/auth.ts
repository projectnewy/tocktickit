import { request } from "./client.js";
import type { AuthUser } from "./types.js";

export interface LoginInput {
  email: string;
  password: string;
}

export function login(input: LoginInput): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: input });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function me(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/me");
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>("/api/auth/change-password", { method: "POST", body: input });
}
