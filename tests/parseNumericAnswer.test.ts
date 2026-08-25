import assert from "node:assert/strict";

import { parseNumericAnswer } from "../packages/knowledge-engine/questionGeneration";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

console.log("parseNumericAnswer (narrow numeric/fraction extraction, not an expression evaluator)");

test("parses a plain integer", () => {
  assert.equal(parseNumericAnswer("12"), 12);
});

test("parses a decimal", () => {
  assert.equal(parseNumericAnswer("6.4"), 6.4);
});

test("parses a simple a/b fraction", () => {
  assert.equal(parseNumericAnswer("1/2"), 0.5);
});

test("parses a fraction embedded in surrounding text", () => {
  assert.equal(parseNumericAnswer("1/2 cup"), 0.5);
});

test("parses a plain number embedded in surrounding text", () => {
  assert.equal(parseNumericAnswer("15 slices"), 15);
});

test("returns null for a fraction with a zero denominator", () => {
  assert.equal(parseNumericAnswer("3/0"), null);
});

test("returns null when no numeric value is present", () => {
  assert.equal(parseNumericAnswer("The first amount is larger."), null);
});

console.log(`\n${passed} passed`);
