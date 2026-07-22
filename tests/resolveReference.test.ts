import assert from "node:assert/strict";

import { Concept } from "../packages/shared-types";
import { resolveReference } from "../packages/knowledge-engine/canonicalization/resolveReference";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function concept(overrides: Partial<Concept> & { id: string; name: string }): Concept {
  return {
    aliases: [],
    domains: [],
    learningObjectives: [],
    bloomLevel: "understand",
    difficulty: "grade",
    explanation: "",
    realLifeExamples: [],
    stories: [],
    analogies: [],
    prerequisites: [],
    leadsTo: [],
    relatedConcepts: [],
    misconceptions: [],
    teaching: {
      primary: "activity",
      activities: [],
      parentTips: [],
      visualIdeas: [],
    },
    questionTemplates: [],
    estimatedMinutes: 10,
    sourceDocuments: [],
    version: 1,
    keywords: [],
    metadata: {
      version: 1,
      sourceDocuments: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

console.log("resolveReference");

test("matches on exact canonical id", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("fractions", known);
  assert.deepEqual(result, { status: "matched", conceptId: "fractions", tier: "exact" });
});

test("matches on exact normalized name", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("  fractions  ", known);
  assert.deepEqual(result, { status: "matched", conceptId: "fractions", tier: "exact" });
});

test("matches via a confirmed alias", () => {
  const known = [
    concept({ id: "fractions", name: "Fractions", aliases: ["Fraction Basics"] }),
  ];
  const result = resolveReference("Fraction Basics", known);
  assert.deepEqual(result, { status: "matched", conceptId: "fractions", tier: "alias" });
});

test("resolves 'Understanding of Fractions' to canonical 'Fractions' via wrapper-phrase stripping", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("Understanding of Fractions", known);
  assert.deepEqual(result, {
    status: "matched",
    conceptId: "fractions",
    tier: "wrapper-pattern",
  });
});

test("resolves 'Fraction Concepts' to canonical 'Fractions' via wrapper-phrase stripping", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("Fraction Concepts", known);
  assert.deepEqual(result, {
    status: "matched",
    conceptId: "fractions",
    tier: "wrapper-pattern",
  });
});

test("does NOT merge 'Equivalent Fractions' into 'Fractions' — must remain a distinct concept", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("Equivalent Fractions", known);
  assert.equal(result.status, "new");
});

test("does NOT merge 'Comparing Fractions' into 'Fractions' — must remain a distinct concept", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("Comparing Fractions", known);
  assert.equal(result.status, "new");
});

test("folds simple trailing plurals ('Tessellations' matches canonical 'Tessellation')", () => {
  const known = [concept({ id: "tessellation", name: "Tessellation" })];
  const result = resolveReference("Tessellations", known);
  assert.deepEqual(result, { status: "matched", conceptId: "tessellation", tier: "exact" });
});

test("returns 'new' when nothing matches at any tier", () => {
  const known = [concept({ id: "fractions", name: "Fractions" })];
  const result = resolveReference("Photosynthesis", known);
  assert.deepEqual(result, { status: "new" });
});

test("returns 'ambiguous' rather than guessing when a wrapper-stripped name matches multiple concepts", () => {
  // Two distinct canonical ids sharing the exact same normalized
  // name is a pathological but possible data state (e.g. manually
  // edited records) — the wrapper tier must report ambiguity
  // rather than silently picking one.
  const duplicateNamed = [
    concept({ id: "fractions", name: "Fractions" }),
    concept({ id: "fractions-2", name: "Fractions" }),
  ];
  const result = resolveReference("Understanding of Fractions", duplicateNamed);
  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") {
    assert.equal(result.candidates.length, 2);
  }
});

console.log(`\n${passed} passed`);
