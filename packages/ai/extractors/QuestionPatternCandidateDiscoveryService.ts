import {
  ObservedQuestionEvidence,
  InterpretedQuestionEvidence,
  QuestionPatternCandidate,
  ObservedQuestionType,
} from "../../shared-types";
import { AIProvider } from "../providers/AIProvider";
import { QuestionPatternCandidateDiscoveryResultSchema } from "../schemas/question-pattern-candidate-discovery.schema";
import { buildQuestionPatternCandidateDiscoveryPrompt } from "../prompts/question-pattern-candidate-discovery.prompt";
import { QuestionPatternCandidateDiscovery } from "./QuestionPatternCandidateDiscovery";

interface PreGroupItem {
  observed: ObservedQuestionEvidence;
  interpreted: InterpretedQuestionEvidence;
}

/**
 * Deterministic (sourceDocumentId, ObservedQuestionType) pre-grouping
 * — the ONLY boundary allowed to bound LLM input size. Deliberately
 * does not use sectionLabel, concept, difficulty, Bloom level, marks,
 * chapter, SourceContribution, or generation QuestionType as grouping
 * criteria: those are either unavailable at this stage, unsafe to
 * infer, or belong to a later policy/generation stage. Stable
 * ordering preserved: pre-groups appear in first-encounter order, and
 * observations within each pre-group keep the order of
 * `observedEvidence`.
 *
 * An observed question with no corresponding interpretation is
 * skipped, not fabricated a group of its own — there is nothing
 * honest to group it by yet.
 */
