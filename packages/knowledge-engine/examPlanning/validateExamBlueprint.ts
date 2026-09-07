import { DifficultyLevel, QuestionType } from "../../shared-types";
import { ExamBlueprint } from "./examBlueprint";

/**
 * Same shape as questionGeneration's ValidationResult, kept local
 * rather than imported so ExamBlueprint stays free of any
 * dependency on the question-generation package — it validates
 * assessment structure only, nothing question-generation-specific.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_QUESTION_TYPES: QuestionType[] = [
  "mcq",
  "visual",
  "word-problem",
  "reasoning",
  "fill-blanks",
  "olympiad",
];

const VALID_DIFFICULTIES: DifficultyLevel[] = [
  "foundation",
  "grade",
  "advanced",
  "olympiad",
];

/**
 * Deterministically validates an ExamBlueprint's structure — no
 * I/O, no curriculum/concept lookups, no LLM. Malformed input is
 * always reported as a ValidationResult, never thrown: an invalid
 * blueprint is ordinary bad input, distinct in kind from a boundary
 * violation like PendingChapterSelectedError.
 *
 * Errors are collected in allocation order, each prefixed with its
 * index, so the same malformed blueprint always produces the same
 * error list in the same order.
 */
export function validateExamBlueprint(
  blueprint: ExamBlueprint
): ValidationResult {
  const errors: string[] = [];

  if (!blueprint.allocations || blueprint.allocations.length === 0) {
    errors.push("allocations must contain at least one entry");
    return { valid: false, errors };
  }

  blueprint.allocations.forEach((allocation, index) => {
    const prefix = `allocations[${index}]`;

    if (!VALID_QUESTION_TYPES.includes(allocation.questionType)) {
      errors.push(
        `${prefix}.questionType "${allocation.questionType}" is not a supported QuestionType`
      );
    }

    if (!VALID_DIFFICULTIES.includes(allocation.difficulty)) {
      errors.push(
        `${prefix}.difficulty "${allocation.difficulty}" is not a supported DifficultyLevel`
      );
    }

    if (
      !Number.isInteger(allocation.count) ||
      allocation.count <= 0
    ) {
      errors.push(`${prefix}.count must be a positive integer`);
    }

    if (
      typeof allocation.marksEach !== "number" ||
      !Number.isFinite(allocation.marksEach) ||
      allocation.marksEach <= 0
    ) {
      errors.push(`${prefix}.marksEach must be a positive number`);
    }
  });

  return { valid: errors.length === 0, errors };
}
