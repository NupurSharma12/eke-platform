import { promises as fs } from "fs";
import path from "path";

import { DifficultyLevel, GeneratedQuestion, QuestionType } from "../../shared-types";

export interface QuestionBankFilter {
  conceptId?: string;
  difficulty?: DifficultyLevel;
  questionType?: QuestionType;
  /** Matches if the question was influenced by any of these patterns. */
  patternIds?: string[];
}

/**
 * Pure filter over an already-loaded set of questions — no I/O,
 * fully deterministic, easy to test in isolation from the
 * filesystem.
 */
export function filterQuestions(
  questions: GeneratedQuestion[],
  filter: QuestionBankFilter
): GeneratedQuestion[] {
  return questions.filter((question) => {
    if (filter.conceptId && question.conceptId !== filter.conceptId) return false;
    if (filter.difficulty && question.difficulty !== filter.difficulty) return false;
    if (filter.questionType && question.questionType !== filter.questionType) return false;
    if (
      filter.patternIds &&
      !filter.patternIds.some((id) => question.sourcePatternIds.includes(id))
    ) {
      return false;
    }
    return true;
  });
}

async function loadAllQuestions(): Promise<GeneratedQuestion[]> {
  const directory = path.resolve("data/questions/bank");

  let filenames: string[];

  try {
    filenames = await fs.readdir(directory);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const questions: GeneratedQuestion[] = [];

  for (const filename of filenames.filter((name) => name.endsWith(".json")).sort()) {
    const raw = await fs.readFile(path.join(directory, filename), "utf-8");
    questions.push(JSON.parse(raw) as GeneratedQuestion);
  }

  return questions;
}

/**
 * Deterministic scan of the persisted Question Bank, filtered by
 * the given criteria. Not a recommendation engine — a plain scan
 * over local files, which is all this phase needs.
 */
export async function findQuestions(
  filter: QuestionBankFilter
): Promise<GeneratedQuestion[]> {
  const all = await loadAllQuestions();
  return filterQuestions(all, filter);
}
