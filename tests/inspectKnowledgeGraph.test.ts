import assert from "node:assert/strict";

import { Concept, KnowledgeGraph } from "../packages/shared-types";
import {
  findConcept,
  formatConcept,
  parseArgs,
} from "../packages/inspectKnowledgeGraph";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function concept(
  overrides: Partial<Concept> & { id: string; name: string }
): Concept {
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

const fractions = concept({
  id: "fractions",
  name: "Fractions",
  aliases: ["Understanding of Fractions"],
  learningObjectives: ["Recognize equivalent fractions"],
  sourceDocuments: ["eemm102.pdf", "eemm115.pdf"],
});

const equivalentFractions = concept({
  id: "equivalent-fractions",
  name: "Equivalent Fractions",
  prerequisites: [{ id: "fractions", name: "Fractions" }],
  sourceDocuments: ["eemm102.pdf"],
});

const dangling = concept({
  id: "dangling-example",
  name: "Dangling Example",
  prerequisites: [
    { id: "understanding-of-whole-numbers", name: "Understanding of whole numbers" },
  ],
  sourceDocuments: ["eemm102.pdf"],
});

const graph: KnowledgeGraph = {
  concepts: [fractions, equivalentFractions, dangling],
  relationships: [],
};

console.log("inspectKnowledgeGraph");

test("parseArgs requires a query argument", () => {
  assert.throws(() => parseArgs([]));
});

test("parseArgs returns the first argument as the query", () => {
  assert.equal(parseArgs(["fractions"]), "fractions");
});

test("finds a concept by exact id", () => {
  const found = findConcept(graph, "fractions");
  assert.equal(found?.id, "fractions");
});

test("finds a concept by exact case-insensitive name", () => {
  const found = findConcept(graph, "equivalent fractions");
  assert.equal(found?.id, "equivalent-fractions");
});

test("finds a concept by case-insensitive alias", () => {
  const found = findConcept(graph, "understanding of fractions");
  assert.equal(found?.id, "fractions");
});

test("returns undefined for a concept that does not exist", () => {
  const found = findConcept(graph, "photosynthesis");
  assert.equal(found, undefined);
});

test("id lookup takes priority over a name/alias collision", () => {
  // A concept whose id happens to equal another concept's alias
  // text should still resolve by id first.
  const collidingGraph: KnowledgeGraph = {
    concepts: [
      concept({ id: "understanding of fractions", name: "Something Else" }),
      fractions,
    ],
    relationships: [],
  };
  const found = findConcept(collidingGraph, "understanding of fractions");
  assert.equal(found?.id, "understanding of fractions");
});

test("formatConcept resolves a prerequisite reference to the live canonical name", () => {
  const output = formatConcept(equivalentFractions, graph);
  assert.match(output, /Prerequisites:\n {2}- Fractions \(fractions\)/);
});

test("formatConcept marks an unresolved reference rather than hiding it", () => {
  const output = formatConcept(dangling, graph);
  assert.match(output, /\[unresolved\]/);
});

test("formatConcept shows aliases and source documents", () => {
  const output = formatConcept(fractions, graph);
  assert.match(output, /Aliases: Understanding of Fractions/);
  assert.match(output, /Source Documents: eemm102\.pdf, eemm115\.pdf/);
});

console.log(`\n${passed} passed`);
