import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import {
  GeneratedQuestionDraft,
  QuestionBlueprint,
  QuestionPattern,
} from "../packages/shared-types";
import { QuestionGenerator, QuestionReviewer, QuestionReviewResult } from "../packages/ai";
import {
  saveGeneratedQuestion,
  getGeneratedQuestionPath,
  findQuestions,
} from "../packages/knowledge-engine/questionBank";
import {
  saveQuestionPattern,
  getQuestionPatternPath,
} from "../packages/knowledge-engine/canonicalization";
import { generateQuestion, DEFAULT_POOL_SIZE } from "../packages/generateQuestion";
import { QuestionPoolExhaustedError } from "../packages/knowledge-engine/studentAttempts";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// "fractions" is a real concept in the actual canonical.json
// produced earlier in this project — used directly rather than a
// synthetic graph, since generateQuestion reads the real
// canonical graph by design (same as the rest of the pipeline).
const REAL_CONCEPT_ID = "fractions";

// A pool-of-one is the degenerate case of a pool: these fakes wrap
// a single draft as a one-item batch, so every existing single-draft
// test below (structural/consistency retry, review retry, etc.)
// exercises the exact same generateQuestion() code paths it always
// did — generateBatch() is just generate() that returns an array.
function createFakeGenerator(
  draft: GeneratedQuestionDraft
): QuestionGenerator & { calls: number } {
  return {
    calls: 0,
    async generateBatch() {
      this.calls += 1;
      return [draft];
    },
  };
}

function createThrowingGenerator(
  message: string
): QuestionGenerator & { calls: number } {
  return {
    calls: 0,
    async generateBatch() {
      this.calls += 1;
      throw new Error(message);
    },
  };
}

function createFlakyGenerator(
  invalidDraft: GeneratedQuestionDraft,
  validDraft: GeneratedQuestionDraft
): QuestionGenerator & { calls: number } {
  return {
    calls: 0,
    async generateBatch() {
      this.calls += 1;
      return this.calls === 1 ? [invalidDraft] : [validDraft];
    },
  };
}

/**
 * A true multi-draft pool generator — records the requested
 * poolSize and always returns the full `drafts` array in one call,
 * for tests that actually exercise the pool (many drafts from a
 * single LLM call, not the pool-of-one degenerate case above).
 */
function createPoolGenerator(
  drafts: GeneratedQuestionDraft[]
): QuestionGenerator & { calls: number; requestedPoolSizes: number[] } {
  return {
    calls: 0,
    requestedPoolSizes: [],
    async generateBatch(_blueprint, poolSize) {
      this.calls += 1;
      this.requestedPoolSizes.push(poolSize);
      return drafts;
    },
  };
}

function createApprovingReviewer(): QuestionReviewer & { calls: number } {
  return {
    calls: 0,
    async review(): Promise<QuestionReviewResult> {
      this.calls += 1;
      return { approved: true };
    },
  };
}

function createRejectingReviewer(
  reason: string
): QuestionReviewer & { calls: number } {
  return {
    calls: 0,
    async review(): Promise<QuestionReviewResult> {
      this.calls += 1;
      return { approved: false, reason };
    },
  };
}

function createFlakyReviewer(
  reason: string
): QuestionReviewer & { calls: number } {
  return {
    calls: 0,
    async review(): Promise<QuestionReviewResult> {
      this.calls += 1;
      return this.calls === 1
        ? { approved: false, reason }
        : { approved: true };
    },
  };
}

const validDraft: GeneratedQuestionDraft = {
  questionText: "What is 1/2 + 1/4?",
  questionType: "reasoning",
  correctAnswer: "3/4",
  explanation: "1/2 is the same as 2/4, so 2/4 + 1/4 = 3/4.",
};

