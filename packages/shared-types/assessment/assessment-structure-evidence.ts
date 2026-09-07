import { QuestionType } from "../question/question-type";

/**
 * How many observed questions of one type appeared in an
 * assessment document. Deliberately carries nothing beyond type
 * and count — no difficulty, marks, or section, since nothing in
 * the current extraction pipeline can honestly produce those for
 * an arbitrary assessment document (see AssessmentStructureEvidence
 * doc comment for why fabricating them would be worse than
 * omitting them).
 */
export interface AssessmentStructureAllocation {
  questionType: QuestionType;

  count: number;
}

/**
 * Source-backed, observed structure of one assessment document —
 * "this paper had N MCQs, M word-problems, ..." — nothing more.
 * Sibling of QuestionPattern in spirit (source-derived evidence
 * tied to a document id) but answers a different question:
 * QuestionPattern says "what does a good question for this concept
 * look like"; this says "how many questions of what type did this
 * specific assessment document actually contain." Neither is
 * derived from the other and neither should be conflated with the
 * other.
 *
 * Carries no conceptId, chapterId, or curriculum field of any
 * kind — this is assessment-document evidence, not curriculum
 * scope, and must stay usable as an ExamBlueprint-discovery input
 * without dragging in Concept/Chapter/ExamScope.
 */
export interface AssessmentStructureEvidence {
  sourceDocumentId: string;

  allocations: AssessmentStructureAllocation[];

  extractedAt: string;
}
