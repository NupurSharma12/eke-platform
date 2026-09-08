import { promises as fs } from "fs";
import path from "path";

import { DocumentStructureCandidate } from "../../shared-types";

/**
 * One file per sourceDocumentId, same convention as
 * getAssessmentStructureEvidencePath/getSourceMetadataPath —
 * re-analyzing the same document overwrites its own candidate
 * rather than duplicating it. Deliberately a separate directory
 * from data/curriculum/ (ChapterRegistry) and data/assessments/
 * (AssessmentStructureEvidence): a DocumentStructureCandidate is
 * never read by resolveExamScope or any curriculum-scope logic, and
 * this function never touches ChapterRegistry or Chapter in any way
 * — see DocumentStructureCandidate's own doc comment.
 */
export function getDocumentStructureCandidatePath(
  sourceDocumentId: string
): string {
  return path.join(
    path.resolve("data/documents/structure-candidates"),
    `${sourceDocumentId}.json`
  );
}

export async function saveDocumentStructureCandidate(
  candidate: DocumentStructureCandidate
): Promise<string> {
  const outputPath = getDocumentStructureCandidatePath(
    candidate.sourceDocumentId
  );

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
