import { promises as fs } from "fs";
import path from "path";

import { SourceMetadata } from "../../shared-types";

/**
 * Where a SourceMetadata record for a given source document
 * lives. One file per sourceDocumentId, so re-ingesting the same
 * document overwrites its own metadata rather than duplicating
 * it — same convention as getRawExtractionPath.
 */
export function getSourceMetadataPath(sourceDocumentId: string): string {
  return path.join(
    path.resolve("data/sources/metadata"),
    `${sourceDocumentId}.json`
  );
}

export async function saveSourceMetadata(
  metadata: SourceMetadata
): Promise<string> {
  const outputPath = getSourceMetadataPath(metadata.sourceDocumentId);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(metadata, null, 2),
    "utf-8"
  );

  return outputPath;
}
