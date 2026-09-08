import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { randomUUID } from "crypto";

import {
  GeneratedQuestion,
  QuestionGenerationRequest,
  DifficultyLevel,
  QuestionType,
} from "./shared-types";
// Imported from specific submodules rather than the top-level
// knowledge-engine barrel: that barrel also re-exports ./ingestion,
// which pulls in pdf-parse/pdfjs-dist — fine for the tsx-run CLI
// scripts, but it breaks Next.js's webpack bundling for the API
// route that calls generateQuestion(). This is a pure import-path
// change; none of the referenced logic moved or changed.
import { loadKnowledgeGraph, CANONICAL_GRAPH_FILENAME } from "./knowledge-engine/graph";
import { loadQuestionPatterns } from "./knowledge-engine/canonicalization";
import { findQuestions, saveGeneratedQuestion } from "./knowledge-engine/questionBank";
import {
  buildBlueprint,
  validateQuestionGenerationRequest,
  validateGeneratedQuestion,
  validateQuestionConsistency,
  requiresVisualAsset,
} from "./knowledge-engine/questionGeneration";
import { QuestionPoolExhaustedError } from "./knowledge-engine/studentAttempts";
import {
  buildProviderChain,
  QuestionGenerator,
  ClaudeQuestionGenerator,
  QuestionReviewer,
  ClaudeQuestionReviewer,
} from "./ai";

const MAX_GENERATION_ATTEMPTS = 2;

/**
 * Default question-pool size: how many candidate questions one LLM
 * call is asked to produce for a given (conceptId, difficulty,
 * questionType) combo the first time it's requested. Configurable
 * per call via options.poolSize; this is only the fallback.
 */
export const DEFAULT_POOL_SIZE = 15;

/**
 * The end-to-end question generation flow:
 *
 *   1. Offline-first: search the Question Bank. A suitable
 *      existing question is returned immediately — the LLM is
 *      never called on a cache hit. The bank is a shared pool per
 *      (conceptId, difficulty, questionType): once populated, every
 *      student draws from the same underlying questions, filtered
 *      individually by their own excludeQuestionIds.
 *   2. On a miss (nothing cached for this combo at all — not to be
 *      confused with "everything cached is excluded", see
 *      QuestionPoolExhaustedError below): load the canonical concept
 *      and its QuestionPatterns, build one blueprint (evidence-derived
 *      if a suitable pattern exists, llm-inferred otherwise), and
 *      make a single LLM call through the injected QuestionGenerator
 *      asking for a pool of `poolSize` draft questions at once.
 *   3. Every draft in that pool must pass three independent gates
 *      before it is ever persisted: (a) structural validation
 *      (validateGeneratedQuestion), (b) deterministic consistency
 *      validation (validateQuestionConsistency — narrow, obvious
 *      mathematical-inconsistency checks), then (c) an independent
 *      LLM review pass (the injected QuestionReviewer) that
 *      re-derives the answer and judges correctness/quality — one
 *      review call per draft, same reviewer contract as before. A
 *      draft that fails any gate is discarded, not retried
 *      individually; the pool's actual saved size can be smaller
 *      than `poolSize` ("approximately" poolSize, not exactly).
 *   4. If every draft in the pool fails validation, the whole batch
 *      (one new LLM call) is retried once (same MAX_GENERATION_ATTEMPTS
 *      cap as before); if it still fails, throw a clear error rather
 *      than returning something unusable.
 *   5. Every draft that passes all three gates is saved to the bank;
 *      the first is returned to this caller, the rest become
 *      immediately available to any subsequent request (this
 *      student's Next click, or any other student's) against the
 *      same combo — without another LLM call, until the whole pool
 *      is exhausted.
 *
 * This function lives at the top level (not inside
 * knowledge-engine/) because it needs the AI-side QuestionGenerator
 * and QuestionReviewer interfaces — the same layering already used
 * by runBatchPipeline.ts's processPdf/runBatch, which similarly
 * needs ConceptExtractor. knowledge-engine/ itself has no
 * dependency on ai/ anywhere in this codebase, and this preserves
 * that.
 *
 * `excludeQuestionIds` (e.g. a student's attempt history) is a
 * caller-level concern, not a generation-domain one — deliberately
 * a function parameter rather than a QuestionGenerationRequest
 * field, per that type's own "no student-specific fields" contract.
 * It only narrows step 1's cache lookup; steps 2-5 are untouched.
 *
 * `request.patternIds`, when explicitly supplied (an allowlist —
 * possibly empty), also changes step 2's fallback: if nothing in
 * that allowlist is a suitable pattern, this throws rather than
 * silently generating an ungrounded "llm-inferred" question, so an
 * explicit source policy (see examPlanning/generatePracticePaper)
 * can never be bypassed by the existing fallback. Omitting
 * patternIds entirely preserves the original, unrestricted
 * llm-inferred fallback exactly as before.
 */
