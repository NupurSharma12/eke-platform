import assert from "node:assert/strict";

import {
  VisualSpecSchema,
  classifyAngleDegrees,
} from "../packages/ai/schemas/visual-spec.schema";
import { GeneratedQuestionDraftSchema } from "../packages/ai/schemas/question-generation.schema";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

console.log("VisualSpecSchema (structural well-formedness of visual specs)");

test("accepts a well-formed fraction-bar spec", () => {
  const result = VisualSpecSchema.safeParse({
    type: "fraction-bar",
    totalParts: 4,
    shadedParts: 2,
  });
  assert.equal(result.success, true);
});

test("rejects a fraction-bar spec where shadedParts exceeds totalParts", () => {
  const result = VisualSpecSchema.safeParse({
    type: "fraction-bar",
    totalParts: 4,
    shadedParts: 5,
  });
  assert.equal(result.success, false);
});

test("classifyAngleDegrees matches the boundary cases", () => {
  assert.equal(classifyAngleDegrees(45), "acute");
  assert.equal(classifyAngleDegrees(90), "right");
  assert.equal(classifyAngleDegrees(120), "obtuse");
  assert.equal(classifyAngleDegrees(180), "straight");
  assert.equal(classifyAngleDegrees(270), "reflex");
  assert.equal(classifyAngleDegrees(0), null);
  assert.equal(classifyAngleDegrees(400), null);
});

test("accepts an angle spec whose angleType matches degrees", () => {
  const result = VisualSpecSchema.safeParse({
    type: "angle",
    angleType: "acute",
    degrees: 45,
  });
  assert.equal(result.success, true);
});

test("rejects an angle spec whose angleType disagrees with degrees", () => {
  const result = VisualSpecSchema.safeParse({
    type: "angle",
    angleType: "acute",
    degrees: 120,
  });
  assert.equal(result.success, false);
});

test("accepts a well-formed shape spec", () => {
  const result = VisualSpecSchema.safeParse({
    type: "shape",
    shape: "triangle",
  });
  assert.equal(result.success, true);
});

test("rejects a shape spec with an unsupported shape name", () => {
  const result = VisualSpecSchema.safeParse({
    type: "shape",
    shape: "octagon",
  });
  assert.equal(result.success, false);
});

test("accepts a well-formed bar-chart spec", () => {
  const result = VisualSpecSchema.safeParse({
    type: "bar-chart",
    bars: [
      { label: "Mon", value: 3 },
      { label: "Tue", value: 5 },
    ],
  });
  assert.equal(result.success, true);
});

test("rejects a bar-chart spec with fewer than 2 bars", () => {
  const result = VisualSpecSchema.safeParse({
    type: "bar-chart",
    bars: [{ label: "Mon", value: 3 }],
  });
  assert.equal(result.success, false);
});

test("accepts a well-formed number-line spec", () => {
  const result = VisualSpecSchema.safeParse({
    type: "number-line",
    min: 0,
    max: 10,
    markers: [3, 7],
  });
  assert.equal(result.success, true);
});

test("rejects a number-line spec where min is not less than max", () => {
  const result = VisualSpecSchema.safeParse({
    type: "number-line",
    min: 10,
    max: 10,
  });
  assert.equal(result.success, false);
});

test("rejects a number-line spec with a marker outside [min, max]", () => {
  const result = VisualSpecSchema.safeParse({
    type: "number-line",
    min: 0,
    max: 10,
    markers: [15],
  });
  assert.equal(result.success, false);
});

test("rejects an unknown visual kind", () => {
  const result = VisualSpecSchema.safeParse({
    type: "pie-chart",
    slices: [],
  });
  assert.equal(result.success, false);
});

test("GeneratedQuestionDraftSchema accepts a draft with no visualSpec (plain-text questions unchanged)", () => {
  const result = GeneratedQuestionDraftSchema.safeParse({
    questionText: "What is 1/2 + 1/4?",
    questionType: "reasoning",
    correctAnswer: "3/4",
    explanation: "1/2 is the same as 2/4, so 2/4 + 1/4 = 3/4.",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.visualSpec, undefined);
  }
});

test("GeneratedQuestionDraftSchema accepts a draft with a well-formed visualSpec", () => {
  const result = GeneratedQuestionDraftSchema.safeParse({
    questionText: "What is the fraction represented by the shaded region?",
    questionType: "mcq",
    options: ["1/2", "1/4"],
    correctAnswer: "1/2",
    explanation: "2 of 4 parts are shaded.",
    visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 2 },
  });
  assert.equal(result.success, true);
});

test("GeneratedQuestionDraftSchema rejects a draft whose visualSpec is malformed", () => {
  const result = GeneratedQuestionDraftSchema.safeParse({
    questionText: "What is the fraction represented by the shaded region?",
    questionType: "mcq",
    options: ["1/2", "1/4"],
    correctAnswer: "1/2",
    explanation: "2 of 4 parts are shaded.",
    visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 9 },
  });
  assert.equal(result.success, false);
});

console.log(`\n${passed} passed`);
