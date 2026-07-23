import { QuestionTemplate } from "./concept";
import { SourceContribution } from "./source-contribution";

/**
 * Source-specific question/assessment/challenge knowledge,
 * linked to a canonical concept, a source document, and the
 * contribution that produced it. Sibling of ConceptSource, but
 * for question-shaped content rather than core knowledge content
 * — a canonical concept may have one ConceptSource (its knowledge
 * foundation) and several QuestionPatterns (depth/challenge,
 * question-pattern, and/or assessment-pattern, from as many
 * sources as have contributed).
 *
 * Deliberately reuses QuestionTemplate as-is rather than
 * inventing new fields: `questionTemplates` is genuinely all the
 * question-shaped data the current extraction pipeline produces
 * (description, type, bloomLevel, recommendedDifficulty). Fields
 * like reasoning complexity beyond bloomLevel, concept
 * combinations, and distractor patterns are not populated because
 * nothing upstream currently extracts them — adding empty/guessed
 * values for them here would be fabrication, not honest
 * representation.
 */
export interface QuestionPattern {
  id: string;

  canonicalConceptId: string;

  sourceDocumentId: string;

  contribution: SourceContribution;

  questionTemplates: QuestionTemplate[];

  extractedAt: string;
}
