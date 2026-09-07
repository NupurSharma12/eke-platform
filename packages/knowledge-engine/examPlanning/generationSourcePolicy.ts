import {
  DocumentType,
  QuestionPattern,
  SourceContribution,
  SourceMetadata,
} from "../../shared-types";

/**
 * Which QuestionPatterns are allowed to influence generation, by
 * document type and/or contribution role. Deliberately small: this
 * is Step 7 of generation source policy — deciding which pattern
 * ids are allowed — not deciding what happens when none are (that
 * is a separate, later, explicitly-reviewed decision; see
 * resolveAllowedPatternIds' doc comment).
 *
 * Semantics for each field, independently:
 *  - omitted (`undefined`)  -> no restriction from this dimension
 *  - supplied, non-empty    -> a pattern must satisfy this dimension
 *  - supplied, empty (`[]`) -> nothing is allowed by this dimension
 *    (this is NOT the same as omitted — an explicit empty list is a
 *    deliberate "block everything on this axis", not "don't care")
 *
 * When both fields are supplied, a pattern must satisfy both.
 */
export interface GenerationSourcePolicy {
  allowedDocumentTypes?: DocumentType[];
  allowedContributions?: SourceContribution[];
}

/**
 * Pure decision function: given a set of QuestionPatterns, the
 * SourceMetadata records that describe where they came from, and a
 * GenerationSourcePolicy, returns exactly the pattern ids the
 * policy allows. No I/O, no mutation of any input, fully
 * deterministic — callers are responsible for loading `patterns`
 * and `sourceMetadata` themselves (see loadAllowedPatternIds for
 * the I/O-performing orchestration wrapper).
 *
 * `QuestionPattern.contribution` is the sole authority for
 * contribution filtering; `SourceMetadata.documentType` is the sole
 * authority for document-type filtering. Neither is ever inferred
 * from a pattern's id, filename, or any other incidental string —
 * the same "a resource identifier is never evidence" discipline
 * already established for chapter identity (ADR-006) applies here.
 *
 * Missing metadata: if `allowedDocumentTypes` is supplied (document
 * type filtering is active) and a pattern's sourceDocumentId has no
 * matching SourceMetadata record, that pattern is excluded — there
 * is nothing to check the restriction against, and an unknown
 * document is never assumed to satisfy it. If document-type
 * filtering is NOT active (allowedDocumentTypes is omitted),
 * missing metadata is irrelevant to this function's decision — a
 * pattern with no metadata can still be allowed purely on
 * contribution grounds (or unconditionally, if no restriction is
 * supplied at all).
 */
export function resolveAllowedPatternIds(
  patterns: QuestionPattern[],
  sourceMetadata: SourceMetadata[],
  policy: GenerationSourcePolicy
): string[] {
  const metadataBySourceDocumentId = new Map(
    sourceMetadata.map((metadata) => [metadata.sourceDocumentId, metadata])
  );

  const allowedIds = new Set<string>();

  for (const pattern of patterns) {
    if (policy.allowedDocumentTypes !== undefined) {
      const metadata = metadataBySourceDocumentId.get(pattern.sourceDocumentId);
      if (!metadata) {
        continue;
      }
      if (!policy.allowedDocumentTypes.includes(metadata.documentType)) {
        continue;
      }
    }

    if (policy.allowedContributions !== undefined) {
      if (!policy.allowedContributions.includes(pattern.contribution)) {
        continue;
      }
    }

    allowedIds.add(pattern.id);
  }

  return Array.from(allowedIds).sort();
}
