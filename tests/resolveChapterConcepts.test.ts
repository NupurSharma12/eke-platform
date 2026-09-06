import assert from "node:assert/strict";

import { Chapter, Concept } from "../packages/shared-types";
import { resolveChapterConcepts } from "../packages/knowledge-engine/examPlanning";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function chapter(overrides: Partial<Chapter> & { sourceDocumentIds: string[] }): Chapter {
  return {
    id: "chapter-1",
    grade: 5,
    subject: "math",
    number: null,
    name: null,
    status: "pending",
    ...overrides,
  };
}

function concept(
  overrides: Partial<Concept> & { id: string; sourceDocuments: string[] }
): Concept {
  return {
    name: overrides.id,
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
    version: 1,
    keywords: [],
    metadata: {
      version: 1,
      sourceDocuments: overrides.sourceDocuments,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

console.log("resolveChapterConcepts");

test("basic resolution: only the concept sharing a source document matches", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const conceptB = concept({ id: "concept-b", sourceDocuments: ["book-ch3"] });

  assert.deepEqual(resolveChapterConcepts(ch, [conceptA, conceptB]), [
    "concept-a",
  ]);
});

test("multiple chapter source documents: a match on any one is sufficient", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2", "worksheet-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const conceptB = concept({
    id: "concept-b",
    sourceDocuments: ["worksheet-ch2"],
  });
  const conceptC = concept({ id: "concept-c", sourceDocuments: ["book-ch3"] });

  assert.deepEqual(
    resolveChapterConcepts(ch, [conceptA, conceptB, conceptC]),
    ["concept-a", "concept-b"]
  );
});

test("no matches returns an empty array", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch3"] });

  assert.deepEqual(resolveChapterConcepts(ch, [conceptA]), []);
});

test("a concept with no source documents never matches", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: [] });

  assert.deepEqual(resolveChapterConcepts(ch, [conceptA]), []);
});

test("a concept referencing two of the chapter's documents appears only once", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2", "worksheet-ch2"] });
  const conceptA = concept({
    id: "concept-a",
    sourceDocuments: ["book-ch2", "worksheet-ch2"],
  });

  assert.deepEqual(resolveChapterConcepts(ch, [conceptA]), ["concept-a"]);
});

test("deterministic ordering: result is sorted by concept id regardless of input order", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2"] });
  const conceptZ = concept({ id: "concept-z", sourceDocuments: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const conceptM = concept({ id: "concept-m", sourceDocuments: ["book-ch2"] });

  const first = resolveChapterConcepts(ch, [conceptZ, conceptA, conceptM]);
  const second = resolveChapterConcepts(ch, [conceptM, conceptZ, conceptA]);

  assert.deepEqual(first, ["concept-a", "concept-m", "concept-z"]);
  assert.deepEqual(second, ["concept-a", "concept-m", "concept-z"]);
});

test("does not mutate the supplied Chapter or Concepts", () => {
  const ch = chapter({ sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const chapterSnapshot = JSON.parse(JSON.stringify(ch));
  const conceptSnapshot = JSON.parse(JSON.stringify(conceptA));

  resolveChapterConcepts(ch, [conceptA]);

  assert.deepEqual(ch, chapterSnapshot);
  assert.deepEqual(conceptA, conceptSnapshot);
});

console.log(`\n${passed} passed`);
