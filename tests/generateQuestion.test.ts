import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import {
  GeneratedQuestionDraft,
  QuestionBlueprint,
  QuestionPattern,
} from "../packages/shared-types";
import { QuestionGenerator } from "../packages/ai";
import { saveGeneratedQuestion, getGeneratedQuestionPath } from "../packages/knowledge-engine/questionBank";
import {
  saveQuestionPattern,
  getQuestionPatternPath,
} from "../packages/knowledge-engine/canonicalization";
import { generateQuestion } from "../packages/generateQuestion";

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

function createFakeGenerator(
  draft: GeneratedQuestionDraft
): QuestionGenerator & { calls: number } {
  return {
    calls: 0,
    async generate() {
      this.calls += 1;
      return draft;
    },
  };
}

function createThrowingGenerator(
  message: string
): QuestionGenerator & { calls: number } {
  return {
    calls: 0,
    async generate() {
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
    async generate() {
      this.calls += 1;
      return this.calls === 1 ? invalidDraft : validDraft;
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

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "grade", questionType: "reasoning" },
        generator
      );

      assert.equal(result.id, cached.id);
      assert.equal(generator.calls, 0);
    });

    await test("cache miss: the LLM is called and the result is saved to the bank (llm-inferred, no patterns exist)", async () => {
      const generator = createFakeGenerator(validDraft);

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "advanced", questionType: "reasoning" },
        generator
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 1);
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

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "olympiad", questionType: "fill-blanks" },
        generator
      );
      generatedIds.push(result.id);

      assert.equal(result.origin, "evidence-derived");
      assert.deepEqual(result.sourcePatternIds, [pattern.id]);
    });

    await test("validation failure triggers exactly one retry before succeeding", async () => {
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

      const result = await generateQuestion(
        { conceptId: REAL_CONCEPT_ID, difficulty: "foundation", questionType: "word-problem" },
        generator
      );
      generatedIds.push(result.id);

      assert.equal(generator.calls, 2);
      assert.equal(result.questionText, validDraft.questionText);
    });

    await test("LLM unavailable with no cached question: fails clearly rather than silently", async () => {
      const generator = createThrowingGenerator("provider unreachable");

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: REAL_CONCEPT_ID, difficulty: "olympiad", questionType: "mcq" },
            generator
          ),
        /provider unreachable/
      );
    });

    await test("unknown concept id fails clearly", async () => {
      const generator = createThrowingGenerator("should never be called");

      await assert.rejects(
        () =>
          generateQuestion(
            { conceptId: "__no-such-concept__" },
            generator
          ),
        /Unknown concept/
      );
      assert.equal(generator.calls, 0);
    });

    await test("an invalid request is rejected before the LLM is ever called", async () => {
      const generator = createThrowingGenerator("should never be called");

      await assert.rejects(() => generateQuestion({ conceptId: "" }, generator));
      assert.equal(generator.calls, 0);
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
  }) {
    const fixture = {
      id: `__test-cached-question__-${overrides.difficulty}`,
      conceptId: overrides.conceptId,
      questionType: overrides.questionType,
      difficulty: overrides.difficulty,
      questionText: "cached question text",
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
