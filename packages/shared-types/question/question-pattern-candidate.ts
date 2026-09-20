import { ObservedQuestionType } from "./interpreted-question-evidence";

/**
 * A candidate reusable question form discovered by grouping one or
 * more already-interpreted observed questions — deliberately NOT a
 * QuestionPattern. QuestionPattern is concept-anchored and
 * generation-ready (canonicalConceptId, contribution,
 * questionTemplates with required bloomLevel/recommendedDifficulty);
 * this artifact has none of that. It only records "these observed
 * questions appear to share a structural form," nothing more — no
 * concept, chapter, difficulty, Bloom level, marks, or generation
 * QuestionType is assigned here, because nothing upstream of this
 * milestone can derive any of those safely. See this milestone's own
 * scope notes for why that bridge is explicitly deferred.
 *
 * A single-observation candidate (confidence: "single-observation")
 * is not a validated reusable pattern — it is one observation that
 * has not yet been corroborated by any other. Only
 * "multiple-observations" candidates have actually been confirmed,
 * by an LLM call, to share a genuine reusable form.
 */
export interface QuestionPatternCandidate {
  id: string;

  sourceDocumentId: string;

  /** References ObservedQuestionEvidence.id[] — never duplicates their content. */
  observedEvidenceIds: string[];

  /**
   * The ObservedQuestionType shared by every observation in this
   * candidate. Derived by application code from the deterministic
   * pre-group these observations came from — never asked of the LLM,
   * since the pre-group already guarantees this before the LLM ever
   * sees the group.
   */
  sharedQuestionType: ObservedQuestionType;

  /**
   * A description of the shared structural form, not any one
   * observation's exact wording. For a single-observation candidate
   * this is a conservative, deterministic description built only
   * from the interpreted evidence (questionType + answerStyle) —
   * never an LLM guess at reusability from one instance.
   */
  patternDescription: string;

  /**
   * "single-observation": exactly one observed question, not yet
   * corroborated as reusable by any other. "multiple-observations":
   * confirmed by one LLM call to share a genuine reusable form with
   * at least one other observation.
   */
  confidence: "single-observation" | "multiple-observations";

  interpretedAt: string;

  status: "pending";
}
