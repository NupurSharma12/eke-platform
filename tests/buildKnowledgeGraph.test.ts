import assert from "node:assert/strict";

import { Concept } from "../packages/shared-types";
import { buildKnowledgeGraph } from "../packages/knowledge-engine/graph/buildKnowledgeGraph";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function concept(overrides: Partial<Concept> & { id: string }): Concept {
  return {
    name: overrides.id,
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

console.log("buildKnowledgeGraph");

test("converts prerequisites into foundational -> dependent prerequisite edges", () => {
  const equivalentFractions = concept({ id: "equivalent-fractions" });
  const comparingFractions = concept({
    id: "comparing-fractions",
    prerequisites: [{ id: "equivalent-fractions", name: "Equivalent Fractions" }],
  });

  const graph = buildKnowledgeGraph([equivalentFractions, comparingFractions]);

  assert.deepEqual(graph.relationships, [
    { from: "equivalent-fractions", to: "comparing-fractions", type: "prerequisite" },
  ]);
});

test("converts leadsTo into the same prerequisite edge shape", () => {
  const equivalentFractions = concept({
    id: "equivalent-fractions",
    leadsTo: [{ id: "comparing-fractions", name: "Comparing Fractions" }],
  });

  const graph = buildKnowledgeGraph([equivalentFractions]);

  assert.deepEqual(graph.relationships, [
    { from: "equivalent-fractions", to: "comparing-fractions", type: "prerequisite" },
  ]);
});

test("converts relatedConcepts into related edges", () => {
  const turns = concept({
    id: "turns",
    relatedConcepts: [{ id: "angles", name: "Angles" }],
  });

  const graph = buildKnowledgeGraph([turns]);

  assert.deepEqual(graph.relationships, [
    { from: "turns", to: "angles", type: "related" },
  ]);
});

test("allows dangling references without fabricating a Concept node", () => {
  const comparingFractions = concept({
    id: "comparing-fractions",
    prerequisites: [{ id: "equivalent-fractions", name: "Equivalent Fractions" }],
  });

  const graph = buildKnowledgeGraph([comparingFractions]);

  assert.equal(graph.concepts.length, 1);
  assert.equal(graph.concepts[0].id, "comparing-fractions");
  assert.deepEqual(graph.relationships, [
    { from: "equivalent-fractions", to: "comparing-fractions", type: "prerequisite" },
  ]);
});

test("prevents duplicate edges by exact type::from::to identity", () => {
  const a = concept({
    id: "a",
    leadsTo: [{ id: "b", name: "B" }],
  });
  const b = concept({
    id: "b",
    prerequisites: [{ id: "a", name: "A" }],
  });

  const graph = buildKnowledgeGraph([a, b]);

  assert.equal(graph.relationships.length, 1);
  assert.deepEqual(graph.relationships[0], {
    from: "a",
    to: "b",
    type: "prerequisite",
  });
});

test("skips self-loops", () => {
  const a = concept({
    id: "a",
    prerequisites: [{ id: "a", name: "A" }],
    relatedConcepts: [{ id: "a", name: "A" }],
  });

  const graph = buildKnowledgeGraph([a]);

  assert.deepEqual(graph.relationships, []);
});

test("is idempotent: rebuilding from the same concepts changes nothing", () => {
  const a = concept({ id: "a" });
  const b = concept({
    id: "b",
    prerequisites: [{ id: "a", name: "A" }],
  });

  const first = buildKnowledgeGraph([a, b]);
  const second = buildKnowledgeGraph([a, b], first);

  assert.deepEqual(first, second);
  assert.equal(second.concepts.length, 2);
  assert.equal(second.relationships.length, 1);
});

test("upserts concepts by id instead of duplicating nodes", () => {
  const original = concept({ id: "a", name: "Original" });
  const updated = concept({ id: "a", name: "Updated", version: 2 });

  const first = buildKnowledgeGraph([original]);
  const second = buildKnowledgeGraph([updated], first);

  assert.equal(second.concepts.length, 1);
  assert.equal(second.concepts[0].name, "Updated");
  assert.equal(second.concepts[0].version, 2);
});

test("does not mutate the existingGraph or concepts arguments", () => {
  const a = concept({ id: "a" });
  const existing = { concepts: [], relationships: [] };

  buildKnowledgeGraph([a], existing);

  assert.deepEqual(existing, { concepts: [], relationships: [] });
});

console.log(`\n${passed} passed`);
