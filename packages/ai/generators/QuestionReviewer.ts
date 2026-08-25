import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";

/**
 * Result of an independent LLM review pass over a generated
 * question. `reason` is required when `approved` is false so a
 * rejection is always traceable to a concrete explanation, never a
 * silent "no."
 */
export interface QuestionReviewResult {
  approved: boolean;
  reason?: string;
}

export interface QuestionReviewer {
  review(
    draft: GeneratedQuestionDraft,
    blueprint: QuestionBlueprint
  ): Promise<QuestionReviewResult>;
}
