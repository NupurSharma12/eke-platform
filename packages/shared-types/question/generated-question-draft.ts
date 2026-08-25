import { QuestionType } from "./question-type";
import { VisualSpec } from "./visual-spec";

/**
 * The raw shape returned by the LLM, before EKE attaches identity
 * and provenance (id, conceptId, sourcePatternIds, origin,
 * createdAt) to form a full GeneratedQuestion. Mirrors how
 * ExtractedConcept relates to Concept: the LLM is never trusted
 * to report identity/routing facts (conceptId is not part of
 * this shape — it's assigned by EKE's own orchestration code,
 * the same reasoning already applied to sourceDocumentId
 * elsewhere in this pipeline).
 */
export interface GeneratedQuestionDraft {
  questionText: string;

  questionType: QuestionType;

  options?: string[];

  correctAnswer: string;

  explanation: string;

  /**
   * Present only when the question depends on a diagram/figure —
   * a validated, deterministically-renderable specification, never
   * an image or LLM-authored markup. Absent for every plain-text
   * question; adding this field changes nothing about existing
   * questions that never set it.
   */
  visualSpec?: VisualSpec;
}
