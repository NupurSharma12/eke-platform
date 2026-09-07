import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import {
  GeneratedQuestionDraft,
  QuestionBlueprint,
  QuestionPattern,
  SourceMetadata,
} from "../packages/shared-types";
import { QuestionGenerator, QuestionReviewer, QuestionReviewResult } from "../packages/ai";
import {
  saveGeneratedQuestion,
  getGeneratedQuestionPath,
} from "../packages/knowledge-engine/questionBank";
import {
  saveQuestionPattern,
  getQuestionPatternPath,
} from "../packages/knowledge-engine/canonicalization";
import {
  saveSourceMetadata,
  getSourceMetadataPath,
} from "../packages/knowledge-engine/ingestion";
import {
  generatePracticePaper,
  ExamScope,
  ExamBlueprint,
  GenerationSourcePolicy,
} from "../packages/knowledge-engine/examPlanning";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// Real concepts already present in data/graphs/canonical.json —
// generatePracticePaper's own dependency, generateQuestion, reads
// the real canonical graph by design (same convention already
// established in tests/generateQuestion.test.ts).
const CONCEPT_A = "fractions";
const CONCEPT_B = "addition";
const CONCEPT_C = "subtraction";

function scope(eligibleConceptIds: string[]): ExamScope {
  return { eligibleConceptIds };
}

/**
 * A fake generator that, on each actual LLM call (i.e. each real
 * cache miss — generateQuestion never calls this on a cache hit),
 * returns `draftsPerCall` distinct valid drafts matching whatever
 * questionType the blueprint asked for. Records which conceptId
 * each *call* (not each slot) was made for.
 *
 * `draftsPerCall` matters because of a real, existing property of
 * generateQuestion: once one question is cached for a given
 * (conceptId, difficulty, questionType) combo, a second request for
 * that exact combo either reuses another still-unattempted pooled
 * draft (if one exists) or throws QuestionPoolExhaustedError (if
 * every cached candidate is already excluded) — it never silently
 * calls the LLM again to "grow" an already-populated combo. Tests
 * that need a concept to be revisited for the identical
 * (questionType, difficulty) combo within one paper must size
 * `draftsPerCall` to cover every revisit, or expect the shortfall.
 */
function createPoolGenerator(
  draftsPerCall: number
): QuestionGenerator & { calls: number; receivedConceptIds: string[] } {
  let counter = 0;
  return {
    calls: 0,
    receivedConceptIds: [],
    async generateBatch(blueprint: QuestionBlueprint) {
      this.calls += 1;
      this.receivedConceptIds.push(blueprint.conceptId);

      const drafts: GeneratedQuestionDraft[] = [];
      for (let i = 0; i < draftsPerCall; i++) {
        counter += 1;
        const draft: GeneratedQuestionDraft = {
          questionText: `Generated question #${counter} for ${blueprint.conceptId}`,
          questionType: blueprint.questionType,
          correctAnswer: `answer-${counter}`,
          explanation: `explanation-${counter}`,
        };
        if (blueprint.questionType === "mcq") {
          draft.options = [`answer-${counter}`, "wrong-1", "wrong-2"];
        }
        drafts.push(draft);
      }
      return drafts;
    },
  };
}

