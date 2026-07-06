export type ConceptStatus =
  | "locked"
  | "available"
  | "learning"
  | "mastered"
  | "review";

export interface StudentConceptState {

  conceptId: string;

  mastery: number;

  confidence: number;

  attempts: number;

  status: ConceptStatus;

  lastReviewed?: Date;

  nextReview?: Date;

  misconceptions: string[];

  favoriteQuestionTypes: string[];

}