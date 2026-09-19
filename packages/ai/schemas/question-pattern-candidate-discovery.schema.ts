import { z } from "zod";

/**
 * The raw shape the LLM is expected to return for one deterministic
 * pre-group: a partition of the local observation indexes it was
 * given (1-indexed, never the real ObservedQuestionEvidence.id) into
 * zero or more groups, each with a description of the shared
 * structural form. Deliberately excludes every application-owned
 * field (id, sourceDocumentId, observedEvidenceIds, sharedQuestionType,
 * confidence, interpretedAt, status) — those are derived by
 * QuestionPatternCandidateDiscoveryService from the deterministic
 * pre-group itself, never read from this schema's output. Also
 * deliberately excludes concept, difficulty, Bloom level, marks, and
 * generation QuestionType: nothing in the prompt asks for them, so
 * nothing here validates them either.
 *
 * Index-level integrity (every index in range, no duplicates within
 * or across groups, every supplied observation accounted for) is
 * NOT enforced by this schema — Zod can only validate shape, not
 * cross-reference against the pre-group size the caller supplied.
 * That validation happens in the service, against the actual
 * pre-group it sent.
 */
export const QuestionPatternCandidateGroupSchema = z.object({
  observationIndexes: z.array(z.number().int().positive()).min(1),
  patternDescription: z.string().min(1, "patternDescription must be a non-empty description"),
});

export const QuestionPatternCandidateDiscoveryResultSchema = z.object({
  groups: z.array(QuestionPatternCandidateGroupSchema),
});
