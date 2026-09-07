import assert from "node:assert/strict";

import { AssessmentStructureEvidence } from "../packages/shared-types";
import {
  discoverExamBlueprint,
  BlueprintDiscoveryPolicy,
  validateExamBlueprint,
} from "../packages/knowledge-engine/examPlanning";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function evidence(
  overrides: Partial<AssessmentStructureEvidence> & {
    sourceDocumentId: string;
    allocations: AssessmentStructureEvidence["allocations"];
  }
): AssessmentStructureEvidence {
  return {
    extractedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function policy(
  overrides: Partial<BlueprintDiscoveryPolicy> = {}
): BlueprintDiscoveryPolicy {
  return {
    targetQuestionCount: 10,
    defaultDifficulty: "grade",
    defaultMarksEach: 1,
    ...overrides,
  };
}

console.log("discoverExamBlueprint");

test("single evidence source: proportions rescale to the requested target", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 8 },
      { questionType: "word-problem", count: 2 },
    ],
  });

  const blueprint = discoverExamBlueprint([source], policy({ targetQuestionCount: 10 }));

  assert.deepEqual(blueprint.allocations, [
    { questionType: "mcq", difficulty: "grade", count: 8, marksEach: 1 },
    { questionType: "word-problem", difficulty: "grade", count: 2, marksEach: 1 },
  ]);
});

test("multiple evidence sources are aggregated by questionType before computing proportions", () => {
  const sourceA = evidence({
    sourceDocumentId: "doc-a",
    allocations: [{ questionType: "mcq", count: 6 }],
  });
  const sourceB = evidence({
    sourceDocumentId: "doc-b",
    allocations: [
      { questionType: "mcq", count: 2 },
      { questionType: "reasoning", count: 2 },
    ],
  });

  // Pooled: mcq=8, reasoning=2 -> 80%/20% of a 10-question target.
  const blueprint = discoverExamBlueprint(
    [sourceA, sourceB],
    policy({ targetQuestionCount: 10 })
  );

  assert.deepEqual(blueprint.allocations, [
    { questionType: "mcq", difficulty: "grade", count: 8, marksEach: 1 },
    { questionType: "reasoning", difficulty: "grade", count: 2, marksEach: 1 },
  ]);
});

test("largest-remainder rounding: fractional shares round deterministically and sum to the exact target", () => {
  // 3 types, evenly observed (1 each) -> exact shares of 20/3 = 6.66..
  // each when rescaled to 20. Floors: 6,6,6 = 18, 2 remaining slots
  // go to the largest remainders. All three shares are tied at the
  // same remainder (0.666..), so the tie-break is alphabetical
  // questionType order (fill-blanks, mcq, olympiad): fill-blanks and
  // mcq each get the extra slot.
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "fill-blanks", count: 1 },
      { questionType: "mcq", count: 1 },
      { questionType: "olympiad", count: 1 },
    ],
  });

  const blueprint = discoverExamBlueprint([source], policy({ targetQuestionCount: 20 }));

  const total = blueprint.allocations.reduce((sum, a) => sum + a.count, 0);
  assert.equal(total, 20);

  assert.deepEqual(blueprint.allocations, [
    { questionType: "fill-blanks", difficulty: "grade", count: 7, marksEach: 1 },
    { questionType: "mcq", difficulty: "grade", count: 7, marksEach: 1 },
    { questionType: "olympiad", difficulty: "grade", count: 6, marksEach: 1 },
  ]);
});

test("resulting allocation counts always sum to exactly targetQuestionCount", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 7 },
      { questionType: "visual", count: 3 },
      { questionType: "reasoning", count: 5 },
    ],
  });

  for (const targetQuestionCount of [1, 5, 9, 13, 25]) {
    const blueprint = discoverExamBlueprint(
      [source],
      policy({ targetQuestionCount })
    );
    const total = blueprint.allocations.reduce((sum, a) => sum + a.count, 0);
    assert.equal(total, targetQuestionCount, `target ${targetQuestionCount}`);
  }
});

