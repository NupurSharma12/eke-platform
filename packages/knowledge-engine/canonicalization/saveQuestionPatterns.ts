import { promises as fs } from "fs";
import path from "path";

import { QuestionPattern } from "../../shared-types";

/**
 * Where a QuestionPattern record lives. Nested by canonical
 * concept id, then a filename combining source document and
 * contribution — a single source can contribute more than one
 * QuestionPattern to the same concept (e.g. an Olympiad book is
 * both depth-challenge and question-pattern), so the contribution
 * must be part of the identity, not just the source.
 */
export function getQuestionPatternPath(
  canonicalConceptId: string,
  sourceDocumentId: string,
  contribution: string
): string {
  return path.join(
    path.resolve("data/concepts/patterns"),
    canonicalConceptId,
    `${sourceDocumentId}__${contribution}.json`
  );
}

export async function saveQuestionPattern(
  pattern: QuestionPattern
): Promise<string> {
  const outputPath = getQuestionPatternPath(
    pattern.canonicalConceptId,
    pattern.sourceDocumentId,
    pattern.contribution
  );

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(pattern, null, 2),
    "utf-8"
  );

  return outputPath;
}

export async function saveQuestionPatterns(
  patterns: QuestionPattern[]
): Promise<string[]> {
  const paths: string[] = [];

  for (const pattern of patterns) {
    paths.push(await saveQuestionPattern(pattern));
  }

  return paths;
}
