/**
 * Which evidence tier(s) supported an observed question. Derived by
 * application code from the document's own per-page evidence
 * (pages[]/pageTextSources[]/pageVisionAnalysis[]) — never trusted
 * from an LLM response. A question may legitimately be backed by
 * more than one tier at once (e.g. OCR text plus a vision-described
 * diagram on the same page), which is why this is an array on
 * ObservedQuestionEvidence, not a single value.
 */
export type ObservedQuestionEvidenceType = "text" | "ocr" | "vision";

/**
 * What EKE actually observed in source material — not yet a
 * generation pattern. Deliberately narrow: this represents evidence
 * that a question/exercise exists at a given location in a document,
 * transcribed as seen, never an interpretation, classification, or
 * generalization of it. The future mapping from this evidence to a
 * QuestionPattern (question type, difficulty, canonical concept,
 * generalized template) is an explicitly separate, later concern —
 * see this milestone's own scope notes for why none of those fields
 * belong here yet.
 */
export interface ObservedQuestionEvidence {
  id: string;

  sourceDocumentId: string;

  /**
   * 1-indexed, inclusive. A question may span more than one page
   * (e.g. a diagram on one page, the question text continuing onto
   * the next) — start === end for a single-page question.
   */
  page: {
    start: number;
    end: number;
  };

  evidenceTypes: ObservedQuestionEvidenceType[];

  /**
   * A visible exercise/section heading (e.g. "Let's Practise",
   * "Exercise 3B"), only when actually present in the supplied
   * evidence — never invented. null when no such label is visible.
   */
  sectionLabel: string | null;

  /** Transcribed as observed — never completed, paraphrased, or invented. */
  observedText: string;

  status: "pending";

  extractedAt: string;
}
