import {
  DifficultyLevel,
  GeneratedQuestion,
  QuestionType,
} from "../../shared-types";
import { QuestionGenerator, QuestionReviewer } from "../../ai";
import { generateQuestion } from "../../generateQuestion";
import { QuestionPoolExhaustedError } from "../studentAttempts";
import { ExamScope } from "./resolveExamScope";
import { ExamBlueprint } from "./examBlueprint";
import { GenerationSourcePolicy } from "./generationSourcePolicy";
import { loadAllowedPatternIds } from "./loadAllowedPatternIds";

/**
 * True for the two failure shapes generateQuestion throws that
 * represent an ordinary, expected outcome of trying to produce one
 * more question for a (concept, difficulty, questionType) combo —
 * the cache had nothing left to offer, or a fresh LLM pool didn't
 * yield anything usable after its own retries. Both are legitimate
 * per-slot shortfalls.
 *
 * False for anything else — in particular
 * validateQuestionGenerationRequest's "Invalid
 * QuestionGenerationRequest" (this orchestrator's own request
 * construction is wrong) and generateQuestion's "Unknown concept"
 * (scope.eligibleConceptIds names a concept that doesn't exist in
 * the canonical graph — a stale/bad ExamScope, not a generation
 * outcome), plus anything a broken generator/reviewer
 * implementation might throw. These indicate a programmer or
 * configuration error, not a normal shortfall, and must not be
 * silently swallowed slot-by-slot — see the catch block below.
 *
 * Also true for generateQuestion's "No allowed QuestionPattern
 * found for concept" — thrown only when this orchestrator supplied
 * an explicit source-policy patternIds allowlist and nothing in it
 * was suitable. That is exactly the "explicit policy, no match"
 * shortfall this milestone requires: the slot is skipped, never
 * silently filled by an ungrounded llm-inferred question.
 */
function isExpectedGenerationShortfall(error: unknown): boolean {
  if (error instanceof QuestionPoolExhaustedError) {
    return true;
  }
  return (
    error instanceof Error &&
    (error.message.startsWith("No cached question found for concept") ||
      error.message.startsWith("No allowed QuestionPattern found for concept"))
  );
}

/**
 * One blueprint allocation's actual outcome: how many questions
 * were requested versus how many were actually produced. `requested`
 * always equals the originating allocation's `count`, even when
 * `questions` came up short — a shortfall is represented explicitly,
 * never hidden by shrinking `requested` to match what succeeded.
 */
export interface PracticePaperAllocationResult {
  questionType: QuestionType;

  difficulty: DifficultyLevel;

  requested: number;

  questions: GeneratedQuestion[];
}

/**
 * The generated practice paper: one PracticePaperAllocationResult
 * per ExamBlueprint allocation, in the same order.
 */
export interface PracticePaper {
  allocations: PracticePaperAllocationResult[];
}

