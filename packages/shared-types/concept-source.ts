import {
  BloomLevel,
  DifficultyLevel,
  Misconception,
  QuestionTemplate,
  TeachingStrategy,
} from "./concept";

/**
 * The full educational content contributed by one source
 * document toward one canonical Concept.
 *
 * A canonical Concept may be enriched by multiple sources
 * (NCERT, another textbook, an Olympiad book...). Rather than
 * blending all of their content into the Concept object itself
 * (which would lose attribution and could silently overwrite one
 * source's explanation/misconceptions with another's),
 * ConceptSource preserves each source's contribution separately
 * and in full.
 *
 * Identity is `${canonicalConceptId}::${sourceDocumentId}` —
 * deterministic, so re-ingesting the same source document for
 * the same canonical concept updates this same record rather
 * than creating a duplicate.
 */
export interface ConceptSource {
  id: string;

  canonicalConceptId: string;

  sourceDocumentId: string;

  /** This source's own name/phrasing for the concept, kept for provenance. */
  name: string;

  domains: string[];

  learningObjectives: string[];

  bloomLevel: BloomLevel;

  difficulty: DifficultyLevel;

  explanation: string;

  realLifeExamples: string[];

  stories: string[];

  analogies: string[];

  misconceptions: Misconception[];

  teaching: TeachingStrategy;

  questionTemplates: QuestionTemplate[];

  estimatedMinutes: number;

  keywords: string[];

  extractedAt: string;
}
