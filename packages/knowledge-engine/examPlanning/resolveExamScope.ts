import { Chapter, Concept } from "../../shared-types";
import { resolveChapterConcepts } from "./resolveChapterConcepts";
import { PendingChapterSelectedError } from "./PendingChapterSelectedError";

/**
 * The curriculum boundary for one exam-planning request: which
 * concepts are eligible to be tested at all, per ADR-006's
 * "curriculum scope" definition. Deliberately narrow — this is not
 * ExamPlan. It carries nothing about assessment intent, blueprint,
 * or evidence policy; those are separate, later concerns.
 */
export interface ExamScope {
  eligibleConceptIds: string[];
}

/**
 * Resolves the curriculum-scope boundary for a set of selected
 * chapters, per ADR-006: "A school exam may only use confirmed
 * chapters. Pending chapter metadata must never silently become an
 * exam boundary."
 *
 * This function answers a different question than
 * resolveChapterConcepts: that function asks "which concepts belong
 * to this chapter?"; this one asks "which of the selected chapters
 * are even valid to define a boundary with?" The pending/confirmed
 * check therefore lives here, not there.
 *
 * Throws PendingChapterSelectedError if any selected chapter is not
 * yet confirmed — never silently drops it, never treats it as
 * confirmed, and never falls back to resolving concepts from it.
 * There is no partial-success path: either every selected chapter is
 * confirmed and scope is resolved, or nothing is resolved at all.
 *
 * An empty selection, or confirmed chapters that resolve to zero
 * concepts, is a valid (if unhelpful) explicit result — an empty
 * `eligibleConceptIds` array — never a signal to look beyond the
 * selected chapters for concepts.
 */
export function resolveExamScope(
  chapters: Chapter[],
  concepts: Concept[]
): ExamScope {
  const pendingChapters = chapters.filter(
    (chapter) => chapter.status !== "confirmed"
  );

  if (pendingChapters.length > 0) {
    throw new PendingChapterSelectedError(pendingChapters);
  }

  const eligibleConceptIds = new Set<string>();
  for (const chapter of chapters) {
    for (const conceptId of resolveChapterConcepts(chapter, concepts)) {
      eligibleConceptIds.add(conceptId);
    }
  }

  return { eligibleConceptIds: Array.from(eligibleConceptIds).sort() };
}