/** Convenience: a generator that returns exactly one draft per call. */
function createRecordingGenerator() {
  return createPoolGenerator(1);
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

/** Rejects (always, exhausting generateQuestion's retries) every draft for one specific concept, approves everything else. */
function createConceptRejectingReviewer(
  rejectedConceptId: string
): QuestionReviewer & { calls: number } {
  return {
    calls: 0,
    async review(_draft, blueprint: QuestionBlueprint): Promise<QuestionReviewResult> {
      this.calls += 1;
      if (blueprint.conceptId === rejectedConceptId) {
        return { approved: false, reason: "deliberately rejected for this test" };
      }
      return { approved: true };
    },
  };
}

async function main() {
  console.log("generatePracticePaper");

  const generatedIds: string[] = [];

  async function cleanupGenerated() {
    for (const id of generatedIds) {
      await fs.rm(getGeneratedQuestionPath(id), { force: true });
    }
    generatedIds.length = 0;
  }

  function trackAll(paper: { allocations: { questions: { id: string }[] }[] }) {
    for (const allocation of paper.allocations) {
      for (const q of allocation.questions) {
        generatedIds.push(q.id);
      }
    }
  }

  const seededPatternPaths: string[] = [];
  const seededMetadataPaths: string[] = [];

  async function seedPattern(pattern: QuestionPattern): Promise<void> {
    seededPatternPaths.push(
      getQuestionPatternPath(
        pattern.canonicalConceptId,
        pattern.sourceDocumentId,
        pattern.contribution
      )
    );
    await saveQuestionPattern(pattern);
  }

  async function seedMetadata(metadata: SourceMetadata): Promise<void> {
    seededMetadataPaths.push(getSourceMetadataPath(metadata.sourceDocumentId));
    await saveSourceMetadata(metadata);
  }

  async function cleanupSeeded(): Promise<void> {
    for (const path of seededPatternPaths) {
      await fs.rm(path, { force: true });
    }
    for (const path of seededMetadataPaths) {
      await fs.rm(path, { force: true });
    }
    seededPatternPaths.length = 0;
    seededMetadataPaths.length = 0;
  }

  try {
    await test("one allocation, single eligible concept: exact requested count is produced (via pool reuse for the repeated combo)", async () => {
      // Both slots hit the identical (fractions, foundation, reasoning)
      // combo, so a pool of 2 is needed for the second slot to be
      // served from the same LLM call rather than colliding.
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "foundation", count: 2, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations.length, 1);
      assert.equal(paper.allocations[0].requested, 2);
      assert.equal(paper.allocations[0].questions.length, 2);
      assert.notEqual(
        paper.allocations[0].questions[0].id,
        paper.allocations[0].questions[1].id
      );
      assert.ok(
        paper.allocations[0].questions.every((q) => q.conceptId === CONCEPT_A)
      );
      // One LLM call produced the pool of 2; both slots were filled
      // from it.
      assert.equal(generator.calls, 1);
    });

    await test("multiple allocations: each produces its own exact requested count", async () => {
      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "foundation", count: 2, marksEach: 1 },
          { questionType: "word-problem", difficulty: "advanced", count: 1, marksEach: 2 },
        ],
      };

      // Round-robin over [A, B]: allocation 0's two slots go to A
      // then B (distinct combos); allocation 1's one slot continues
      // the rotation to A, but with a different (type, difficulty)
      // than allocation 0's A slot, so no combo repeats.
      const paper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations.length, 2);
      assert.equal(paper.allocations[0].requested, 2);
      assert.equal(paper.allocations[0].questions.length, 2);
      assert.equal(paper.allocations[1].requested, 1);
      assert.equal(paper.allocations[1].questions.length, 1);
    });

    await test("allocation order is preserved in the output, matching the blueprint's order", async () => {
      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "word-problem", difficulty: "foundation", count: 1, marksEach: 1 },
          { questionType: "reasoning", difficulty: "foundation", count: 1, marksEach: 1 },
          { questionType: "fill-blanks", difficulty: "foundation", count: 1, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.deepEqual(
        paper.allocations.map((a) => a.questionType),
        ["word-problem", "reasoning", "fill-blanks"]
      );
    });

    await test("round-robin concept selection cycles through eligibleConceptIds in order across the whole paper", async () => {
      // 3 concepts, 6 slots of the identical (reasoning, olympiad)
      // combo -> each concept is visited exactly twice, so a pool of
      // 2 per first visit covers every revisit without a collision.
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "olympiad", count: 6, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B, CONCEPT_C]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations[0].questions.length, 6);
      assert.deepEqual(
        paper.allocations[0].questions.map((q) => q.conceptId),
        [CONCEPT_A, CONCEPT_B, CONCEPT_C, CONCEPT_A, CONCEPT_B, CONCEPT_C]
      );
      // Only the first visit to each concept is a real LLM call.
      assert.equal(generator.calls, 3);
    });

    await test("no concept outside eligibleConceptIds is ever selected", async () => {
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "word-problem", difficulty: "olympiad", count: 4, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_B, CONCEPT_C]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      const conceptIds = paper.allocations[0].questions.map((q) => q.conceptId);
      assert.ok(conceptIds.every((id) => id === CONCEPT_B || id === CONCEPT_C));
      assert.ok(!conceptIds.includes(CONCEPT_A));
    });

    await test("question order within an allocation is preserved, including across a skipped/failed slot", async () => {
      const generator = createRecordingGenerator();
      // Rejects every draft for CONCEPT_B, so the round-robin slot
      // assigned to CONCEPT_B fails while CONCEPT_A/CONCEPT_C
      // succeed around it. Each concept is visited exactly once here
      // (count === number of concepts), so there is no cache-combo
      // collision to worry about.
      const reviewer = createConceptRejectingReviewer(CONCEPT_B);

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "fill-blanks", difficulty: "advanced", count: 3, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B, CONCEPT_C]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      // Slot order was A, B, C. B's slot failed (rejected on every
      // retry), so only A's and C's questions survive, still in
      // their original relative order.
      assert.equal(paper.allocations[0].requested, 3);
      assert.equal(paper.allocations[0].questions.length, 2);
      assert.equal(paper.allocations[0].questions[0].conceptId, CONCEPT_A);
      assert.equal(paper.allocations[0].questions[1].conceptId, CONCEPT_C);
    });

    await test("partial fulfillment is explicitly represented: requested stays the full count even when a slot fails", async () => {
      // 3 concepts, count === 3 -> each visited exactly once, so the
      // only failure source here is the reviewer's rejection, not a
      // cache-combo collision.
      const generator = createRecordingGenerator();
      const reviewer = createConceptRejectingReviewer(CONCEPT_B);

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "olympiad", difficulty: "advanced", count: 3, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B, CONCEPT_C]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations[0].requested, 3);
      assert.equal(paper.allocations[0].questions.length, 2);
    });

    await test("a per-slot generation/review failure does not abort the rest of the paper", async () => {
      const generator = createRecordingGenerator();
      const reviewer = createConceptRejectingReviewer(CONCEPT_A);

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "advanced", count: 1, marksEach: 1 },
          { questionType: "word-problem", difficulty: "advanced", count: 1, marksEach: 1 },
        ],
      };

      // Single-concept scope: both slots are assigned CONCEPT_A and
      // both are rejected by the reviewer, but the function still
      // returns a full, well-formed PracticePaper rather than
      // throwing.
      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations.length, 2);
      assert.equal(paper.allocations[0].questions.length, 0);
      assert.equal(paper.allocations[1].questions.length, 0);
      assert.equal(paper.allocations[0].requested, 1);
      assert.equal(paper.allocations[1].requested, 1);
    });

    await test("a round-robin revisit of the same concept for an identical (type, difficulty) combo, with no pool headroom, surfaces as a shortfall — never a duplicate", async () => {
      // 2 concepts, count 4, single-draft-per-call generator: each
      // concept is visited twice for the SAME combo. The first visit
      // to each concept succeeds and gets cached; the second visit to
      // that same concept finds a cached-but-excluded match (its own
      // first result) and throws QuestionPoolExhaustedError, which is
      // caught as a shortfall — this is real, existing
      // generateQuestion behavior, inherited unchanged by this
      // orchestration layer, not a bug introduced here.
      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "mcq", difficulty: "advanced", count: 4, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_B, CONCEPT_C]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations[0].requested, 4);
      // Only the first visit to each of the 2 concepts succeeds.
      assert.equal(paper.allocations[0].questions.length, 2);
      const ids = paper.allocations[0].questions.map((q) => q.id);
      assert.equal(new Set(ids).size, ids.length);
    });

    await test("initial excludeQuestionIds is propagated: a fully-excluded cached candidate causes QuestionPoolExhaustedError to be caught as a shortfall, not surfaced", async () => {
      // "fill-blanks" difficulty "olympiad" for this concept is
      // verified to have no other real cached candidates in the
      // repository's data/questions/bank — this seeded fixture is
      // deliberately the ONLY candidate for this exact combo, so
      // excluding it guarantees genuine exhaustion rather than a
      // coincidental hit on unrelated pre-existing data.
      await saveGeneratedQuestion({
        id: "__test-practice-paper-seeded__",
        conceptId: CONCEPT_A,
        questionType: "fill-blanks",
        difficulty: "olympiad",
        questionText: "seeded cached question",
        correctAnswer: "a",
        explanation: "seeded",
        sourcePatternIds: [],
        origin: "llm-inferred",
        generatedBy: "llm",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      generatedIds.push("__test-practice-paper-seeded__");

      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "fill-blanks", difficulty: "olympiad", count: 1, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer,
        { excludeQuestionIds: ["__test-practice-paper-seeded__"] }
      );
      trackAll(paper);
      await cleanupGenerated();

      // The only cached candidate was pre-excluded -> generateQuestion
      // throws QuestionPoolExhaustedError for this slot -> caught,
      // recorded as a shortfall. The LLM was never called because the
      // cache lookup (not a miss) short-circuited before that point.
      assert.equal(paper.allocations[0].requested, 1);
      assert.equal(paper.allocations[0].questions.length, 0);
      assert.equal(generator.calls, 0);
    });

    await test("QuestionPoolExhaustedError on one allocation does not abort a later allocation in the same paper", async () => {
      // "fill-blanks" difficulty "olympiad" for this concept is
      // verified to have no other real cached candidates — see the
      // preceding test's comment for why this specific combo was
      // chosen.
      await saveGeneratedQuestion({
        id: "__test-practice-paper-seeded-2__",
        conceptId: CONCEPT_A,
        questionType: "fill-blanks",
        difficulty: "olympiad",
        questionText: "seeded cached question 2",
        correctAnswer: "a",
        explanation: "seeded",
        sourcePatternIds: [],
        origin: "llm-inferred",
        generatedBy: "llm",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      generatedIds.push("__test-practice-paper-seeded-2__");

      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "fill-blanks", difficulty: "olympiad", count: 1, marksEach: 1 },
          { questionType: "word-problem", difficulty: "advanced", count: 1, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer,
        { excludeQuestionIds: ["__test-practice-paper-seeded-2__"] }
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations[0].questions.length, 0);
      assert.equal(paper.allocations[1].questions.length, 1);
    });

    await test("generated question IDs are added to subsequent exclusions: two slots of the same combo never return the same question, served from a reusable pool without a second LLM call", async () => {
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "advanced", count: 2, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer
      );
      trackAll(paper);
      await cleanupGenerated();

      const questions = paper.allocations[0].questions;
      assert.equal(questions.length, 2);
      assert.notEqual(questions[0].id, questions[1].id);
      assert.equal(generator.calls, 1);
    });

    await test("empty eligible scope is rejected before any generation is attempted", async () => {
      const generator = createRecordingGenerator();
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "mcq", difficulty: "grade", count: 1, marksEach: 1 },
        ],
      };

      await assert.rejects(
        () => generatePracticePaper(scope([]), blueprint, generator, reviewer),
        /at least one eligible concept/
      );
      assert.equal(generator.calls, 0);
    });

    await test("deterministic orchestration: repeated calls with equivalent input assign concepts in the same order", async () => {
      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "word-problem", difficulty: "grade", count: 4, marksEach: 1 },
        ],
      };

      const firstGenerator = createPoolGenerator(2);
      const firstPaper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B]),
        blueprint,
        firstGenerator,
        createApprovingReviewer()
      );
      trackAll(firstPaper);
      await cleanupGenerated();

      const secondGenerator = createPoolGenerator(2);
      const secondPaper = await generatePracticePaper(
        scope([CONCEPT_A, CONCEPT_B]),
        blueprint,
        secondGenerator,
        createApprovingReviewer()
      );
      trackAll(secondPaper);

      const firstConceptIds = firstPaper.allocations[0].questions.map((q) => q.conceptId);
      const secondConceptIds = secondPaper.allocations[0].questions.map((q) => q.conceptId);

      assert.deepEqual(firstConceptIds, secondConceptIds);
      assert.deepEqual(firstConceptIds, [
        CONCEPT_A,
        CONCEPT_B,
        CONCEPT_A,
        CONCEPT_B,
      ]);
    });

    await test("no sourcePolicy: Step 6 behavior is fully preserved (no patternIds ever passed)", async () => {
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "reasoning", difficulty: "foundation", count: 2, marksEach: 1 },
        ],
      };

      const paper = await generatePracticePaper(
        scope([CONCEPT_A]),
        blueprint,
        generator,
        reviewer
        // no options.sourcePolicy at all
      );
      trackAll(paper);
      await cleanupGenerated();

      assert.equal(paper.allocations[0].questions.length, 2);
      // Nothing evidence-derived was possible here (no patterns
      // seeded for this combo), so both are llm-inferred — exactly
      // Step 6's original, unrestricted fallback behavior.
      assert.ok(paper.allocations[0].questions.every((q) => q.origin === "llm-inferred"));
    });

    await test("sourcePolicy: an explicitly allowed pattern is passed through and used (evidence-derived)", async () => {
      const allowedPattern: QuestionPattern = {
        id: `${CONCEPT_A}::__test-source-policy-allowed__.pdf::question-pattern`,
        canonicalConceptId: CONCEPT_A,
        sourceDocumentId: "__test-source-policy-allowed__.pdf",
        contribution: "question-pattern",
        questionTemplates: [
          {
            type: "fill-blanks",
            description: "A policy-allowed pattern for fractions.",
            bloomLevel: "understand",
            recommendedDifficulty: "advanced",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      await seedPattern(allowedPattern);
      await seedMetadata({
        sourceDocumentId: "__test-source-policy-allowed__.pdf",
        title: "Allowed Worksheet",
        documentType: "worksheet",
        contributions: ["question-pattern"],
      });

      const generator = createPoolGenerator(1);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "fill-blanks", difficulty: "advanced", count: 1, marksEach: 1 },
        ],
      };

      const policy: GenerationSourcePolicy = {
        allowedContributions: ["question-pattern"],
      };

      try {
        const paper = await generatePracticePaper(
          scope([CONCEPT_A]),
          blueprint,
          generator,
          reviewer,
          { sourcePolicy: policy }
        );
        trackAll(paper);
        await cleanupGenerated();

        assert.equal(paper.allocations[0].questions.length, 1);
        assert.equal(paper.allocations[0].questions[0].origin, "evidence-derived");
        assert.deepEqual(paper.allocations[0].questions[0].sourcePatternIds, [
          allowedPattern.id,
        ]);
      } finally {
        await cleanupSeeded();
      }
    });

    await test("sourcePolicy: a matching but explicitly disallowed pattern is not selected in favor of an allowed one", async () => {
      const disallowedButMatching: QuestionPattern = {
        id: `${CONCEPT_A}::__test-source-policy-disallowed__.pdf::depth-challenge`,
        canonicalConceptId: CONCEPT_A,
        sourceDocumentId: "__test-source-policy-disallowed__.pdf",
        contribution: "depth-challenge",
        questionTemplates: [
          {
            type: "word-problem",
            description: "An Olympiad-sourced pattern that would otherwise match.",
            bloomLevel: "analyze",
            recommendedDifficulty: "olympiad",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      const allowedPattern: QuestionPattern = {
        id: `${CONCEPT_A}::__test-source-policy-allowed-2__.pdf::question-pattern`,
        canonicalConceptId: CONCEPT_A,
        sourceDocumentId: "__test-source-policy-allowed-2__.pdf",
        contribution: "question-pattern",
        questionTemplates: [
          {
            type: "word-problem",
            description: "A policy-allowed pattern that also matches.",
            bloomLevel: "understand",
            recommendedDifficulty: "olympiad",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      await seedPattern(disallowedButMatching);
      await seedPattern(allowedPattern);
      await seedMetadata({
        sourceDocumentId: "__test-source-policy-disallowed__.pdf",
        title: "Disallowed Olympiad Source",
        documentType: "olympiad",
        contributions: ["depth-challenge"],
      });
      await seedMetadata({
        sourceDocumentId: "__test-source-policy-allowed-2__.pdf",
        title: "Allowed Worksheet 2",
        documentType: "worksheet",
        contributions: ["question-pattern"],
      });

      const generator = createPoolGenerator(1);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "word-problem", difficulty: "olympiad", count: 1, marksEach: 1 },
        ],
      };

      const policy: GenerationSourcePolicy = {
        allowedContributions: ["question-pattern"],
      };

      try {
        const paper = await generatePracticePaper(
          scope([CONCEPT_A]),
          blueprint,
          generator,
          reviewer,
          { sourcePolicy: policy }
        );
        trackAll(paper);
        await cleanupGenerated();

        assert.equal(paper.allocations[0].questions.length, 1);
        assert.deepEqual(paper.allocations[0].questions[0].sourcePatternIds, [
          allowedPattern.id,
        ]);
        assert.ok(
          !paper.allocations[0].questions[0].sourcePatternIds.includes(
            disallowedButMatching.id
          )
        );
      } finally {
        await cleanupSeeded();
      }
    });

    await test("sourcePolicy: no suitable pattern within the allowed set becomes a shortfall (no llm-inferred fallback), and subsequent allocations still execute", async () => {
      // Only pattern for this concept is a "reasoning" template —
      // allowed by contribution, but does not match the "fill-blanks"
      // request in the first allocation.
      const onlyPattern: QuestionPattern = {
        id: `${CONCEPT_A}::__test-source-policy-no-match__.pdf::question-pattern`,
        canonicalConceptId: CONCEPT_A,
        sourceDocumentId: "__test-source-policy-no-match__.pdf",
        contribution: "question-pattern",
        questionTemplates: [
          {
            type: "reasoning",
            description: "Matches the second allocation, not the first.",
            bloomLevel: "understand",
            recommendedDifficulty: "grade",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      await seedPattern(onlyPattern);
      await seedMetadata({
        sourceDocumentId: "__test-source-policy-no-match__.pdf",
        title: "Allowed Worksheet 3",
        documentType: "worksheet",
        contributions: ["question-pattern"],
      });

      const generator = createPoolGenerator(1);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          // No pattern in the allowed set matches fill-blanks -> shortfall.
          { questionType: "fill-blanks", difficulty: "grade", count: 1, marksEach: 1 },
          // The only allowed pattern matches this one -> succeeds.
          { questionType: "reasoning", difficulty: "grade", count: 1, marksEach: 1 },
        ],
      };

      const policy: GenerationSourcePolicy = {
        allowedContributions: ["question-pattern"],
      };

      try {
        const paper = await generatePracticePaper(
          scope([CONCEPT_A]),
          blueprint,
          generator,
          reviewer,
          { sourcePolicy: policy }
        );
        trackAll(paper);
        await cleanupGenerated();

        assert.equal(paper.allocations[0].requested, 1);
        assert.equal(paper.allocations[0].questions.length, 0);
        // No llm-inferred question was produced for the shortfall slot.
        assert.equal(
          paper.allocations[0].questions.some((q) => q.origin === "llm-inferred"),
          false
        );

        assert.equal(paper.allocations[1].requested, 1);
        assert.equal(paper.allocations[1].questions.length, 1);
        assert.equal(paper.allocations[1].questions[0].origin, "evidence-derived");
      } finally {
        await cleanupSeeded();
      }
    });

    await test("sourcePolicy: caller-provided excludeQuestionIds and exclusion-set growth across slots still work", async () => {
      const allowedPattern: QuestionPattern = {
        id: `${CONCEPT_A}::__test-source-policy-exclusions__.pdf::question-pattern`,
        canonicalConceptId: CONCEPT_A,
        sourceDocumentId: "__test-source-policy-exclusions__.pdf",
        contribution: "question-pattern",
        questionTemplates: [
          {
            type: "olympiad",
            description: "Allowed pattern used across two slots.",
            bloomLevel: "understand",
            recommendedDifficulty: "advanced",
          },
        ],
        extractedAt: "2026-01-01T00:00:00.000Z",
      };
      await seedPattern(allowedPattern);
      await seedMetadata({
        sourceDocumentId: "__test-source-policy-exclusions__.pdf",
        title: "Allowed Worksheet 4",
        documentType: "worksheet",
        contributions: ["question-pattern"],
      });

      // Pool of 2 fresh drafts, so a second slot for the identical
      // combo is served from the same pool rather than colliding.
      const generator = createPoolGenerator(2);
      const reviewer = createApprovingReviewer();

      const blueprint: ExamBlueprint = {
        allocations: [
          { questionType: "olympiad", difficulty: "advanced", count: 2, marksEach: 1 },
        ],
      };

      const policy: GenerationSourcePolicy = {
        allowedContributions: ["question-pattern"],
      };

      try {
        const paper = await generatePracticePaper(
          scope([CONCEPT_A]),
          blueprint,
          generator,
          reviewer,
          {
            sourcePolicy: policy,
            // An initial exclusion unrelated to anything cached for
            // this combo: proves the caller-provided exclusion list
            // is still honored (doesn't error, doesn't get ignored)
            // even though nothing in the bank matches it yet.
            excludeQuestionIds: ["__test-source-policy-unrelated-exclusion__"],
          }
        );
        trackAll(paper);
        await cleanupGenerated();

        const questions = paper.allocations[0].questions;
        assert.equal(questions.length, 2);
        // ...and the two freshly generated questions are themselves
        // distinct, proving the first's id was added to the
        // exclusion set before the second slot ran.
        assert.notEqual(questions[0].id, questions[1].id);
        assert.ok(questions.every((q) => q.origin === "evidence-derived"));
      } finally {
        await cleanupSeeded();
      }
    });
  } finally {
    await cleanupGenerated();
    await cleanupSeeded();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
