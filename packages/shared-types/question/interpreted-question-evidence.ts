/**
 * The observed *form* of a question as it actually appears in
 * source material — deliberately separate from the generation-
 * oriented `QuestionType` (question-type.ts), which is consumed by
 * `QuestionBlueprint`/`generateQuestion` and represents "what kind
 * of question EKE should produce," not "what kind of question was
 * observed." The two vocabularies are structurally different for a
 * reason: `QuestionType`'s six values were chosen for what EKE knows
 * how to *generate*, and widening it to also cover every observed
 * form risks silently changing generation behavior for unrelated
 * code paths. This type must never be treated as interchangeable
 * with `QuestionType`, and nothing in this milestone converts one
 * into the other.
 *
 * "other" is a deliberate, honest escape hatch, not a placeholder to
 * fill in later: real source material will contain forms this list
 * doesn't anticipate, and forcing an unrecognized form into one of
 * the named categories would be exactly the kind of fabrication this
 * evidence pipeline has consistently avoided (see
 * ObservedQuestionEvidence's own doc comment). "other" lets the
 * classification stay honest instead of guessing.
 */
export type ObservedQuestionType =
  | "mcq"
  | "true-false"
  | "fill-blanks"
  | "matching"
  | "sequencing"
  | "short-answer"
  | "diagram-based"
  | "other";

/**
 * What EKE inferred/classified about one already-observed question —
 * never a copy of the observed evidence itself. Deliberately does
 * NOT duplicate `observedText`: this artifact references the
 * evidence it classifies by id (`observedEvidenceId`), so "what was
 * actually observed" (ObservedQuestionEvidence) and "what was
 * inferred about it" (this type) stay in two separate records rather
 * than blurring into one enriched object. This is a standalone
 * artifact for this milestone — it does not feed QuestionPattern,
 * canonical Concepts, difficulty, or generation; see this
 * milestone's own scope notes for why that bridge is explicitly
 * deferred.
 */
export interface InterpretedQuestionEvidence {
  /** References ObservedQuestionEvidence.id — never duplicates its content. */
  observedEvidenceId: string;

  questionType: ObservedQuestionType;

  /** Free-text description of how the learner is expected to answer (e.g. "select one option", "write one word"). */
  answerStyle: string;

  interpretedAt: string;

  status: "pending";
}
