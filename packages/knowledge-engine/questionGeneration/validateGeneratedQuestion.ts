import { GeneratedQuestionDraft, QuestionGenerationRequest } from "../../shared-types";
import { ValidationResult } from "./validateQuestionGenerationRequest";

/**
 * Deterministic, structural validation only. This checks that the
 * LLM's response is well-formed and internally consistent — it
 * cannot and does not attempt to verify that the question is
 * mathematically correct, that the stated correctAnswer is
 * actually right, or that the explanation is sound. That would
 * require a theorem prover or a second independent verification
 * pass, neither of which exists in this phase. Treat a "valid"
 * result as "well-formed," not as "verified correct."
 */
export function validateGeneratedQuestion(
  draft: GeneratedQuestionDraft,
  request: QuestionGenerationRequest
): ValidationResult {
  const errors: string[] = [];

  if (!draft.questionText || !draft.questionText.trim()) {
    errors.push("questionText is empty");
  }

  if (!draft.correctAnswer || !draft.correctAnswer.trim()) {
    errors.push("correctAnswer is empty");
  }

  if (!draft.explanation || !draft.explanation.trim()) {
    errors.push("explanation is empty");
  }

  if (request.questionType && draft.questionType !== request.questionType) {
    errors.push(
      `questionType "${draft.questionType}" does not match the requested type "${request.questionType}"`
    );
  }

  if (draft.questionType === "mcq") {
    if (!draft.options || draft.options.length < 2) {
      errors.push("mcq questions require at least 2 options");
    } else if (!draft.options.includes(draft.correctAnswer)) {
      errors.push("correctAnswer must be one of the provided options for mcq");
    }
  }

  return { valid: errors.length === 0, errors };
}