/**
 * Converts an ExamScope + ExamBlueprint into a PracticePaper by
 * calling the existing, unmodified generateQuestion() once per
 * requested slot. This is pure orchestration: it makes no
 * generation, validation, or pattern-selection decision itself —
 * every one of those still happens exactly where it happens today,
 * inside generateQuestion/buildBlueprint/findSuitablePattern/the
 * injected reviewer.
 *
 * Concept selection: deterministic round-robin over
 * `scope.eligibleConceptIds`, treated as already sorted by the
 * caller (ExamScope's own resolution already sorts it). One shared
 * counter advances across the whole paper — not reset per
 * allocation — so a blueprint with allocations [mcq×2, reasoning×2]
 * over concepts [c1,c2,c3] assigns c1,c2 to the mcq slots and
 * c3,c1 to the reasoning slots, continuing the same rotation. No
 * concept outside `scope.eligibleConceptIds` is ever selected —
 * this is the sole scope-enforcement point; generateQuestion and
 * findSuitablePattern remain scope-unaware, as they must.
 *
 * Per-slot failure handling: only the two failure shapes
 * generateQuestion throws to mean "this specific attempt didn't
 * produce a question" — QuestionPoolExhaustedError, and its
 * generation/review-exhaustion Error — are caught and recorded as a
 * shortfall (that slot simply contributes no question) rather than
 * aborting the rest of the paper. Each slot gets exactly one concept
 * assignment and one generateQuestion call; there is no retry with a
 * different concept and no re-attempt of a failed slot in this
 * milestone. Anything else — an invalid request this orchestrator
 * itself constructed, scope.eligibleConceptIds naming a concept that
 * doesn't exist in the canonical graph, or an unexpected error from
 * a misbehaving generator/reviewer — is a programmer or
 * configuration error, not an ordinary generation outcome, and is
 * allowed to propagate immediately rather than being silently
 * absorbed as a shortfall slot-by-slot. See
 * isExpectedGenerationShortfall below for the exact distinction.
 *
 * Generation source policy (optional, via options.sourcePolicy): if
 * supplied, this orchestrator resolves the policy-allowed
 * QuestionPattern ids for each slot's concept (via
 * loadAllowedPatternIds, memoized per concept for the whole paper —
 * patterns/metadata don't change mid-generation, so this avoids
 * redundant I/O across slots that reuse the same concept) and
 * passes them into generateQuestion as an explicit patternIds
 * allowlist. This is the sole source-policy enforcement point;
 * findSuitablePattern and generateQuestion's core flow remain
 * exactly as generic as before — the only behavior change is that
 * generateQuestion now throws instead of silently falling back to
 * an ungrounded "llm-inferred" question when an explicit allowlist
 * was supplied and nothing in it matched, and that throw is caught
 * here as an ordinary shortfall (see isExpectedGenerationShortfall).
 * When options.sourcePolicy is omitted, no patternIds are ever
 * passed, and every Step 6 behavior (round-robin, shortfall
 * handling, exclusions, etc.) is completely unchanged.
 */
export async function generatePracticePaper(
  scope: ExamScope,
  blueprint: ExamBlueprint,
  generator: QuestionGenerator,
  reviewer: QuestionReviewer,
  options: {
    excludeQuestionIds?: string[];
    sourcePolicy?: GenerationSourcePolicy;
  } = {}
): Promise<PracticePaper> {
  if (scope.eligibleConceptIds.length === 0) {
    throw new Error(
      "generatePracticePaper requires at least one eligible concept in scope."
    );
  }

  const excludeQuestionIds = new Set(options.excludeQuestionIds ?? []);
  let conceptIndex = 0;

  const allowedPatternIdsByConcept = new Map<string, string[]>();

  async function resolvePatternIds(conceptId: string): Promise<string[] | undefined> {
    if (!options.sourcePolicy) {
      return undefined;
    }
    const cached = allowedPatternIdsByConcept.get(conceptId);
    if (cached) {
      return cached;
    }
    const resolved = await loadAllowedPatternIds(conceptId, options.sourcePolicy);
    allowedPatternIdsByConcept.set(conceptId, resolved);
    return resolved;
  }

  const allocations: PracticePaperAllocationResult[] = [];

  for (const allocation of blueprint.allocations) {
    const questions: GeneratedQuestion[] = [];

    for (let slot = 0; slot < allocation.count; slot++) {
      const conceptId =
        scope.eligibleConceptIds[conceptIndex % scope.eligibleConceptIds.length];
      conceptIndex += 1;

      const patternIds = await resolvePatternIds(conceptId);

      try {
        const question = await generateQuestion(
          {
            conceptId,
            questionType: allocation.questionType,
            difficulty: allocation.difficulty,
            ...(patternIds !== undefined ? { patternIds } : {}),
          },
          generator,
          reviewer,
          { excludeQuestionIds: Array.from(excludeQuestionIds) }
        );

        questions.push(question);
        excludeQuestionIds.add(question.id);
      } catch (error) {
        if (!isExpectedGenerationShortfall(error)) {
          throw error;
        }
        // Recorded as a shortfall by simply not adding a question —
        // see the function doc comment above.
      }
    }

    allocations.push({
      questionType: allocation.questionType,
      difficulty: allocation.difficulty,
      requested: allocation.count,
      questions,
    });
  }

  return { allocations };
}
