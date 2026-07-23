import { DocumentType, SourceContribution } from "../../shared-types";

/**
 * The one place that decides what a document's user-facing type
 * means internally. A parent never sees or chooses this — they
 * only pick a DocumentType (see document-type.ts); this table is
 * what turns that choice into SourceContribution(s).
 *
 * A document can contribute to more than one category at once
 * (an Olympiad book is both depth-challenge and question-pattern)
 * — that's why the value is always an array, never a single tag.
 */
export const DOCUMENT_TYPE_CONTRIBUTIONS: Record<
  DocumentType,
  SourceContribution[]
> = {
  textbook: ["core-knowledge"],
  olympiad: ["depth-challenge", "question-pattern"],
  worksheet: ["question-pattern"],
  assignment: ["question-pattern"],
  exam: ["assessment-pattern"],
  "answer-key": ["assessment-pattern"],
  "student-work": ["student-evidence"],
  other: [],
};
