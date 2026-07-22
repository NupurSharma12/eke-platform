import { promises as fs } from "fs";
import path from "path";

import { ConceptSource } from "../../shared-types";

/**
 * Where a ConceptSource record lives. Nested by canonical
 * concept id, then source document id — so identity
 * (canonicalConceptId + sourceDocumentId) maps to exactly one
 * file, and re-ingesting the same source for the same concept
 * overwrites that file in place instead of creating a duplicate.
 */
export function getConceptSourcePath(
  canonicalConceptId: string,
  sourceDocumentId: string
): string {
  return path.join(
    path.resolve("data/concepts/sources"),
    canonicalConceptId,
    `${sourceDocumentId}.json`
  );
}

export async function saveConceptSource(
  source: ConceptSource
): Promise<string> {
  const outputPath = getConceptSourcePath(
    source.canonicalConceptId,
    source.sourceDocumentId
  );

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(source, null, 2),
    "utf-8"
  );

  return outputPath;
}

export async function saveConceptSources(
  sources: ConceptSource[]
): Promise<string[]> {
  const paths: string[] = [];

  for (const source of sources) {
    paths.push(await saveConceptSource(source));
  }

  return paths;
}
