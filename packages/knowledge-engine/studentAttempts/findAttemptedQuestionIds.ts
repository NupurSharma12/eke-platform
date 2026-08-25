import { loadAttempts } from "./recordQuestionAttempt";

/**
 * Every question id this student has ever submitted an answer to,
 * across all concepts/difficulties/questionTypes. Deliberately
 * unfiltered — a candidate pool for a specific (conceptId,
 * difficulty, questionType) already carries those fields on each
 * GeneratedQuestion, so callers narrow by cross-referencing against
 * that pool rather than this module duplicating the same filter.
 */
export async function findAttemptedQuestionIds(studentId: string): Promise<string[]> {
  const attempts = await loadAttempts(studentId);
  return attempts.map((a) => a.questionId);
}
