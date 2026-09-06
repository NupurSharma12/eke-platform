import { promises as fs } from "fs";

import { SourceMetadata } from "../../shared-types";
import { getSourceMetadataPath } from "./saveSourceMetadata";

/**
 * Loads the SourceMetadata record for one source document, or
 * `null` if none exists — mirrors loadQuestionPatterns'/
 * loadKnowledgeGraph's ENOENT-tolerant read. A missing record is a
 * normal, expected outcome here (many callers need to ask "do we
 * even know what this document is?" without that being an error),
 * unlike loadChapterRegistry's "hasn't been curated yet" case,
 * which throws because there is no sensible default for a whole
 * grade/subject registry.
 */
export async function loadSourceMetadata(
  sourceDocumentId: string
): Promise<SourceMetadata | null> {
  const metadataPath = getSourceMetadataPath(sourceDocumentId);

  let raw: string;
  try {
    raw = await fs.readFile(metadataPath, "utf-8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }

  return JSON.parse(raw) as SourceMetadata;
}
