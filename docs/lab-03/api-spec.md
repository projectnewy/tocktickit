# Lab 3 API Contract

Auth: signed, httpOnly, `SameSite=Lax` JWT cookie named `tk_session` (8h expiry, set on login, cleared
on logout). All endpoints below require a valid, non-expired cookie unless marked "Public."

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | `{email, password}` → 200 `{user}` + sets cookie, or 401 |
| POST | `/api/auth/logout` | Any | Clears cookie → 204 |
| GET | `/api/auth/me` | Any | Returns `{id, fullName, email, role, mustChangePassword}` |
| POST | `/api/auth/change-password` | Any | `{currentPassword, newPassword}` → 200, clears `mustChangePassword` |

**Errors:** 401 `{error:"Invalid email or password"}` for bad credentials AND inactive accounts
(identical shape). 403 `{error:"Password change required"}` from any other endpoint while
`mustChangePassword` is true.

## Requester (Lab 2 endpoints, now session-scoped)
`/api/tickets`, `/api/tickets/:id`, `/api/tickets/:id/attachments/*` — unchanged request/response shapes
from Lab 2, except `requesterId` is now derived from the session cookie instead of `X-Requester-Id`.
`POST /api/tickets/:id/resolution-indication` — Requester only, owner only, sets `resolutionIndicated`.

## IT Staff Queue & Ticket operations

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/staff/tickets` | IT Staff, Admin | Queue: `?page&pageSize&q&status&categoryId&ownerId=me\|unassigned\|<id>&sort` |
| GET | `/api/staff/tickets/:id` | IT Staff, Admin | Full ticket incl. owner, itPriority, comments, notes, attachments |
| PATCH | `/api/staff/tickets/:id/claim` | IT Staff, Admin | `{targetUserId?}` — omitted = claim for self |
| PATCH | `/api/staff/tickets/:id/priority` | IT Staff, Admin | `{itPriority}` |
| PATCH | `/api/staff/tickets/:id/status` | IT Staff, Admin | `{status}` — validated against the transition matrix, 409 if invalid |

Queue defaults: `pageSize` 10/20/50 allowlist, sort allowlist `createdAt|itPriority|status`, default
`createdAt desc`. Invalid query params → 400, never silently coerced.

## Comments & Notes

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/tickets/:id/comments` | Owner Requester, IT Staff, Admin | Public Comments, oldest first |
| POST | `/api/tickets/:id/comments` | Owner Requester, IT Staff, Admin | `{body}` (1–2000 chars) |
| GET | `/api/tickets/:id/notes` | IT Staff, Admin | Internal Notes |
| POST | `/api/tickets/:id/notes` | IT Staff, Admin | `{body}` (1–2000 chars) |

A Requester calling the notes endpoints (even for their own ticket) → 403, empty body. A Requester
calling comments/notes for a ticket they don't own → 404 (uniform with nonexistent, same pattern as
Lab 2 Attachments).

## Administrator — User Management

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/admin/users` | Admin | `?q=&role=` (search by name/email, optional role filter) |
| POST | `/api/admin/users` | Admin | `{fullName, email, role, initialPassword}` → 201, or 409 duplicate email |
| PATCH | `/api/admin/users/:id` | Admin | `{fullName?, email?, role?, isActive?}` |
| POST | `/api/admin/users/:id/reset-password` | Admin | `{newPassword}` → sets `mustChangePassword=true` |

**Errors:** 409 on duplicate email; 422 attempting to deactivate self or remove the last active Admin;
403 for any non-Admin caller (uniform, doesn't leak whether the target user exists).

## Safe error shape (all endpoints)
`{ "error": "<human-readable message>" }`, never a stack trace, never a raw Prisma error. Status codes:
400 validation, 401 unauthenticated, 403 forbidden (wrong role, or resource not owned in a
role-can-see-but-not-touch case), 404 not found / not owned (Requester context), 409 conflict
(duplicate email, invalid status transition), 500 unexpected.
