import {
  AssessmentStructureEvidence,
  DifficultyLevel,
  QuestionType,
} from "../../shared-types";
import { ExamBlueprint, ExamBlueprintAllocation } from "./examBlueprint";

const VALID_DIFFICULTIES: DifficultyLevel[] = [
  "foundation",
  "grade",
  "advanced",
  "olympiad",
];

/**
 * Everything discoverExamBlueprint needs that observed evidence
 * cannot supply. difficulty/marksEach are never derivable from
 * AssessmentStructureEvidence (it only ever records questionType +
 * count), so both are caller-supplied policy rather than inferred
 * — the same reasoning that kept normalizeConcepts' hardcoded
 * defaults from being repeated here. targetQuestionCount is a
 * request property (how big a practice paper the caller wants),
 * not something evidence should determine either.
 */
export interface BlueprintDiscoveryPolicy {
  targetQuestionCount: number;

  defaultDifficulty: DifficultyLevel;

  defaultMarksEach: number;
}

/**
 * Deterministically discovers an ExamBlueprint's question-type mix
 * from one or more AssessmentStructureEvidence records, rescaled to
 * a requested paper size.
 *
 * What this does: sums observed counts per questionType across all
 * supplied evidence, derives each type's proportion of that pooled
 * total, and rescales those proportions onto
 * policy.targetQuestionCount using largest-remainder rounding so
 * the result sums to exactly the requested total. difficulty and
 * marksEach are applied uniformly from policy — never derived from
 * evidence, since evidence carries no signal for either.
 *
 * What this deliberately does NOT do: call an LLM (this is pure
 * arithmetic, fully deterministic); inspect Chapter, Concept,
 * ExamScope, or QuestionPattern; look at documentType or any notion
 * of source authority; classify or reject evidence by source
 * identity (the caller is responsible for only supplying evidence
 * sources meant to inform this one blueprint); or call
 * validateExamBlueprint (the caller validates the result, exactly
 * as any other blueprint-producing path would).
 *
 * Throws (plain Error, matching this module's existing convention
 * of throwing for a request that has no valid result to compute —
 * see PendingChapterSelectedError's sibling reasoning) when:
 *  - `evidence` is empty
 *  - the pooled observed count across all evidence is zero
 *  - `policy.targetQuestionCount` is not a positive integer
 *  - `policy.defaultMarksEach` is not a positive, finite number
 *  - `policy.defaultDifficulty` is not a supported DifficultyLevel
 * There is no partial/degraded result for these cases: either a
 * full ExamBlueprint is computed, or nothing is returned at all.
 */
export function discoverExamBlueprint(
  evidence: AssessmentStructureEvidence[],
  policy: BlueprintDiscoveryPolicy
): ExamBlueprint {
  if (evidence.length === 0) {
    throw new Error(
      "discoverExamBlueprint requires at least one AssessmentStructureEvidence record."
    );
  }

  if (
    !Number.isInteger(policy.targetQuestionCount) ||
    policy.targetQuestionCount <= 0
  ) {
    throw new Error(
      "policy.targetQuestionCount must be a positive integer."
    );
  }

  if (
    typeof policy.defaultMarksEach !== "number" ||
    !Number.isFinite(policy.defaultMarksEach) ||
    policy.defaultMarksEach <= 0
  ) {
    throw new Error("policy.defaultMarksEach must be a positive number.");
  }

  if (!VALID_DIFFICULTIES.includes(policy.defaultDifficulty)) {
    throw new Error(
      `policy.defaultDifficulty "${policy.defaultDifficulty}" is not a supported DifficultyLevel.`
    );
  }

  const aggregate = new Map<QuestionType, number>();
  for (const record of evidence) {
    for (const allocation of record.allocations) {
      aggregate.set(
        allocation.questionType,
        (aggregate.get(allocation.questionType) ?? 0) + allocation.count
      );
    }
  }

  const totalObserved = Array.from(aggregate.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  if (totalObserved <= 0) {
    throw new Error(
      "discoverExamBlueprint requires at least one observed question across all supplied evidence."
    );
  }

  // Sorted by questionType so aggregation order, remainder
  // tie-breaking, and output order are all independent of the
  // order evidence/allocations happened to arrive in.
  const orderedTypes = Array.from(aggregate.keys()).sort();

  const exact = orderedTypes.map((questionType) => {
    const observedCount = aggregate.get(questionType)!;
    const share =
      (observedCount / totalObserved) * policy.targetQuestionCount;

    return {
      questionType,
      floor: Math.floor(share),
      remainder: share - Math.floor(share),
    };
  });

  const allocatedSoFar = exact.reduce((sum, entry) => sum + entry.floor, 0);
  let remainingSlots = policy.targetQuestionCount - allocatedSoFar;

  const counts = new Map(
    exact.map((entry) => [entry.questionType, entry.floor])
  );

  const byRemainderDescending = [...exact].sort(
    (a, b) => b.remainder - a.remainder
  );

  for (const entry of byRemainderDescending) {
    if (remainingSlots <= 0) {
      break;
    }
    counts.set(entry.questionType, counts.get(entry.questionType)! + 1);
    remainingSlots -= 1;
  }

  const allocations: ExamBlueprintAllocation[] = orderedTypes
    .map((questionType) => ({
      questionType,
      difficulty: policy.defaultDifficulty,
      count: counts.get(questionType)!,
      marksEach: policy.defaultMarksEach,
    }))
    .filter((allocation) => allocation.count > 0);

  return { allocations };
}
