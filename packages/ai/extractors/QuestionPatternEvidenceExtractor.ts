import { ParsedDocument, ObservedQuestionEvidence } from "../../shared-types";

/**
 * Sibling of DocumentStructureExtractor/AssessmentStructureExtractor,
 * not an extension of either: this identifies actual observed
 * questions (evidence, not a generation pattern) from a
 * ParsedDocument. See ObservedQuestionEvidence's own doc comment for
 * why this is deliberately not QuestionPattern.
 */
export interface QuestionPatternEvidenceExtractor {
  extract(document: ParsedDocument): Promise<ObservedQuestionEvidence[]>;
}