function buildPreGroups(
  observedEvidence: ObservedQuestionEvidence[],
  interpretedEvidence: InterpretedQuestionEvidence[]
): PreGroupItem[][] {
  const interpretedByEvidenceId = new Map<string, InterpretedQuestionEvidence>();
  for (const interpreted of interpretedEvidence) {
    interpretedByEvidenceId.set(interpreted.observedEvidenceId, interpreted);
  }

  const groupsByKey = new Map<string, PreGroupItem[]>();
  const keyOrder: string[] = [];

  for (const observed of observedEvidence) {
    const interpreted = interpretedByEvidenceId.get(observed.id);
    if (!interpreted) {
      continue;
    }

    const key = `${observed.sourceDocumentId}::${interpreted.questionType}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = [];
      groupsByKey.set(key, group);
      keyOrder.push(key);
    }
    group.push({ observed, interpreted });
  }

  return keyOrder.map((key) => groupsByKey.get(key)!);
}

/** Deterministic, reproducible from the same observed evidence — never random, never LLM-supplied. */
function buildCandidateId(sourceDocumentId: string, observedEvidenceIds: string[]): string {
  return `${sourceDocumentId}::candidate::${observedEvidenceIds.join("+")}`;
}

/**
 * A single-observation pre-group never reaches the LLM: there is
 * nothing to corroborate reusability against, so calling the model
 * would only produce an unvalidated guess dressed up as a confirmed
 * pattern. patternDescription here is built entirely from the
 * already-interpreted evidence (questionType + answerStyle), the
 * only safe deterministic representation available for a single
 * observation.
 */
function buildSingletonCandidate(item: PreGroupItem, interpretedAt: string): QuestionPatternCandidate {
  return {
    id: buildCandidateId(item.observed.sourceDocumentId, [item.observed.id]),
    sourceDocumentId: item.observed.sourceDocumentId,
    observedEvidenceIds: [item.observed.id],
    sharedQuestionType: item.interpreted.questionType,
    patternDescription:
      `A single observed "${item.interpreted.questionType}" question ` +
      `(${item.interpreted.answerStyle}), not yet corroborated as a reusable form by any other observation.`,
    confidence: "single-observation",
    interpretedAt,
    status: "pending",
  };
}

/**
 * Sends exactly ONE LLM call for this entire pre-group (2+
 * observations), then converts the model's partition into
 * QuestionPatternCandidate[]. Every application-owned field
 * (id, sourceDocumentId, observedEvidenceIds, sharedQuestionType,
 * confidence, interpretedAt, status) is derived here from the
 * pre-group itself, never trusted from the LLM response — the LLM's
 * only contribution is which local indexes belong together and each
 * group's patternDescription.
 */
async function discoverForMultiObservationPreGroup(
  provider: AIProvider,
  preGroup: PreGroupItem[],
  interpretedAt: string
): Promise<QuestionPatternCandidate[]> {
  const prompt = buildQuestionPatternCandidateDiscoveryPrompt(
    preGroup.map((item, arrayIndex) => ({
      index: arrayIndex + 1,
      observedText: item.observed.observedText,
      questionType: item.interpreted.questionType,
      answerStyle: item.interpreted.answerStyle,
      sectionLabel: item.observed.sectionLabel,
    }))
  );

  const response = await provider.generate(prompt);
  const rawResult = JSON.parse(response);
  const validated = QuestionPatternCandidateDiscoveryResultSchema.parse(rawResult);

  const preGroupSize = preGroup.length;
  const seenIndexes = new Set<number>();

  for (const group of validated.groups) {
    if (group.observationIndexes.length === 0) {
      throw new Error(
        "QuestionPatternCandidateDiscovery: the provider returned an empty group, which is not allowed."
      );
    }

    const uniqueWithinGroup = new Set(group.observationIndexes);
    if (uniqueWithinGroup.size !== group.observationIndexes.length) {
      throw new Error(
        "QuestionPatternCandidateDiscovery: the provider returned a group with duplicate observation indexes."
      );
    }

    for (const index of group.observationIndexes) {
      if (index < 1 || index > preGroupSize) {
        throw new Error(
          `QuestionPatternCandidateDiscovery: the provider returned observation index ${index}, ` +
          `which is outside the supplied range of 1-${preGroupSize}.`
        );
      }
      if (seenIndexes.has(index)) {
        throw new Error(
          `QuestionPatternCandidateDiscovery: the provider assigned observation index ${index} to more than one group.`
        );
      }
      seenIndexes.add(index);
    }
  }

  if (seenIndexes.size !== preGroupSize) {
    throw new Error(
      `QuestionPatternCandidateDiscovery: the provider's groups do not account for all ${preGroupSize} ` +
      `observations supplied (accounted for ${seenIndexes.size}).`
    );
  }

  const sourceDocumentId = preGroup[0].observed.sourceDocumentId;
  const sharedQuestionType: ObservedQuestionType = preGroup[0].interpreted.questionType;

  return validated.groups.map((group) => {
    const observedEvidenceIds = group.observationIndexes
      .slice()
      .sort((a, b) => a - b)
      .map((index) => preGroup[index - 1].observed.id);

    return {
      id: buildCandidateId(sourceDocumentId, observedEvidenceIds),
      sourceDocumentId,
      observedEvidenceIds,
      sharedQuestionType,
      patternDescription: group.patternDescription,
      confidence:
        observedEvidenceIds.length === 1 ? "single-observation" : "multiple-observations",
      interpretedAt,
      status: "pending",
    };
  });
}

/**
 * Turns ObservedQuestionEvidence[] + InterpretedQuestionEvidence[]
 * into QuestionPatternCandidate[] with at most one LLM call per
 * deterministic (sourceDocumentId, ObservedQuestionType) pre-group —
 * never one call per observation. See buildPreGroups for the
 * deterministic boundary and buildSingletonCandidate /
 * discoverForMultiObservationPreGroup for how each pre-group avoids
 * or bounds its LLM usage.
 */
export class LLMQuestionPatternCandidateDiscovery implements QuestionPatternCandidateDiscovery {
  constructor(private readonly provider: AIProvider) {}

  async discover(
    observedEvidence: ObservedQuestionEvidence[],
    interpretedEvidence: InterpretedQuestionEvidence[]
  ): Promise<QuestionPatternCandidate[]> {
    const preGroups = buildPreGroups(observedEvidence, interpretedEvidence);
    const interpretedAt = new Date().toISOString();

    const candidates: QuestionPatternCandidate[] = [];

    for (const preGroup of preGroups) {
      if (preGroup.length === 1) {
        candidates.push(buildSingletonCandidate(preGroup[0], interpretedAt));
        continue;
      }

      const groupCandidates = await discoverForMultiObservationPreGroup(
        this.provider,
        preGroup,
        interpretedAt
      );
      candidates.push(...groupCandidates);
    }

    return candidates;
  }
}
