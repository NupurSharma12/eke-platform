import assert from "node:assert/strict";

import { Chapter, Concept } from "../packages/shared-types";
import {
  resolveExamScope,
  PendingChapterSelectedError,
} from "../packages/knowledge-engine/examPlanning";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function chapter(overrides: Partial<Chapter> & { id: string; sourceDocumentIds: string[] }): Chapter {
  return {
    grade: 5,
    subject: "math",
    number: null,
    name: null,
    status: "confirmed",
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

console.log("resolveExamScope");

test("a confirmed chapter resolves to its matching concepts", () => {
  const ch = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const conceptB = concept({ id: "concept-b", sourceDocuments: ["book-ch3"] });

  const scope = resolveExamScope([ch], [conceptA, conceptB]);

  assert.deepEqual(scope.eligibleConceptIds, ["concept-a"]);
});

test("multiple confirmed chapters: concepts from all are included", () => {
  const ch1 = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch1"] });
  const ch2 = chapter({ id: "chapter-2", sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch1"] });
  const conceptB = concept({ id: "concept-b", sourceDocuments: ["book-ch2"] });
  const conceptC = concept({ id: "concept-c", sourceDocuments: ["book-ch3"] });

  const scope = resolveExamScope([ch1, ch2], [conceptA, conceptB, conceptC]);

  assert.deepEqual(scope.eligibleConceptIds, ["concept-a", "concept-b"]);
});

test("a concept associated with multiple selected chapters appears only once", () => {
  const ch1 = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch1"] });
  const ch2 = chapter({ id: "chapter-2", sourceDocumentIds: ["worksheet-ch1"] });
  const conceptA = concept({
    id: "concept-a",
    sourceDocuments: ["book-ch1", "worksheet-ch1"],
  });

  const scope = resolveExamScope([ch1, ch2], [conceptA]);

  assert.deepEqual(scope.eligibleConceptIds, ["concept-a"]);
});

test("a pending selected chapter is rejected explicitly", () => {
  const ch = chapter({
    id: "chapter-1",
    sourceDocumentIds: ["book-ch2"],
    status: "pending",
  });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });

  assert.throws(
    () => resolveExamScope([ch], [conceptA]),
    PendingChapterSelectedError
  );
});

test("a pending chapter's concepts never leak into scope, even alongside a confirmed chapter", () => {
  const pendingChapter = chapter({
    id: "chapter-pending",
    sourceDocumentIds: ["book-ch2"],
    status: "pending",
  });
  const confirmedChapter = chapter({
    id: "chapter-confirmed",
    sourceDocumentIds: ["book-ch1"],
  });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const conceptB = concept({ id: "concept-b", sourceDocuments: ["book-ch1"] });

  assert.throws(
    () => resolveExamScope([pendingChapter, confirmedChapter], [conceptA, conceptB]),
    PendingChapterSelectedError
  );
});

test("confirmed chapters that resolve to no concepts return an explicit empty scope", () => {
  const ch = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch3"] });

  const scope = resolveExamScope([ch], [conceptA]);

  assert.deepEqual(scope.eligibleConceptIds, []);
});

test("deterministic ordering: equivalent inputs in different orders yield identical output", () => {
  const ch1 = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch1"] });
  const ch2 = chapter({ id: "chapter-2", sourceDocumentIds: ["book-ch2"] });
  const conceptZ = concept({ id: "concept-z", sourceDocuments: ["book-ch1"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });

  const first = resolveExamScope([ch1, ch2], [conceptZ, conceptA]);
  const second = resolveExamScope([ch2, ch1], [conceptA, conceptZ]);

  assert.deepEqual(first.eligibleConceptIds, ["concept-a", "concept-z"]);
  assert.deepEqual(second.eligibleConceptIds, ["concept-a", "concept-z"]);
});

test("does not mutate the supplied Chapters or Concepts", () => {
  const ch = chapter({ id: "chapter-1", sourceDocumentIds: ["book-ch2"] });
  const conceptA = concept({ id: "concept-a", sourceDocuments: ["book-ch2"] });
  const chapterSnapshot = JSON.parse(JSON.stringify(ch));
  const conceptSnapshot = JSON.parse(JSON.stringify(conceptA));

  resolveExamScope([ch], [conceptA]);

  assert.deepEqual(ch, chapterSnapshot);
  assert.deepEqual(conceptA, conceptSnapshot);
});

console.log(`\n${passed} passed`);
