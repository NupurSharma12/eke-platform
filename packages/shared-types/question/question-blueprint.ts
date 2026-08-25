import { BloomLevel, DifficultyLevel } from "../concept/concept";
import { QuestionType } from "./question-type";

/**
 * Whether a blueprint's shape came from real educational material
 * (a QuestionPattern) or was inferred by the LLM because no
 * suitable pattern existed. Never fabricated — an LLM-inferred
 * blueprint is always labeled as such, never presented as if it
 * came from a real source.
 */
export type BlueprintOrigin = "evidence-derived" | "llm-inferred";

/**
 * The intermediate generation contract between EKE and the LLM.
 * Deliberately not persisted as its own record — it's assembled
 * fresh per request from the canonical Concept plus whatever
 * QuestionPatterns exist, and its relevant fields (origin,
 * sourcePatternIds, difficulty, questionType) are carried forward
 * directly into the resulting GeneratedQuestion for provenance,
 * rather than requiring a separate blueprint store to look up.
 */
export interface QuestionBlueprint {
  conceptId: string;

  conceptName: string;

  questionType: QuestionType;

  difficulty: DifficultyLevel;

  /** From QuestionTemplate.bloomLevel when evidence-derived; absent otherwise. */
  bloomLevel?: BloomLevel;

  /**
   * Evidence-derived: the matched QuestionTemplate's own
   * description, a real pattern description from a real source.
   * LLM-inferred: the canonical concept's own explanation, used
   * only as grounding context, not presented as a question
   * pattern.
   */
  description: string;

  /** QuestionPattern ids that informed this blueprint. Empty when llm-inferred. */
  sourcePatternIds: string[];

  origin: BlueprintOrigin;

  createdAt: string;
}