async function main() {
  console.log("generateQuestion (offline-first orchestration)");

  const generatedIds: string[] = [];
  const seededPatternPath = getQuestionPatternPath(
    REAL_CONCEPT_ID,
    "__test-olympiad-source__.pdf",
    "depth-challenge"
  );

  async function cleanupGenerated() {
    for (const id of generatedIds) {
      await fs.rm(getGeneratedQuestionPath(id), { force: true });
    }
    generatedIds.length = 0;
  }

  try {
    await test("offline-first: an existing matching question is returned without calling the LLM", async () => {
      const cached = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "grade",
        questionType: "reasoning",
      });
      generatedIds.push(cached.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "reasoning" },
        generator,
        reviewer
      );

      assert.equal(result.id, cached.id);
      assert.equal(generator.calls, 0);
      assert.equal(reviewer.calls, 0);
    });

    await test("a cached visual-dependent question with no visualSpec is never returned — treated as a miss (a pre-visualSpec stale entry, e.g. the real 'shaded region' one)", async () => {
      const staleVisualQuestion = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "advanced",
        questionType: "word-problem",
        questionText: "What is the fraction represented by the shaded region?",
      });
      generatedIds.push(staleVisualQuestion.id);

      const generator = createFakeGenerator({
        ...validDraft,
        questionType: "word-problem",
      });
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "word-problem" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 1);
      assert.notEqual(result.id, staleVisualQuestion.id);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("a cached visual-dependent question WITH a valid visualSpec is returned directly, no LLM call", async () => {
      const cachedVisualQuestion = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "foundation",
        questionType: "fill-blanks",
        questionText: "What is the fraction represented by the shaded region?",
      });
      await saveGeneratedQuestion({
        ...cachedVisualQuestion,
        options: ["1/2", "1/4"],
        correctAnswer: "1/2",
        visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 2 },
      });
      generatedIds.push(cachedVisualQuestion.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "fill-blanks" },
        generator,
        reviewer
      );

      assert.equal(generator.calls, 0);
      assert.equal(result.id, cachedVisualQuestion.id);
      assert.deepEqual(result.visualSpec, { type: "fraction-bar", totalParts: 4, shadedParts: 2 });
    });

    await test("cache miss: the LLM is called, the draft is approved by review, and the result is saved to the bank (llm-inferred, no patterns exist)", async () => {
      const generator = createFakeGenerator(validDraft);
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "reasoning" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 1);
      assert.equal(reviewer.calls, 1);
      assert.equal(result.origin, "llm-inferred");
      assert.deepEqual(result.sourcePatternIds, []);
      assert.equal(result.questionText, validDraft.questionText);

      const onDisk = JSON.parse(
        await fs.readFile(getGeneratedQuestionPath(result.id), "utf-8")
      );
      assert.equal(onDisk.id, result.id);
    });

    await test("evidence-derived: a matching QuestionPattern produces an evidence-derived question with real provenance", async () => {
      const pattern: QuestionPattern = {
        id: `${REAL_CONCEPT_ID}::__test-olympiad-source__.pdf::depth-challenge`,
        canonicalConceptId: REAL_CONCEPT_ID,
        sourceDocumentId: "__test-olympiad-source__.pdf",
        contribution: "depth-challenge",
        questionTemplates: [
          {
            type: "fill-blanks",
            description: "A real multi-step olympiad pattern.",
            bloomLevel: "analyze",
            recommendedDifficulty: "olympiad",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      await saveQuestionPattern(pattern);

      const generator = createFakeGenerator({
        ...validDraft,
        questionType: "fill-blanks",
      });
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "olympiad", questionType: "fill-blanks" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(result.origin, "evidence-derived");
      assert.deepEqual(result.sourcePatternIds, [pattern.id]);
    });

    await test("structural validation failure triggers exactly one retry before succeeding, without ever reaching review", async () => {
      const invalidDraft: GeneratedQuestionDraft = {
        questionText: "",
        questionType: "reasoning",
        correctAnswer: "",
        explanation: "",
      };
      const generator = createFlakyGenerator(invalidDraft, {
        ...validDraft,
        questionType: "word-problem",
      });
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "word-problem" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 2);
      assert.equal(reviewer.calls, 1);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("a discrete-count inconsistency (16 slices / 2/5 -> 6.4 slices) fails deterministic validation, is retried, and never reaches LLM review on the bad attempt", async () => {
      const inconsistentDraft: GeneratedQuestionDraft = {
        questionText:
          "A pizza has 16 slices and Sarah eats 2/5 of the pizza. How many slices does she eat?",
        questionType: "word-problem",
        correctAnswer: "6.4",
        explanation: "16 * 2/5 = 6.4 slices.",
      };
      const generator = createFlakyGenerator(inconsistentDraft, {
        ...validDraft,
        questionType: "word-problem",
      });
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "word-problem" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 2);
      // The first (inconsistent) draft never reached review — only the
      // second, consistent draft did.
      assert.equal(reviewer.calls, 1);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("LLM review rejection triggers a retry and succeeds once review approves", async () => {
      const generator = createFakeGenerator({
        ...validDraft,
        questionType: "reasoning",
      });
      const reviewer = createFlakyReviewer("the stated answer does not match the recomputed answer");

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "olympiad", questionType: "reasoning" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 2);
      assert.equal(reviewer.calls, 2);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("a question rejected by LLM review on every attempt is never persisted", async () => {
      const mcqDraft: GeneratedQuestionDraft = {
        questionText: "Which of the following is equal to 1/2?",
        questionType: "mcq",
        options: ["1/4", "2/4", "3/4", "1/8"],
        correctAnswer: "2/4",
        explanation: "1/2 is equivalent to 2/4.",
      };
      const generator = createFakeGenerator(mcqDraft);
      const reviewer = createRejectingReviewer("the explanation does not support the stated answer");

      await assert.rejects(() =>
        generateQuestion(
          { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "mcq" },
          generator,
          reviewer
        )
      );

      assert.equal(generator.calls, 2);
      assert.equal(reviewer.calls, 2);

      const persisted = await findQuestions({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "advanced",
        questionType: "mcq",
      });
      assert.equal(persisted.length, 0);
    });

    await test("LLM unavailable with no cached question: fails clearly rather than silently", async () => {
      const generator = createThrowingGenerator("provider unreachable");
      const reviewer = createApprovingReviewer();

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "mcq" },
            generator,
            reviewer
          ),
        /provider unreachable/
      );
      assert.equal(reviewer.calls, 0);
    });

    await test("unknown concept id fails clearly", async () => {
      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: "__no-such-concept__" },
            generator,
            reviewer
          ),
        /Unknown concept/
      );
      assert.equal(generator.calls, 0);
      assert.equal(reviewer.calls, 0);
    });

    await test("an invalid request is rejected before the LLM is ever called", async () => {
      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      await assert.rejects(() =>
        generateQuestion({ conceptId: "" }, generator, reviewer)
      );
      assert.equal(generator.calls, 0);
      assert.equal(reviewer.calls, 0);
    });

    await test("excludeQuestionIds: with no attempts, a cached match is returned exactly as before (unaffected)", async () => {
      const cached = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "grade",
        questionType: "fill-blanks",
      });
      generatedIds.push(cached.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "fill-blanks" },
        generator,
        reviewer,
        { excludeQuestionIds: [] }
      );

      assert.equal(result.id, cached.id);
      assert.equal(generator.calls, 0);
    });

    await test("excludeQuestionIds: one attempted question among two cached candidates is excluded — the other unattempted one is returned", async () => {
      const attempted = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "advanced",
        questionType: "fill-blanks",
        idSuffix: "attempted",
      });
      const unattempted = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "advanced",
        questionType: "fill-blanks",
        idSuffix: "unattempted",
      });
      generatedIds.push(attempted.id, unattempted.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "fill-blanks" },
        generator,
        reviewer,
        { excludeQuestionIds: [attempted.id] }
      );

      assert.equal(result.id, unattempted.id);
      assert.equal(generator.calls, 0);
    });

    await test("excludeQuestionIds: the only cached candidate has already been attempted — QuestionPoolExhaustedError, LLM never called (not silently re-served, not silently regenerated)", async () => {
      const cached = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "olympiad",
        questionType: "word-problem",
      });
      generatedIds.push(cached.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: REAL_CONCEPT_ID, difficulty: "olympiad", questionType: "word-problem" },
            generator,
            reviewer,
            { excludeQuestionIds: [cached.id] }
          ),
        QuestionPoolExhaustedError
      );
      assert.equal(generator.calls, 0);
    });

    await test("excludeQuestionIds: multiple cached candidates, all attempted — QuestionPoolExhaustedError, LLM never called", async () => {
      const first = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "foundation",
        questionType: "olympiad",
        idSuffix: "first",
      });
      const second = await saveGeneratedQuestionFixture({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "foundation",
        questionType: "olympiad",
        idSuffix: "second",
      });
      generatedIds.push(first.id, second.id);

      const generator = createThrowingGenerator("should never be called");
      const reviewer = createApprovingReviewer();

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "olympiad" },
            generator,
            reviewer,
            { excludeQuestionIds: [first.id, second.id] }
          ),
        QuestionPoolExhaustedError
      );
      assert.equal(generator.calls, 0);
    });

    await test("excludeQuestionIds: a genuine cache miss (no candidates ever cached) still falls through to real generation, unaffected by an unrelated exclude list", async () => {
      const generator = createFakeGenerator({
        ...validDraft,
        questionType: "olympiad",
      });
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "olympiad" },
        generator,
        reviewer,
        { excludeQuestionIds: ["some-unrelated-id-never-cached"] }
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 1);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("pool generation: a single generateBatch call producing multiple drafts persists all validated ones, not just the returned one — the pool is reusable, not regenerated per request", async () => {
      const drafts: GeneratedQuestionDraft[] = Array.from({ length: 5 }, (_, i) => ({
        questionText: `Pool question #${i + 1}: what is 1/2 + 1/${i + 2}?`,
        questionType: "reasoning" as const,
        correctAnswer: `answer-${i + 1}`,
        explanation: `explanation-${i + 1}`,
      }));
      const generator = createPoolGenerator(drafts);
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "reasoning" },
        generator,
        reviewer
      );

      // Exactly one LLM call produced the whole pool, requesting the
      // default pool size.
      assert.equal(generator.calls, 1);
      assert.equal(generator.requestedPoolSizes[0], DEFAULT_POOL_SIZE);
      // Every draft in the pool was independently reviewed.
      assert.equal(reviewer.calls, drafts.length);
      assert.equal(result.questionText, drafts[0].questionText);

      const persisted = await findQuestions({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "foundation",
        questionType: "reasoning",
      });
      generatedIds.push(...persisted.map((q) => q.id));

      // All 5 were saved, not just the one returned.
      assert.equal(persisted.length, drafts.length);
      assert.deepEqual(
        persisted.map((q) => q.questionText).sort(),
        drafts.map((d) => d.questionText).sort()
      );
    });

    await test("pool generation: a custom poolSize is passed through to the generator instead of the default", async () => {
      const drafts: GeneratedQuestionDraft[] = [
        { questionText: "Custom pool Q1", questionType: "olympiad", correctAnswer: "a1", explanation: "e1" },
        { questionText: "Custom pool Q2", questionType: "olympiad", correctAnswer: "a2", explanation: "e2" },
      ];
      const generator = createPoolGenerator(drafts);
      const reviewer = createApprovingReviewer();

      await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "olympiad" },
        generator,
        reviewer,
        { poolSize: 3 }
      );

      assert.equal(generator.requestedPoolSizes[0], 3);

      const persisted = await findQuestions({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "advanced",
        questionType: "olympiad",
      });
      generatedIds.push(...persisted.map((q) => q.id));
      assert.equal(persisted.length, drafts.length);
    });

    await test("pool generation: a draft that fails validation is discarded individually — only the valid ones are saved, and the whole batch is not retried as long as at least one survives", async () => {
      const validOne: GeneratedQuestionDraft = {
        questionText: "Which is equal to 1/2?",
        questionType: "mcq",
        options: ["1/4", "2/4", "3/4"],
        correctAnswer: "2/4",
        explanation: "1/2 = 2/4",
      };
      const invalidOne: GeneratedQuestionDraft = {
        questionText: "",
        questionType: "mcq",
        options: ["1/4", "2/4"],
        correctAnswer: "2/4",
        explanation: "e",
      };
      const generator = createPoolGenerator([invalidOne, validOne]);
      const reviewer = createApprovingReviewer();

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "mcq" },
        generator,
        reviewer
      );
      generatedIds.push(result.id);

      // Only one LLM call was made — the invalid draft was discarded,
      // not individually regenerated.
      assert.equal(generator.calls, 1);
      // Only the valid draft ever reached review.
      assert.equal(reviewer.calls, 1);
      assert.equal(result.questionText, validOne.questionText);

      const persisted = await findQuestions({
        conceptId: REAL_CONCEPT_ID,
        difficulty: "grade",
        questionType: "mcq",
      });
      assert.equal(persisted.length, 1);
    });
  } finally {
    await cleanupGenerated();
    await fs.rm(seededPatternPath, { force: true });
  }

  console.log(`\n${passed} passed`);

  async function saveGeneratedQuestionFixture(overrides: {
    conceptId: string;
    difficulty: QuestionBlueprint["difficulty"];
    questionType: QuestionBlueprint["questionType"];
    questionText?: string;
    /** Distinguishes two fixtures seeded with the same conceptId/difficulty/questionType. */
    idSuffix?: string;
  }) {
    const fixture = {
      id: `__test-cached-question__-${overrides.difficulty}-${overrides.questionType}${overrides.idSuffix ? `-${overrides.idSuffix}` : ""}`,
      conceptId: overrides.conceptId,
      questionType: overrides.questionType,
      difficulty: overrides.difficulty,
      questionText: overrides.questionText ?? "cached question text",
      correctAnswer: "cached answer",
      explanation: "cached explanation",
      sourcePatternIds: [],
      origin: "llm-inferred" as const,
      generatedBy: "llm" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await saveGeneratedQuestion(fixture);
    return fixture;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
