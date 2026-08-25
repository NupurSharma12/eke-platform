import {
  QuestionGenerationRequest,
  QuestionPattern,
  QuestionTemplate,
} from "../../shared-types";

export interface SuitablePatternMatch {
  pattern: QuestionPattern;
  template: QuestionTemplate;
}

/**
 * Deterministically scans a concept's existing QuestionPatterns
 * for one whose own question templates satisfy the request's
 * (optional) type/difficulty constraints. Returns the first match
 * in a stable order — no scoring, no similarity ranking.
 *
 * A template describing a visual (e.g. "What is the fraction
 * represented by the shaded region?") is a legitimate match here —
 * a real source pattern extracted from a PDF is evidence that this
 * kind of question is worth asking, even though the original
 * diagram was never captured. buildBlueprint/the generation prompt
 * are responsible for treating it as inspiration for a *newly*
 * generated, validated visualSpec, never as a claim that the
 * original figure is available.
 */
export function findSuitablePattern(
  patterns: QuestionPattern[],
  request: QuestionGenerationRequest
): SuitablePatternMatch | null {
  const candidates = request.patternIds
    ? patterns.filter((pattern) => request.patternIds!.includes(pattern.id))
    : patterns;

  for (const pattern of candidates) {
    for (const template of pattern.questionTemplates) {
      const typeMatches =
        !request.questionType || template.type === request.questionType;
      const difficultyMatches =
        !request.difficulty ||
        template.recommendedDifficulty === request.difficulty;

      if (typeMatches && difficultyMatches) {
        return { pattern, template };
      }
    }
  }

  return null;
}
