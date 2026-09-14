import { z } from "zod";

/**
 * Duplicated as a runtime enum for the same reason
 * AssessmentQuestionTypeSchema duplicates QuestionType (Zod cannot
 * validate against a purely compile-time type alias). Deliberately a
 * distinct value set from AssessmentQuestionTypeSchema/QuestionType —
 * see ObservedQuestionType's own doc comment for why these two
 * vocabularies must never be merged.
 */
export const ObservedQuestionTypeSchema = z.enum([
  "mcq",
  "true-false",
  "fill-blanks",
  "matching",
  "sequencing",
  "short-answer",
  "diagram-based",
  "other",
]);

/**
 * The raw shape the LLM is expected to return: a classification of
 * one already-observed question only. Deliberately excludes every
 * application-owned field (observedEvidenceId, interpretedAt,
 * status) — those are assigned by QuestionTypeInterpreterService,
 * never read from this schema's output. Also deliberately excludes
 * difficulty, marks, concept, curriculum scope, and anything
 * resembling a generalized QuestionPattern: nothing in the prompt
 * asks for them, so nothing here validates them either, the same
 * separation already used by every other extraction schema in this
 * codebase.
 */
export const QuestionTypeInterpretationResultSchema = z.object({
  questionType: ObservedQuestionTypeSchema,
  answerStyle: z.string().min(1, "answerStyle must be a non-empty description"),
});
