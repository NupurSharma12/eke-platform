import { Concept, QuestionPattern, SourceContribution } from "../../shared-types";

/**
 * Builds a QuestionPattern record for one (concept, source,
 * contribution) combination. Reuses the concept's own
 * questionTemplates verbatim — see question-pattern.ts for why
 * nothing beyond what extraction actually produced is included.
 */
export function buildQuestionPattern(
  concept: Concept,
  canonicalConceptId: string,
  sourceDocumentId: string,
  contribution: SourceContribution
): QuestionPattern {
  return {
    id: `${canonicalConceptId}::${sourceDocumentId}::${contribution}`,
    canonicalConceptId,
    sourceDocumentId,
    contribution,
    questionTemplates: concept.questionTemplates,
    extractedAt: concept.metadata.createdAt,
  };
}
