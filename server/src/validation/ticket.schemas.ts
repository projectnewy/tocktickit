import { z } from "zod";

export const VALID_PAGE_SIZES = [10, 20, 50] as const;

export const SORT_ALLOWLIST = [
  "createdAt:desc",
  "createdAt:asc",
  "ticketNumber:asc",
  "ticketNumber:desc",
  "requestedPriority:desc",
  "requestedPriority:asc",
  "summary:asc",
  "summary:desc",
] as const;

const STATUS_VALUES = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const createTicketSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  relatedSystemId: z.coerce.number().int().positive(),
  summary: z.string().trim().min(5, "Summary must be at least 5 characters").max(150, "Summary must be at most 150 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(4000, "Description must be at most 4000 characters"),
  requestedPriority: z.enum(PRIORITY_VALUES),
});

// A single value comes through as a string; a repeated param (?status=A&status=B)
// comes through as an array already — normalise both to an array before validating.
const toArray = (value: unknown) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

export const ticketQuerySchema = z.object({
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
  relatedSystemId: z.coerce.number().int().positive().optional(),
  requestedPriority: z.preprocess(toArray, z.array(z.enum(PRIORITY_VALUES)).optional()),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(SORT_ALLOWLIST).default("createdAt:desc"),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketQuery = z.infer<typeof ticketQuerySchema>;
