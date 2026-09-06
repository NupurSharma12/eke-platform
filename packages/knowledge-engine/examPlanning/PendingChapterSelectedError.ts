import { Chapter } from "../../shared-types";

/**
 * Thrown when a caller selects a chapter whose curriculum identity
 * (name/number) has not been human-confirmed yet. Per ADR-006, a
 * pending chapter is never used to define a curriculum-scope
 * boundary — not silently ignored, not treated as confirmed, and
 * not resolved into concepts. Thrown (rather than folded into a
 * ValidationResult) so a caller cannot mistake this for an ordinary
 * empty-scope outcome, matching the QuestionPoolExhaustedError
 * convention of using a distinct error type for a state that must
 * never be confused with a ordinary result.
 */
export class PendingChapterSelectedError extends Error {
  readonly pendingChapterIds: string[];

  constructor(pendingChapters: Chapter[]) {
    super(
      `Selected chapter(s) are still pending confirmation and cannot ` +
      `define a curriculum boundary: ${pendingChapters.map((c) => c.id).join(", ")}`
    );
    this.name = "PendingChapterSelectedError";
    this.pendingChapterIds = pendingChapters.map((c) => c.id);
  }
}
