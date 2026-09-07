import { loadQuestionPatterns } from "../canonicalization";
import { loadSourceMetadata } from "../ingestion";
import { SourceMetadata } from "../../shared-types";
import {
  GenerationSourcePolicy,
  resolveAllowedPatternIds,
} from "./generationSourcePolicy";

/**
 * The I/O-performing counterpart to resolveAllowedPatternIds: loads
 * a concept's patterns and exactly the SourceMetadata those
 * patterns actually reference (deduplicated, missing records simply
 * omitted rather than erroring — see resolveAllowedPatternIds'
 * missing-metadata semantics), then calls the pure resolver. All
 * I/O lives here; the decision logic itself stays pure and testable
 * without touching the filesystem.
 */
export async function loadAllowedPatternIds(
  conceptId: string,
  policy: GenerationSourcePolicy
): Promise<string[]> {
  const patterns = await loadQuestionPatterns(conceptId);

  const uniqueSourceDocumentIds = Array.from(
    new Set(patterns.map((pattern) => pattern.sourceDocumentId))
  );

  const sourceMetadata: SourceMetadata[] = [];
  for (const sourceDocumentId of uniqueSourceDocumentIds) {
    const metadata = await loadSourceMetadata(sourceDocumentId);
    if (metadata) {
      sourceMetadata.push(metadata);
    }
  }

  return resolveAllowedPatternIds(patterns, sourceMetadata, policy);
}
