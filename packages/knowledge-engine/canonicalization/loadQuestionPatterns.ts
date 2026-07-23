import { promises as fs } from "fs";
import path from "path";

import { QuestionPattern } from "../../shared-types";

/**
 * Loads every QuestionPattern persisted for a canonical concept,
 * or an empty array if none exist yet — mirrors
 * loadKnowledgeGraph's ENOENT-tolerant read.
 */
export async function loadQuestionPatterns(
  canonicalConceptId: string
): Promise<QuestionPattern[]> {
  const directory = path.join(
    path.resolve("data/concepts/patterns"),
    canonicalConceptId
  );

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

  const patterns: QuestionPattern[] = [];

  for (const filename of filenames.filter((name) => name.endsWith(".json")).sort()) {
    const raw = await fs.readFile(path.join(directory, filename), "utf-8");
    patterns.push(JSON.parse(raw) as QuestionPattern);
  }

  return patterns;
}
