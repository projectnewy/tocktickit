import { z } from "zod";

// BR-19: 1-2000 chars, trimmed, empty/whitespace-only rejected.
export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment must be at most 2000 characters"),
});
