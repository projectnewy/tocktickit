import { z } from "zod";
import { VALID_PAGE_SIZES } from "./ticket.schemas.js";

export const STAFF_SORT_ALLOWLIST = [
  "createdAt:desc",
  "createdAt:asc",
  "itPriority:desc",
  "itPriority:asc",
  "status:asc",
  "status:desc",
  "ticketNumber:asc",
  "ticketNumber:desc",
] as const;

const STATUS_VALUES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

const toArray = (value: unknown) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

// ownerId accepts a numeric id, or the two special tokens from ui-spec.md §3
// ("Owner: Me / Unassigned / All") — "me" is resolved against the caller's
// own id in the service layer, since the schema has no request context.
const ownerIdSchema = z.union([z.literal("me"), z.literal("unassigned"), z.coerce.number().int().positive()]).optional();

export const staffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((value): value is (typeof VALID_PAGE_SIZES)[number] => (VALID_PAGE_SIZES as readonly number[]).includes(value), {
      message: "pageSize must be 10, 20, or 50",
    })
    .default(10),
  q: z.string().trim().max(100).optional(),
  status: z.preprocess(toArray, z.array(z.enum(STATUS_VALUES)).optional()),
  categoryId: z.coerce.number().int().positive().optional(),
  ownerId: ownerIdSchema,
  sort: z.enum(STAFF_SORT_ALLOWLIST).default("createdAt:desc"),
});

export type StaffTicketQuery = z.infer<typeof staffQuerySchema>;
