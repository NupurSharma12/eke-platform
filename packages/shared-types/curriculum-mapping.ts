export interface CurriculumMapping {

  conceptId: string;

  board: string;

  grade: number;

  subject: string;

  chapter: string;

  chapterOrder?: number;

  learningObjectives: string[];

  sourceDocuments: string[];
}