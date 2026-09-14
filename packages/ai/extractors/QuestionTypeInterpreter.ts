import { ObservedQuestionEvidence, InterpretedQuestionEvidence } from "../../shared-types";

/**
 * Sibling of ConceptExtractor/DocumentStructureExtractor/
 * AssessmentStructureExtractor/QuestionPatternEvidenceExtractor, not
 * an extension of any of them: this classifies one already-observed
 * question (ObservedQuestionEvidence) into an
 * InterpretedQuestionEvidence — a distinct, standalone artifact, not
 * a QuestionPattern. See InterpretedQuestionEvidence's own doc
 * comment for why the two must not be blurred.
 */
export interface QuestionTypeInterpreter {
  interpret(evidence: ObservedQuestionEvidence): Promise<InterpretedQuestionEvidence>;
}
