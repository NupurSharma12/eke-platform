import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import { GeneratedQuestion } from "../packages/shared-types";
import {
  saveGeneratedQuestion,
  getGeneratedQuestionPath,
  findQuestions,
  filterQuestions,
} from "../packages/knowledge-engine/questionBank";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function question(overrides: Partial<GeneratedQuestion> & { id: string }): GeneratedQuestion {
  return {
    conceptId: "fractions",
    questionType: "reasoning",
    difficulty: "grade",
    questionText: "sample question",
    correctAnswer: "sample answer",
    explanation: "sample explanation",
    sourcePatternIds: [],
    origin: "llm-inferred",
    generatedBy: "llm",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

console.log("QuestionBank");

const testIds = [
  "__test-bank-q1__",
  "__test-bank-q2__",
  "__test-bank-q3__",
];

async function cleanup() {
  for (const id of testIds) {
    await fs.rm(getGeneratedQuestionPath(id), { force: true });
  }
}

async function main() {
  try {
    await test("saveGeneratedQuestion writes to a deterministic path derived from id", async () => {
      const q = question({ id: testIds[0] });
      const outputPath = await saveGeneratedQuestion(q);
      assert.equal(outputPath, getGeneratedQuestionPath(testIds[0]));

      const written = JSON.parse(await fs.readFile(outputPath, "utf-8"));
      assert.deepEqual(written, q);
    });

    await test("re-saving the same id overwrites in place, never duplicates", async () => {
      const original = question({ id: testIds[0], questionText: "v1" });
      const updated = question({ id: testIds[0], questionText: "v2" });

      await saveGeneratedQuestion(original);
      await saveGeneratedQuestion(updated);

      const written = JSON.parse(
        await fs.readFile(getGeneratedQuestionPath(testIds[0]), "utf-8")
      );
      assert.equal(written.questionText, "v2");
    });

    await test("filterQuestions matches by concept, difficulty, and type (pure, no I/O)", () => {
      const a = question({ id: "a", conceptId: "fractions", difficulty: "olympiad", questionType: "reasoning" });
      const b = question({ id: "b", conceptId: "fractions", difficulty: "grade", questionType: "mcq" });
      const c = question({ id: "c", conceptId: "angles", difficulty: "olympiad", questionType: "reasoning" });

      const all = [a, b, c];

      assert.deepEqual(filterQuestions(all, { conceptId: "fractions" }), [a, b]);
      assert.deepEqual(filterQuestions(all, { conceptId: "fractions", difficulty: "olympiad" }), [a]);
      assert.deepEqual(filterQuestions(all, { questionType: "mcq" }), [b]);
      assert.deepEqual(filterQuestions(all, {}), all);
    });

    await test("filterQuestions matches by pattern-id overlap", () => {
      const a = question({ id: "a", sourcePatternIds: ["p1", "p2"] });
      const b = question({ id: "b", sourcePatternIds: ["p3"] });

      assert.deepEqual(filterQuestions([a, b], { patternIds: ["p2"] }), [a]);
      assert.deepEqual(filterQuestions([a, b], { patternIds: ["p3", "p2"] }), [a, b]);
    });

    await test("findQuestions performs a real deterministic scan of persisted questions by concept/difficulty/type", async () => {
      await saveGeneratedQuestion(
        question({ id: testIds[1], conceptId: "__test-concept__", difficulty: "olympiad" })
      );
      await saveGeneratedQuestion(
        question({ id: testIds[2], conceptId: "__test-concept__", difficulty: "grade" })
      );

      const results = await findQuestions({ conceptId: "__test-concept__", difficulty: "olympiad" });
      assert.equal(results.length, 1);
      assert.equal(results[0].id, testIds[1]);
    });

    await test("findQuestions returns an empty array when nothing matches", async () => {
      const results = await findQuestions({ conceptId: "__no-such-concept__" });
      assert.deepEqual(results, []);
    });
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
