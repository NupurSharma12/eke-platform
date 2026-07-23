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
