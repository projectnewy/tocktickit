import { z } from "zod";

// Shape/type checks only. Length, required-when and date rules live in services/actionRules.ts so
// they are defined once and unit-tested; unknown keys (createdBy, performedBy, id, ...) are stripped
// here, which is how clients are kept from setting server-owned fields (BR-09).
const text = z.string().nullable().optional();
// Postgres INTEGER range: a larger id would reach the database and fail there instead of here.
const id = z.number().int().positive().max(2_147_483_647);
const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const createActionSchema = z.object({
  description: z.string(),
  actionDateTime: dateTime.optional(),
  assigneeId: id.optional(),
  status: z.enum(["PLANNED", "COMPLETED"]).optional(),
  result: text,
  followUpRequired: z.boolean().optional(),
  followUpNote: text,
  attachmentNotes: text,
  clientRequestId: z.string().uuid().optional(),
});

export const updateActionSchema = z.object({
  version: z.number().int().min(0),
  description: z.string().optional(),
  actionDateTime: dateTime.optional(),
  assigneeId: id.optional(),
  status: z.enum(["PLANNED", "COMPLETED", "CANCELLED"]).optional(),
  result: text,
  followUpRequired: z.boolean().optional(),
  followUpNote: text,
  attachmentNotes: text,
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;
