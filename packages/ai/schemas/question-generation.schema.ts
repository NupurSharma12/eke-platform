import { z } from "zod";

export const GeneratedQuestionDraftSchema = z.object({
  questionText: z.string(),

  questionType: z.enum([
    "mcq",
    "visual",
    "word-problem",
    "reasoning",
    "fill-blanks",
    "olympiad",
  ]),

  options: z.array(z.string()).optional(),

  correctAnswer: z.string(),

  explanation: z.string(),
});
