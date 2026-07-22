// packages/shared-types/concept.ts

/**
 * Universal Concept Model
 *
 * A Concept represents an educational idea that is independent of:
 * - Board (CBSE, ICSE, IB...)
 * - Grade
 * - Curriculum
 *
 * Curriculum-specific information is maintained separately
 * in CurriculumMapping.
 */

export type DifficultyLevel =
  | "foundation"
  | "grade"
  | "advanced"
  | "olympiad";

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export interface ConceptReference {
  id: string;
  name: string;
}

export interface TeachingStrategy {
  primary: "visual" | "story" | "activity" | "game" | "discussion";

  activities: string[];

  parentTips: string[];

  visualIdeas: string[];
}

export interface Misconception {
  misconception: string;

  correction: string;

  confidence?: number;
}

export interface QuestionTemplate {
  type:
    | "mcq"
    | "visual"
    | "word-problem"
    | "reasoning"
    | "fill-blanks"
    | "olympiad";

  description: string;

  bloomLevel: BloomLevel;

  recommendedDifficulty: DifficultyLevel;
}

export interface ConceptMetadata {
  version: number;

  sourceDocuments: string[];

  createdAt: string;

  updatedAt: string;
}

export interface Concept {

  id: string;

  name: string;

  domains: string[]

  learningObjectives: string[];

  bloomLevel: BloomLevel;

  /**
   * Concept-level difficulty. Distinct from
   * QuestionTemplate.recommendedDifficulty, which may vary
   * per question generated for this concept.
   */
  difficulty: DifficultyLevel;

  explanation: string;

  realLifeExamples: string[];

  stories: string[];

  analogies: string[];

  prerequisites: ConceptReference[];

  leadsTo: ConceptReference[];

  relatedConcepts: ConceptReference[];

  misconceptions: Misconception[];

  teaching: TeachingStrategy;

  questionTemplates: QuestionTemplate[];

  estimatedMinutes: number;

  sourceDocuments: string[];

  version: number;

  keywords: string[];

  metadata: ConceptMetadata;
}