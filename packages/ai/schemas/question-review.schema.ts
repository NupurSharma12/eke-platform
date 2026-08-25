import { z } from "zod";

export const QuestionReviewResultSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});
