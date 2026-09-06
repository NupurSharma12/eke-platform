import { promises as fs } from "fs";
import path from "path";

import { AssessmentStructureEvidence } from "../../shared-types";

/**
 * One file per sourceDocumentId, same convention as
 * getRawExtractionPath/getSourceMetadataPath — re-ingesting the
 * same assessment document overwrites its own evidence rather
 * than duplicating it.
 */
export function getAssessmentStructureEvidencePath(
  sourceDocumentId: string
): string {
  return path.join(
    path.resolve("data/assessments/structure"),
    `${sourceDocumentId}.json`
  );
}

export async function saveAssessmentStructureEvidence(
  evidence: AssessmentStructureEvidence
): Promise<string> {
  const outputPath = getAssessmentStructureEvidencePath(
    evidence.sourceDocumentId
  );

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(evidence, null, 2),
    "utf-8"
  );

  return outputPath;
}
