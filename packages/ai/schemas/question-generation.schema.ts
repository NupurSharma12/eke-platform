import { z } from "zod";
import { VisualSpecSchema } from "./visual-spec.schema";

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

  visualSpec: VisualSpecSchema.optional(),
});

/**
 * A pool-generation response: the same per-question shape, one LLM
 * call producing many. Wrapped in an object (not a bare top-level
 * array) because OpenAI-compatible "json_object" response-format
 * modes (see GroqProvider) require the model's top-level JSON
 * output to be an object — a bare array gets silently wrapped by
 * the model under a key of its own choosing, which a bare-array
 * schema can never anticipate. Asking for this exact shape in the
 * prompt keeps the wrapper key fixed and known.
 */
export const GeneratedQuestionDraftPoolSchema = z.object({
  questions: z.array(GeneratedQuestionDraftSchema).min(1),
});
