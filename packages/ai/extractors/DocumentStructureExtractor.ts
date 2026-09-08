import { ParsedDocument, DocumentStructureCandidate } from "../../shared-types";

/**
 * Sibling of AssessmentStructureExtractor/ConceptExtractor, not an
 * extension of either: this extracts candidate structural ranges
 * (chapter/content and exercise/practice page ranges) from a
 * ParsedDocument, a different kind of thing from both concept
 * knowledge and observed assessment question-type counts. Consumes
 * ParsedDocument unmodified — no new field was needed on it.
 *
 * Unlike ConceptExtractor/AssessmentStructureExtractor (which both
 * operate on ParsedDocument.text), an implementation of this
 * interface MUST build its prompt from ParsedDocument.pages — the
 * whole point of this extractor is to localize a boundary to a real
 * page, which a flattened blob of text cannot express. See
 * DocumentStructureExtractorService and its prompt for how.
 */
export interface DocumentStructureExtractor {
  extract(document: ParsedDocument): Promise<DocumentStructureCandidate>;
}
