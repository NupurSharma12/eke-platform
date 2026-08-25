import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";

/**
 * Builds an independent review prompt for a single generated
 * question. This is a second, separate LLM call from generation —
 * the reviewer is asked to recompute the answer itself rather than
 * simply trust the draft, so a wrong answer that "looks" plausible
 * still gets caught.
 */
export function buildQuestionReviewPrompt(
  draft: GeneratedQuestionDraft,
  blueprint: QuestionBlueprint
): string {
  return `
You are reviewing a practice question before it is shown to a Grade 5 student. Be strict — a rejected question is cheap to regenerate, but a wrong or low-quality question shown to a student is not.

Concept: ${blueprint.conceptName}
Requested question type: ${blueprint.questionType}
Requested difficulty: ${blueprint.difficulty}

Question: ${draft.questionText}
${draft.options ? `Options: ${draft.options.join(", ")}` : ""}
Stated correct answer: ${draft.correctAnswer}
Explanation: ${draft.explanation}

Independently check, from scratch, without assuming the stated answer is correct:
1. Recompute the answer yourself from the numbers in the question. Does it match the stated correct answer exactly?
2. Does the explanation's reasoning actually support the stated answer?
3. Is the question free of irrelevant information and numbers that are not needed to solve it?
4. If the answer represents a count of discrete, indivisible objects (e.g. slices, people, coins), is it a whole number?
5. Is the question genuinely about "${blueprint.conceptName}" and appropriate for "${blueprint.difficulty}" difficulty (for "olympiad", it should require genuine multi-step reasoning, not a single trivial calculation)?

Return ONLY valid JSON in exactly this format:

{
  "approved": boolean,
  "reason": "string, required and specific when approved is false, omit or leave empty when approved is true"
}
`;
}