export async function generateQuestion(
  request: QuestionGenerationRequest,
  generator: QuestionGenerator,
  reviewer: QuestionReviewer,
  options: { excludeQuestionIds?: string[]; poolSize?: number } = {}
): Promise<GeneratedQuestion> {
  const requestValidation = validateQuestionGenerationRequest(request);
  if (!requestValidation.valid) {
    throw new Error(
      `Invalid QuestionGenerationRequest: ${requestValidation.errors.join(", ")}`
    );
  }

  const cached = await findQuestions({
    conceptId: request.conceptId,
    difficulty: request.difficulty,
    questionType: request.questionType,
    patternIds: request.patternIds,
  });

  // A cached question can predate this pipeline's ability to attach
  // a visualSpec at all — the bank is never assumed clean, so every
  // path that can present a question to a student re-checks it, not
  // just fresh generations. A visual-dependent question is only
  // presentable if it actually carries a visualSpec; one that
  // doesn't (e.g. an old entry from before visualSpec existed) is
  // treated as a miss, not served incomplete.
  const presentableCached = cached.filter((q) => {
    const isVisualDependent =
      q.questionType === "visual" || requiresVisualAsset(q.questionText);
    return !isVisualDependent || Boolean(q.visualSpec);
  });

  const excludeQuestionIds = options.excludeQuestionIds ?? [];
  const unattemptedPresentableCached = presentableCached.filter(
    (q) => !excludeQuestionIds.includes(q.id)
  );

  if (unattemptedPresentableCached.length > 0) {
    return unattemptedPresentableCached[0];
  }

  // presentableCached had entries but every one of them is excluded
  // — a real "nothing left to show this student" gap, not a plain
  // cache miss. Reported distinctly rather than falling through to
  // a fresh LLM generation (which would silently grow the pool) or
  // re-serving an already-excluded question.
  if (presentableCached.length > 0) {
    throw new QuestionPoolExhaustedError();
  }

  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);
  const concept = graph.concepts.find((c) => c.id === request.conceptId);

  if (!concept) {
    throw new Error(`Unknown concept: "${request.conceptId}"`);
  }

  const patterns = await loadQuestionPatterns(request.conceptId);

  const blueprint = buildBlueprint(
    concept,
    request,
    patterns,
    new Date().toISOString()
  );

  // request.patternIds !== undefined means the caller supplied an
  // explicit pattern allowlist (a source policy), as opposed to no
  // restriction at all (undefined). When such an allowlist is
  // supplied and none of it matched (blueprint fell back to
  // "llm-inferred"), an explicit source policy must not be silently
  // bypassed by an ungrounded LLM-inferred question — so this throws
  // instead of proceeding to generate one. Every existing caller
  // never sets request.patternIds, so this branch never fires for
  // them; this is strictly additive. The existing "no patternIds
  // supplied at all" fallback to llm-inferred generation is
  // completely unchanged.
  if (request.patternIds !== undefined && blueprint.origin === "llm-inferred") {
    throw new Error(
      `No allowed QuestionPattern found for concept "${request.conceptId}" matching the requested type/difficulty within the supplied patternIds allowlist.`
    );
  }

  const poolSize = options.poolSize ?? DEFAULT_POOL_SIZE;

  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const drafts = await generator.generateBatch(blueprint, poolSize);

    const validated: GeneratedQuestion[] = [];
    const attemptErrors: string[] = [];

    for (const draft of drafts) {
      const structuralValidation = validateGeneratedQuestion(draft, request);
      if (!structuralValidation.valid) {
        attemptErrors.push(...structuralValidation.errors);
        continue;
      }

      const consistencyValidation = validateQuestionConsistency(draft);
      if (!consistencyValidation.valid) {
        attemptErrors.push(...consistencyValidation.errors);
        continue;
      }

      const review = await reviewer.review(draft, blueprint);
      if (!review.approved) {
        attemptErrors.push(review.reason ?? "rejected by LLM review");
        continue;
      }

      validated.push({
        id: randomUUID(),
        conceptId: concept.id,
        questionType: draft.questionType,
        difficulty: blueprint.difficulty,
        questionText: draft.questionText,
        options: draft.options,
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation,
        visualSpec: draft.visualSpec,
        sourcePatternIds: blueprint.sourcePatternIds,
        origin: blueprint.origin,
        generatedBy: "llm",
        createdAt: new Date().toISOString(),
      });
    }

    if (validated.length > 0) {
      for (const question of validated) {
        await saveGeneratedQuestion(question);
      }
      return validated[0];
    }

    lastErrors = attemptErrors;
  }

  throw new Error(
    `No cached question found for concept "${request.conceptId}", and pool generation produced no valid question after ${MAX_GENERATION_ATTEMPTS} attempt(s): ${lastErrors.join(", ")}`
  );
}

function parseArg(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

export function parseGenerationArgs(argv: string[]): QuestionGenerationRequest {
  const conceptId = parseArg(argv, "--concept");

  if (!conceptId) {
    throw new Error(
      "Usage: generateQuestion.ts --concept <conceptId> [--difficulty <level>] [--type <questionType>] [--pool-size <n>]"
    );
  }

  return {
    conceptId,
    difficulty: parseArg(argv, "--difficulty") as DifficultyLevel | undefined,
    questionType: parseArg(argv, "--type") as QuestionType | undefined,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const request = parseGenerationArgs(argv);
  const poolSizeArg = parseArg(argv, "--pool-size");

  const provider = buildProviderChain();

  const generator = new ClaudeQuestionGenerator(provider);
  const reviewer = new ClaudeQuestionReviewer(provider);

  const question = await generateQuestion(request, generator, reviewer, {
    poolSize: poolSizeArg ? Number(poolSizeArg) : undefined,
  });

  console.log(JSON.stringify(question, null, 2));
  console.log(
    `\norigin=${question.origin} sourcePatterns=${question.sourcePatternIds.length}`
  );
}

const isMain = process.argv[1]?.endsWith("generateQuestion.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
