import { z } from "zod";

export const removeAttachmentSchema = z.object({
  reason: z.string().trim().min(1, "A removal reason is required").max(200, "Reason must be at most 200 characters"),
});
