import { z } from "zod";

/**
 * The raw shape the LLM is expected to return: observed questions
 * only — page span, an optionally-visible section label, and the
 * transcribed text. Deliberately excludes everything application-owned
 * (id, sourceDocumentId, status, extractedAt, evidenceTypes) — see
 * QuestionPatternEvidenceExtractorService for where those are
 * assigned. Also deliberately excludes question type, difficulty,
 * marks, concept, and curriculum scope: nothing here asks the model
 * for them, so nothing here validates them either, the same
 * separation already used by DocumentStructureExtractionResultSchema
 * and AssessmentStructureExtractionResultSchema.
 *
 * `questions` may legitimately be empty — an educational document
 * can contain no observable questions at all (unlike
 * DocumentStructureExtractionResultSchema's ranges, this is not
 * given a .min(1) floor).
 */
export const ObservedQuestionSchema = z
  .object({
    startPage: z.number().int().positive(),
    endPage: z.number().int().positive(),
    // Accepts either an explicit null or the key being omitted
    // entirely — both mean "no visible label" — normalized to null
    // by the service rather than requiring the model to pick one
    // specific absent-value convention.
    sectionLabel: z.string().min(1).nullable().optional(),
    observedText: z.string().min(1, "observedText must be a non-empty transcription"),
  })
  .refine((question) => question.startPage <= question.endPage, {
    message: "startPage must be less than or equal to endPage",
    path: ["startPage"],
  });

export const QuestionPatternEvidenceExtractionResultSchema = z.object({
  questions: z.array(ObservedQuestionSchema),
});