test("a question type with too small a share at the requested size is omitted, not included with count 0", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 99 },
      { questionType: "visual", count: 1 },
    ],
  });

  // visual's exact share at target=5 is 0.05 -> floors to 0 and,
  // with only 99:1 odds against it, never wins the single
  // remaining remainder slot.
  const blueprint = discoverExamBlueprint([source], policy({ targetQuestionCount: 5 }));

  assert.deepEqual(blueprint.allocations, [
    { questionType: "mcq", difficulty: "grade", count: 5, marksEach: 1 },
  ]);
});

test("policy.defaultDifficulty is applied uniformly to every allocation", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 5 },
      { questionType: "reasoning", count: 5 },
    ],
  });

  const blueprint = discoverExamBlueprint(
    [source],
    policy({ targetQuestionCount: 10, defaultDifficulty: "advanced" })
  );

  assert.ok(blueprint.allocations.every((a) => a.difficulty === "advanced"));
});

test("policy.defaultMarksEach is applied uniformly to every allocation", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 5 },
      { questionType: "reasoning", count: 5 },
    ],
  });

  const blueprint = discoverExamBlueprint(
    [source],
    policy({ targetQuestionCount: 10, defaultMarksEach: 4 })
  );

  assert.ok(blueprint.allocations.every((a) => a.marksEach === 4));
});

test("empty evidence array is rejected", () => {
  assert.throws(() => discoverExamBlueprint([], policy()), /at least one AssessmentStructureEvidence/);
});

test("evidence whose total observed count is zero is rejected", () => {
  const source = evidence({ sourceDocumentId: "doc-1", allocations: [] });

  assert.throws(
    () => discoverExamBlueprint([source], policy()),
    /at least one observed question/
  );
});

test("targetQuestionCount <= 0 is rejected", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [{ questionType: "mcq", count: 1 }],
  });

  assert.throws(
    () => discoverExamBlueprint([source], policy({ targetQuestionCount: 0 })),
    /targetQuestionCount must be a positive integer/
  );
  assert.throws(
    () => discoverExamBlueprint([source], policy({ targetQuestionCount: -5 })),
    /targetQuestionCount must be a positive integer/
  );
  assert.throws(
    () => discoverExamBlueprint([source], policy({ targetQuestionCount: 2.5 })),
    /targetQuestionCount must be a positive integer/
  );
});

test("invalid policy.defaultMarksEach is rejected", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [{ questionType: "mcq", count: 1 }],
  });

  assert.throws(
    () => discoverExamBlueprint([source], policy({ defaultMarksEach: 0 })),
    /defaultMarksEach must be a positive number/
  );
  assert.throws(
    () => discoverExamBlueprint([source], policy({ defaultMarksEach: -1 })),
    /defaultMarksEach must be a positive number/
  );
});

test("invalid policy.defaultDifficulty is rejected", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [{ questionType: "mcq", count: 1 }],
  });

  assert.throws(
    () =>
      discoverExamBlueprint(
        [source],
        policy({
          defaultDifficulty: "impossible" as BlueprintDiscoveryPolicy["defaultDifficulty"],
        })
      ),
    /defaultDifficulty "impossible" is not a supported DifficultyLevel/
  );
});

test("a valid discovered blueprint is accepted by the existing validateExamBlueprint", () => {
  const source = evidence({
    sourceDocumentId: "doc-1",
    allocations: [
      { questionType: "mcq", count: 8 },
      { questionType: "word-problem", count: 2 },
    ],
  });

  const blueprint = discoverExamBlueprint([source], policy({ targetQuestionCount: 10 }));
  const result = validateExamBlueprint(blueprint);

  assert.deepEqual(result, { valid: true, errors: [] });
});

test("deterministic: repeated calls with equivalent input produce identical output", () => {
  const sourceA = evidence({
    sourceDocumentId: "doc-a",
    allocations: [
      { questionType: "mcq", count: 5 },
      { questionType: "visual", count: 3 },
    ],
  });
  const sourceB = evidence({
    sourceDocumentId: "doc-b",
    allocations: [{ questionType: "reasoning", count: 2 }],
  });

  const first = discoverExamBlueprint([sourceA, sourceB], policy({ targetQuestionCount: 15 }));
  const second = discoverExamBlueprint([sourceB, sourceA], policy({ targetQuestionCount: 15 }));

  assert.deepEqual(first, second);
});

console.log(`\n${passed} passed`);
