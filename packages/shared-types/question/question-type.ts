import { QuestionTemplate } from "../concept/concept";

/**
 * Reuses QuestionTemplate's existing type union rather than
 * inventing a parallel enum.
 */
export type QuestionType = QuestionTemplate["type"];
