import assert from "node:assert/strict";

import {
  ExamBlueprint,
  ExamBlueprintAllocation,
  validateExamBlueprint,
} from "../packages/knowledge-engine/examPlanning";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function allocation(overrides: Partial<ExamBlueprintAllocation> = {}): ExamBlueprintAllocation {
  return {
    questionType: "mcq",
    difficulty: "grade",
    count: 10,
    marksEach: 1,
    ...overrides,
  };
}

function blueprint(allocations: ExamBlueprintAllocation[]): ExamBlueprint {
  return { allocations };
}

console.log("validateExamBlueprint");

test("a valid single-allocation blueprint passes", () => {
  const result = validateExamBlueprint(blueprint([allocation()]));

  assert.deepEqual(result, { valid: true, errors: [] });
});

test("multiple valid allocations all pass", () => {
  const result = validateExamBlueprint(
    blueprint([
      allocation({ questionType: "mcq", count: 10, marksEach: 1 }),
      allocation({ questionType: "reasoning", difficulty: "advanced", count: 5, marksEach: 3 }),
      allocation({ questionType: "visual", count: 2, marksEach: 4 }),
    ])
  );

  assert.deepEqual(result, { valid: true, errors: [] });
});

test("empty allocations is rejected", () => {
  const result = validateExamBlueprint(blueprint([]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations must contain at least one entry",
  ]);
});

test("zero count is rejected", () => {
  const result = validateExamBlueprint(blueprint([allocation({ count: 0 })]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations[0].count must be a positive integer",
  ]);
});

test("negative count is rejected", () => {
  const result = validateExamBlueprint(blueprint([allocation({ count: -3 })]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations[0].count must be a positive integer",
  ]);
});

test("non-integer count is rejected", () => {
  const result = validateExamBlueprint(blueprint([allocation({ count: 2.5 })]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations[0].count must be a positive integer",
  ]);
});

test("zero marksEach is rejected", () => {
  const result = validateExamBlueprint(blueprint([allocation({ marksEach: 0 })]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations[0].marksEach must be a positive number",
  ]);
});

test("negative marksEach is rejected", () => {
  const result = validateExamBlueprint(blueprint([allocation({ marksEach: -1 })]));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    "allocations[0].marksEach must be a positive number",
  ]);
});

test("unsupported questionType is rejected", () => {
  const result = validateExamBlueprint(
    blueprint([
      allocation({ questionType: "essay" as unknown as ExamBlueprintAllocation["questionType"] }),
    ])
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'allocations[0].questionType "essay" is not a supported QuestionType',
  ]);
});

test("unsupported difficulty is rejected", () => {
  const result = validateExamBlueprint(
    blueprint([
      allocation({ difficulty: "impossible" as unknown as ExamBlueprintAllocation["difficulty"] }),
    ])
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'allocations[0].difficulty "impossible" is not a supported DifficultyLevel',
  ]);
});

test("multiple malformed allocations produce deterministic, index-ordered errors", () => {
  const badBlueprint = blueprint([
    allocation({ count: -1 }),
    allocation({ marksEach: 0 }),
  ]);

  const first = validateExamBlueprint(badBlueprint);
  const second = validateExamBlueprint(badBlueprint);

  assert.deepEqual(first.errors, [
    "allocations[0].count must be a positive integer",
    "allocations[1].marksEach must be a positive number",
  ]);
  assert.deepEqual(first, second);
});

test("does not mutate the supplied ExamBlueprint", () => {
  const b = blueprint([allocation({ count: -1 })]);
  const snapshot = JSON.parse(JSON.stringify(b));

  validateExamBlueprint(b);

  assert.deepEqual(b, snapshot);
});

console.log(`\n${passed} passed`);
