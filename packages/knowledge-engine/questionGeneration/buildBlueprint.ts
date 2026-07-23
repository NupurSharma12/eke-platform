import {
  Concept,
  QuestionBlueprint,
  QuestionGenerationRequest,
  QuestionPattern,
} from "../../shared-types";
import { findSuitablePattern } from "./findSuitablePattern";

const DEFAULT_QUESTION_TYPE = "reasoning";

/**
 * Builds the generation contract for one request. Evidence-derived
 * when an existing QuestionPattern satisfies the request;
 * llm-inferred otherwise — never fabricated as evidence-derived
 * when it isn't. Pure and deterministic: given the same concept,
 * request, and patterns, always produces the same blueprint (the
 * one non-deterministic input, `createdAt`, is supplied by the
 * caller rather than read from the wall clock here, so this stays
 * a pure function).
 */
export function buildBlueprint(
  concept: Concept,
  request: QuestionGenerationRequest,
  patterns: QuestionPattern[],
  createdAt: string
): QuestionBlueprint {
  const match = findSuitablePattern(patterns, request);

  if (match) {
    return {
      conceptId: concept.id,
      conceptName: concept.name,
      questionType: request.questionType ?? match.template.type,
      difficulty: request.difficulty ?? match.template.recommendedDifficulty,
      bloomLevel: match.template.bloomLevel,
      description: match.template.description,
      sourcePatternIds: [match.pattern.id],
      origin: "evidence-derived",
      createdAt,
    };
  }

  return {
    conceptId: concept.id,
    conceptName: concept.name,
    questionType: request.questionType ?? DEFAULT_QUESTION_TYPE,
    difficulty: request.difficulty ?? concept.difficulty,
    description: concept.explanation,
    sourcePatternIds: [],
    origin: "llm-inferred",
    createdAt,
  };
}
