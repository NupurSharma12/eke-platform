import { Chapter, Concept } from "../../shared-types";

/**
 * Resolves which canonical Concepts belong to a Chapter, using only
 * the source-document relationship that already exists between them
 * (Chapter.sourceDocumentIds and Concept.sourceDocuments). This is
 * the one factual link between curriculum structure and canonical
 * knowledge — no chapter name/number/grade/subject/board is ever
 * consulted, and Concept gains no curriculum field as a result.
 *
 * A concept matches when at least one of its sourceDocuments is
 * also one of the chapter's sourceDocumentIds. Pure and side-effect
 * free: does not read/write anything, and does not mutate either
 * argument.
 *
 * Result is sorted by concept id, so repeated calls with equivalent
 * input are order-stable regardless of input ordering.
 */
export function resolveChapterConcepts(
  chapter: Chapter,
  concepts: Concept[]
): string[] {
  const chapterDocumentIds = new Set(chapter.sourceDocumentIds);

  const matchingIds = concepts
    .filter((concept) =>
      concept.sourceDocuments.some((documentId) =>
        chapterDocumentIds.has(documentId)
      )
    )
    .map((concept) => concept.id);

  return Array.from(new Set(matchingIds)).sort();
}
