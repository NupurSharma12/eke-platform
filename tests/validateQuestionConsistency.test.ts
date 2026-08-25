import assert from "node:assert/strict";

import { GeneratedQuestionDraft } from "../packages/shared-types";
import { validateQuestionConsistency } from "../packages/knowledge-engine/questionGeneration";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function main() {
  console.log("validateQuestionConsistency (deterministic, obvious-inconsistency checks)");

  await test("rejects a discrete-count question whose answer is not a whole number (16 slices / 2/5 -> 6.4 slices)", () => {
    const draft: GeneratedQuestionDraft = {
      questionText:
        "A pizza has 16 slices and Sarah eats 2/5 of the pizza. How many slices does she eat?",
      questionType: "word-problem",
      correctAnswer: "6.4",
      explanation: "16 * 2/5 = 6.4 slices.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  await test("accepts a discrete-count question whose answer is a whole number", () => {
    const draft: GeneratedQuestionDraft = {
      questionText:
        "There are 24 students in a class and half of them are boys. How many students are boys?",
      questionType: "word-problem",
      correctAnswer: "12",
      explanation: "Half of 24 is 12.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  await test("accepts a non-count question with a legitimately fractional answer", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is 1/2 + 1/4?",
      questionType: "reasoning",
      correctAnswer: "3/4",
      explanation: "1/2 is the same as 2/4, so 2/4 + 1/4 = 3/4.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  await test("rejects a visual-dependent question with no visualSpec at all (the real 'shaded region' failure case, before visualSpec existed)", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is the fraction represented by the shaded region?",
      questionType: "mcq",
      options: ["1/2", "1/4", "3/4", "2/3"],
      correctAnswer: "1/2",
      explanation: "Two of the four parts are shaded, so 2/4 simplifies to 1/2.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  await test("rejects a question typed 'visual' with no visualSpec, even when its text has no visual keywords", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "Compare the two amounts shown.",
      questionType: "visual",
      correctAnswer: "The first amount is larger.",
      explanation: "It has more parts filled in.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
  });

  await test("accepts the same 'shaded region' question once it carries a valid, consistent visualSpec (2/4 shaded -> 1/2)", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is the fraction represented by the shaded region?",
      questionType: "mcq",
      options: ["1/2", "1/4", "3/4", "2/3"],
      correctAnswer: "1/2",
      explanation: "Two of the four parts are shaded, so 2/4 simplifies to 1/2.",
      visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 2 },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  await test("rejects a fraction-bar visualSpec whose shaded parts don't match correctAnswer", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is the fraction represented by the shaded region?",
      questionType: "mcq",
      options: ["1/2", "1/4", "3/4", "2/3"],
      correctAnswer: "3/4",
      explanation: "Wrong on purpose for this test.",
      visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 2 },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  await test("rejects an angle visualSpec whose degrees don't match a numeric correctAnswer", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is the measure of this angle?",
      questionType: "mcq",
      options: ["45", "90", "120"],
      correctAnswer: "90",
      explanation: "Wrong on purpose for this test.",
      visualSpec: { type: "angle", angleType: "acute", degrees: 45 },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
  });

  await test("accepts a consistent angle visualSpec", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is the measure of this angle?",
      questionType: "mcq",
      options: ["45", "90", "120"],
      correctAnswer: "45",
      explanation: "The angle shown measures 45 degrees, which is acute.",
      visualSpec: { type: "angle", angleType: "acute", degrees: 45 },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
  });

  await test("rejects a number-line visualSpec whose correctAnswer falls outside its range", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "Which point is marked on the number line?",
      questionType: "mcq",
      options: ["3", "7", "15"],
      correctAnswer: "15",
      explanation: "Wrong on purpose for this test.",
      visualSpec: { type: "number-line", min: 0, max: 10, markers: [7] },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, false);
  });

  await test("accepts a shape visualSpec without attempting a math cross-check (no deterministic answer relationship to verify)", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "How many sides does this shape have?",
      questionType: "mcq",
      options: ["3", "4", "5"],
      correctAnswer: "3",
      explanation: "A triangle has 3 sides.",
      visualSpec: { type: "shape", shape: "triangle" },
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
  });

  await test("accepts a plain-text question that never references a diagram, graph, or figure", () => {
    const draft: GeneratedQuestionDraft = {
      questionText: "What is 3/4 of 20?",
      questionType: "reasoning",
      correctAnswer: "15",
      explanation: "3/4 of 20 is (3 * 20) / 4 = 15.",
    };

    const result = validateQuestionConsistency(draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
