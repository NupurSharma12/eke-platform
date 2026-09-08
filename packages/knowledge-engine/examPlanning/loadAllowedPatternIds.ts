import { loadQuestionPatterns } from "../canonicalization";
// Specific submodule, not the ingestion barrel — that barrel also
// re-exports ./parseDocument, which pulls in pdf-parse/pdfjs-dist and
// breaks Next's webpack bundling for any API route that imports
// generatePracticePaper (which imports this file directly). Same
// reasoning already applied to packages/generateQuestion.ts's own
// imports; a pure import-path change, no referenced logic moved.
import { loadSourceMetadata } from "../ingestion/loadSourceMetadata";
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
