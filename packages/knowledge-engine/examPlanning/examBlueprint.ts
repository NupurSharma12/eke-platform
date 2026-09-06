import { DifficultyLevel, QuestionType } from "../../shared-types";

/**
 * One slice of an assessment's structure: how many questions of a
 * given type/difficulty, and how many marks each is worth. Reuses
 * QuestionType/DifficultyLevel as-is rather than duplicating them —
 * the same reasoning question-type.ts already applies to itself.
 *
 * Deliberately has no conceptId, chapterId, or sourcePatternIds:
 * an ExamBlueprint describes assessment *structure* only (per
 * ADR-006/08-Decisions: a blueprint must never define or expand
 * curriculum scope). Binding an allocation to specific concepts is
 * ExamPlan's job, not this one's.
 */
export interface ExamBlueprintAllocation {
  questionType: QuestionType;

  difficulty: DifficultyLevel;

  count: number;

  marksEach: number;
}

/**
 * The full structure of an assessment: how many questions of each
 * type/difficulty, worth how many marks. Nothing else — no
 * curriculum boundary, no evidence/source policy, no concrete
 * questions or concepts. Those are ExamScope's, a future Evidence
 * Policy's, and ExamPlan's responsibilities respectively.
 *
 * totalQuestionCount/totalMarks are intentionally not stored fields
 * here — they are always derivable from `allocations`, and storing
 * them separately would create a second source of truth that could
 * drift out of sync with the allocations that actually define them.
 */
export interface ExamBlueprint {
  allocations: ExamBlueprintAllocation[];
}
