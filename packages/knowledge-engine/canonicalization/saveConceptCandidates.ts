import { promises as fs } from "fs";
import path from "path";

import { ConceptCandidate } from "../../shared-types";

/**
 * Where a ConceptCandidate record lives. Filename is derived
 * from the candidate's own deterministic id (extractedName +
 * sourceDocumentId), so re-processing the same source again
 * overwrites the same file rather than duplicating it.
 */
export function getConceptCandidatePath(candidateId: string): string {
  const safeFilename = candidateId.replace(/[^a-z0-9._-]+/gi, "_");

  return path.join(
    path.resolve("data/concepts/candidates"),
    `${safeFilename}.json`
  );
}

export async function saveConceptCandidate(
  candidate: ConceptCandidate
): Promise<string> {
  const outputPath = getConceptCandidatePath(candidate.id);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(candidate, null, 2),
    "utf-8"
  );

  return outputPath;
}

export async function saveConceptCandidates(
  candidates: ConceptCandidate[]
): Promise<string[]> {
  const paths: string[] = [];

  for (const candidate of candidates) {
    paths.push(await saveConceptCandidate(candidate));
  }

  return paths;
}
