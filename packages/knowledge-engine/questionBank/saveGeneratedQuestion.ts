import { promises as fs } from "fs";
import path from "path";

import { GeneratedQuestion } from "../../shared-types";

/**
 * Deterministic storage path from a question's own id — the same
 * id always resolves to the same file, so re-saving (e.g. after a
 * manual correction) overwrites in place rather than duplicating.
 * The question's *content* came from a non-deterministic LLM
 * call; this path mapping is the part that's deterministic.
 */
export function getGeneratedQuestionPath(id: string): string {
  return path.join(path.resolve("data/questions/bank"), `${id}.json`);
}

export async function saveGeneratedQuestion(
  question: GeneratedQuestion
): Promise<string> {
  const outputPath = getGeneratedQuestionPath(question.id);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(question, null, 2),
    "utf-8"
  );

  return outputPath;
}
