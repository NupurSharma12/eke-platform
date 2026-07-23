import { QuestionGenerationRequest } from "../../shared-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_DIFFICULTIES = ["foundation", "grade", "advanced", "olympiad"];
const VALID_QUESTION_TYPES = [
  "mcq",
  "visual",
  "word-problem",
  "reasoning",
  "fill-blanks",
  "olympiad",
];

export function validateQuestionGenerationRequest(
  request: QuestionGenerationRequest
): ValidationResult {
  const errors: string[] = [];

  if (!request.conceptId || !request.conceptId.trim()) {
    errors.push("conceptId is required");
  }

  if (request.difficulty && !VALID_DIFFICULTIES.includes(request.difficulty)) {
    errors.push(`difficulty "${request.difficulty}" is not a valid DifficultyLevel`);
  }

  if (
    request.questionType &&
    !VALID_QUESTION_TYPES.includes(request.questionType)
  ) {
    errors.push(`questionType "${request.questionType}" is not a valid QuestionType`);
  }

  return { valid: errors.length === 0, errors };
}
