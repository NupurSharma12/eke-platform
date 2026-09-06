import { z } from "zod";

/**
 * The exact QuestionType union, duplicated as a runtime enum
 * because Zod cannot validate against a purely compile-time type
 * alias (QuestionType is `QuestionTemplate["type"]`, erased at
 * runtime) — same constraint the hand-rolled VALID_QUESTION_TYPES
 * array in validateQuestionGenerationRequest.ts already works
 * around.
 */
export const AssessmentQuestionTypeSchema = z.enum([
  "mcq",
  "visual",
  "word-problem",
  "reasoning",
  "fill-blanks",
  "olympiad",
]);

export const AssessmentStructureAllocationSchema = z.object({
  questionType: AssessmentQuestionTypeSchema,
  count: z.number().int().positive(),
});

/**
 * The raw shape the LLM is expected to return: observed
 * question-type counts only. No difficulty, marks, sections, or
 * curriculum fields — the prompt never asks for them, so the
 * schema never accepts them either. `allocations` must be
 * non-empty: an assessment document that produced zero observed
 * allocations is a failed/malformed extraction, not a valid
 * "empty" result.
 */
export const AssessmentStructureExtractionResultSchema = z.object({
  allocations: z
    .array(AssessmentStructureAllocationSchema)
    .min(1, "allocations must contain at least one entry"),
});
