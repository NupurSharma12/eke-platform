import { GeneratedQuestionDraft } from "../../shared-types";
import { ValidationResult } from "./validateQuestionGenerationRequest";
import { requiresVisualAsset } from "./requiresVisualAsset";
import { parseNumericAnswer } from "./parseNumericAnswer";

const HOW_MANY_PATTERN = /how many\b/i;
const FIRST_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/;
const ANGLE_TOLERANCE_DEGREES = 1;
const FRACTION_EPSILON = 1e-6;

/**
 * Deterministic, narrow checks for obvious problems that make a
 * draft unpresentable — deliberately not a general arithmetic
 * parser or content classifier (both would be fragile and are
 * explicitly out of scope). Checks three well-defined failure
 * classes:
 *
 * 1. A question phrased as a discrete count ("how many ...") whose
 *    stated correctAnswer is not a whole number — e.g. "How many
 *    slices does she eat?" / "6.4 slices", which is never a valid
 *    count of discrete objects.
 * 2. A question that depends on a visual asset (type "visual", or
 *    text referencing a diagram/graph/shaded region/etc.) but
 *    carries no visualSpec. Visual questions are a first-class
 *    capability (see visualSpec on GeneratedQuestionDraft) — this
 *    is not a blanket rejection of visual content, only of visual
 *    content with nothing deterministic backing it. A missing
 *    original source diagram never blocks a *new*, validated visual
 *    from being generated; it only blocks presenting a visual
 *    question with no visual at all.
 * 3. A visualSpec whose own numbers disagree with the rest of the
 *    draft — e.g. a fraction-bar spec describing 2/4 shaded, but a
 *    correctAnswer that isn't equivalent to 1/2. VisualSpecSchema
 *    (packages/ai/schemas) already guarantees a spec is internally
 *    well-formed; this is the separate check that it's *consistent
 *    with the question built around it*.
 */
export function validateQuestionConsistency(
  draft: GeneratedQuestionDraft
): ValidationResult {
  const errors: string[] = [];

  if (HOW_MANY_PATTERN.test(draft.questionText)) {
    const match = draft.correctAnswer.match(FIRST_NUMBER_PATTERN);

    if (match && !Number.isInteger(Number(match[0]))) {
      errors.push(
        `questionText asks "how many", which implies a whole-number count, ` +
        `but correctAnswer ("${draft.correctAnswer}") is not a whole number`
      );
    }
  }

  const isVisualDependent =
    draft.questionType === "visual" || requiresVisualAsset(draft.questionText);

  if (isVisualDependent && !draft.visualSpec) {
    errors.push(
      `questionText depends on a visual asset (diagram/graph/shaded region/etc.) ` +
      `but no visualSpec was provided`
    );
  }

  if (draft.visualSpec) {
    const answer = parseNumericAnswer(draft.correctAnswer);
    const spec = draft.visualSpec;

    if (spec.type === "fraction-bar" && answer !== null) {
      const expected = spec.shadedParts / spec.totalParts;
      if (Math.abs(answer - expected) > FRACTION_EPSILON) {
        errors.push(
          `visualSpec describes ${spec.shadedParts}/${spec.totalParts} shaded, but ` +
          `correctAnswer ("${draft.correctAnswer}") is not equivalent to that fraction`
        );
      }
    }

    if (spec.type === "angle" && answer !== null) {
      if (Math.abs(answer - spec.degrees) > ANGLE_TOLERANCE_DEGREES) {
        errors.push(
          `visualSpec specifies a ${spec.degrees}-degree angle, but correctAnswer ` +
          `("${draft.correctAnswer}") states a different value`
        );
      }
    }

    if (spec.type === "number-line" && answer !== null) {
      if (answer < spec.min || answer > spec.max) {
        errors.push(
          `correctAnswer ("${draft.correctAnswer}") falls outside the visualSpec's ` +
          `number line range [${spec.min}, ${spec.max}]`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
