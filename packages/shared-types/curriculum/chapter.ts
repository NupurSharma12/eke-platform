/**
 * A curriculum chapter, as a parent/teacher would recognize it —
 * the user-facing selection unit for exam-prep practice. Concepts
 * remain the internal resolution mechanism (see
 * knowledge-engine/examPlanning/resolveChapterConcepts) and are
 * never selected directly by a user.
 *
 * `number`/`name` are deliberately nullable: nothing in the
 * existing ingestion pipeline captures a chapter's real title or
 * order (see the chapter registry data file's own doc comment), so
 * a Chapter can exist in "pending" form — its `sourceDocumentIds`
 * already known and correct, its human identity not yet confirmed
 * — before it is ever shown to a user. `status` is what gates that:
 * only "confirmed" chapters are exposed by the chapters API route.
 */
export type ChapterStatus = "pending" | "confirmed";

export interface Chapter {
  /**
   * Stable across the pending -> confirmed transition, so nothing
   * downstream (an ExamPlan referencing this chapter, a UI
   * selection) breaks once a chapter's name/number is filled in.
   * Derived from grade/subject/sourceDocumentIds, never from the
   * (possibly still-unknown) name.
   */
  id: string;

  grade: number;

  subject: string;

  /** Display order within the subject. Null while pending. */
  number: number | null;

  /** The chapter's real title. Null while pending. */
  name: string | null;

  /**
   * Which already-ingested source documents (Concept.sourceDocuments
   * entries) belong to this chapter. This is the one part of a
   * pending Chapter that is factual, not guessed — it comes
   * directly from what has already been ingested into the
   * Knowledge Graph, not from an assumption about what a chapter
   * called `name` should contain.
   */
  sourceDocumentIds: string[];

  status: ChapterStatus;

  /** Optional free-text context for a human reviewer confirming this entry. */
  notes?: string;
}

/**
 * A source document that was deliberately left out of the chapter
 * registry, with the reason recorded — e.g. a sample paper is
 * assessment evidence, not textbook chapter content. Recorded
 * explicitly so "not a chapter" is a documented decision, not a
 * silent omission a future reviewer has to rediscover.
 */
export interface ExcludedChapterSource {
  sourceDocumentId: string;
  reason: string;
}

/**
 * The on-disk shape of one grade/subject's chapter registry (see
 * data/curriculum/*.json). One file per (grade, subject) pair.
 */
export interface ChapterRegistry {
  grade: number;
  subject: string;
  chapters: Chapter[];
  excluded: ExcludedChapterSource[];
}
