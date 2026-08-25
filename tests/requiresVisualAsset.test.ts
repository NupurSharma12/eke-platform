import assert from "node:assert/strict";

import { requiresVisualAsset } from "../packages/knowledge-engine/questionGeneration";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

console.log("requiresVisualAsset (deterministic visual-dependency detector)");

test("detects 'shaded region' (the real failure case)", () => {
  assert.equal(
    requiresVisualAsset("What is the fraction represented by the shaded region?"),
    true
  );
});

test("detects 'diagram'", () => {
  assert.equal(requiresVisualAsset("Use the diagram to find the missing angle."), true);
});

test("detects 'graph'", () => {
  assert.equal(requiresVisualAsset("According to the graph, which month had the most rain?"), true);
});

test("detects 'chart'", () => {
  assert.equal(requiresVisualAsset("Read the chart and find the total."), true);
});

test("detects 'angle figure'", () => {
  assert.equal(requiresVisualAsset("In the angle figure, find x."), true);
});

test("is case-insensitive", () => {
  assert.equal(requiresVisualAsset("Look at the SHADED REGION above."), true);
});

test("returns false for a plain text question with no visual dependency", () => {
  assert.equal(requiresVisualAsset("What is 3/4 of 20?"), false);
});

// Known limitation, not a bug: this is a narrow keyword match, not a
// semantic classifier, so an idiom like "figure out" is also flagged.
// Consistent with erring toward rejecting a question over risking an
// unrenderable one reaching a student.
test("also flags the idiom 'figure out' (accepted over-rejection, not a semantic classifier)", () => {
  assert.equal(requiresVisualAsset("Figure out how many apples are left."), true);
});

console.log(`\n${passed} passed`);
