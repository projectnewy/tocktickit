import { ApiError, request } from "./client.js";
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

// Asks the session probe, which answers 200 either way, and turns "nobody" into the same rejection a 401 would
// have produced, so callers (the auth provider) keep treating a rejection as "signed out" — without the browser
// logging a failed request on every signed-out page load.
export async function me(): Promise<{ user: AuthUser }> {
  const { user } = await request<{ user: AuthUser | null }>("/api/auth/session");
  if (!user) throw new ApiError(401, "Not authenticated");
  return { user };
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return request<void>("/api/auth/change-password", { method: "POST", body: input });
}
