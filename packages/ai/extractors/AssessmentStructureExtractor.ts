import {
  ParsedDocument,
  AssessmentStructureEvidence,
  DocumentType,
} from "../../shared-types";

/**
 * Sibling of ConceptExtractor, not an extension of it: this
 * extracts a different kind of thing (observed assessment
 * structure) from the same ParsedDocument input, and must not be
 * folded into ConceptExtractionResult's contract. Consumes
 * ParsedDocument unmodified — no new field was needed on it.
 */
export interface AssessmentStructureExtractor {
  extract(document: ParsedDocument): Promise<AssessmentStructureEvidence>;
}

/**
 * Which document types are themselves assessment documents, and
 * therefore eligible for assessment-structure extraction. A
 * textbook/worksheet/assignment never runs through this extractor
 * — only a document that is an exam or an Olympiad sample paper.
 * Deliberately a short, explicit list rather than "everything
 * except textbook" so adding a new DocumentType never silently
 * opts it in.
 */
export const ASSESSMENT_EVIDENCE_DOCUMENT_TYPES: DocumentType[] = [
  "exam",
  "olympiad",
];

export function shouldExtractAssessmentStructure(
  documentType: DocumentType
): boolean {
  return ASSESSMENT_EVIDENCE_DOCUMENT_TYPES.includes(documentType);
}
