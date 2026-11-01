import type { Role } from "../api/types.js";

// BR-30: where each role starts. Requesters have their own Dashboard; IT Staff and Administrators share the
// IT Staff Dashboard. Used for login, the forced password change, the root path, and any redirect away from
// a screen the user's role may not open.
export function landingPath(role: Role): string {
  return role === "REQUESTER" ? "/dashboard" : "/staff/dashboard";
}
