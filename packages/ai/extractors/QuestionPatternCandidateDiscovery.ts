import {
  ObservedQuestionEvidence,
  InterpretedQuestionEvidence,
  QuestionPatternCandidate,
} from "../../shared-types";

/**
 * Sibling of QuestionPatternEvidenceExtractor/QuestionTypeInterpreter,
 * not an extension of either: this discovers candidate reusable
 * question forms across already-interpreted observed questions,
 * producing QuestionPatternCandidate[] — a distinct, standalone
 * artifact, not a QuestionPattern. See QuestionPatternCandidate's own
 * doc comment for why the two must not be blurred.
 *
 * Unlike every other extractor in this codebase, this one does not
 * make one LLM call per input item — it deterministically bounds its
 * own LLM usage first (see QuestionPatternCandidateDiscoveryService).
 */
export interface QuestionPatternCandidateDiscovery {
  discover(
    observedEvidence: ObservedQuestionEvidence[],
    interpretedEvidence: InterpretedQuestionEvidence[]
  ): Promise<QuestionPatternCandidate[]>;
}
