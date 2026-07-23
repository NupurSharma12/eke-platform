import { DifficultyLevel } from "./concept";
import { QuestionType } from "./question-type";

/**
 * The smallest usable request contract for this phase. No
 * grade/subject/curriculum fields — CurriculumMapping isn't
 * populated by anything yet, so "optional curriculum context if
 * already available" currently means there is none available.
 * No student-specific fields — that belongs to the future
 * Learning Arena / StudentLearningState phase, not this one.
 */
export interface QuestionGenerationRequest {
  conceptId: string;

  difficulty?: DifficultyLevel;

  questionType?: QuestionType;

  /** Explicit QuestionPattern ids to prefer, if the caller already knows which. */
  patternIds?: string[];
}
