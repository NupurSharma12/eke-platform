// packages/shared-types/concept.ts

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
}

export interface Concept {

  id: string;

  name: string;

  subject: string;

  chapter: string;

  learningObjective: string;

  grades: number[];

  curriculum: string[];

  difficulty: DifficultyLevel;

  bloomLevel: BloomLevel;

  explanation: string;

  realLifeExamples: string[];

  stories: string[];

  analogies: string[];

  prerequisites: ConceptReference[];

  leadsTo: ConceptReference[];

  misconceptions: Misconception[];

  teaching: TeachingStrategy;

  questionTemplates: QuestionTemplate[];

  estimatedMinutes: number;

  sourceDocuments: string[];

  version: number;
}