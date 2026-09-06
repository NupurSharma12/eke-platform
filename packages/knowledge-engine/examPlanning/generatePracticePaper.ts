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
 */
function isExpectedGenerationShortfall(error: unknown): boolean {
  if (error instanceof QuestionPoolExhaustedError) {
    return true;
  }
  return (
    error instanceof Error &&
    error.message.startsWith("No cached question found for concept")
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
 * Deliberately NOT addressed here (see the accompanying
 * investigation): source/evidence-policy filtering of which
 * QuestionPattern may inform a given question. generateQuestion's
 * existing pattern-loading behavior — including its willingness to
 * fall back to an llm-inferred blueprint when no suitable pattern
 * exists — is used entirely unchanged. This orchestration layer
 * provides no source/style isolation; that is a known, separate
 * follow-up.
 */
export async function generatePracticePaper(
  scope: ExamScope,
  blueprint: ExamBlueprint,
  generator: QuestionGenerator,
  reviewer: QuestionReviewer,
  options: { excludeQuestionIds?: string[] } = {}
): Promise<PracticePaper> {
  if (scope.eligibleConceptIds.length === 0) {
    throw new Error(
      "generatePracticePaper requires at least one eligible concept in scope."
    );
  }

  const excludeQuestionIds = new Set(options.excludeQuestionIds ?? []);
  let conceptIndex = 0;

  const allocations: PracticePaperAllocationResult[] = [];

  for (const allocation of blueprint.allocations) {
    const questions: GeneratedQuestion[] = [];

    for (let slot = 0; slot < allocation.count; slot++) {
      const conceptId =
        scope.eligibleConceptIds[conceptIndex % scope.eligibleConceptIds.length];
      conceptIndex += 1;

      try {
        const question = await generateQuestion(
          {
            conceptId,
            questionType: allocation.questionType,
            difficulty: allocation.difficulty,
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
