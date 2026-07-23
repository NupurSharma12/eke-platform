import assert from "node:assert/strict";

import { Concept, DocumentType, SourceContribution } from "../packages/shared-types";
import { canonicalizeConcepts } from "../packages/knowledge-engine/canonicalization/canonicalizeConcepts";
import { classifyDocument } from "../packages/knowledge-engine/classification";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function concept(
  overrides: Partial<Concept> & { id: string; name: string; sourceDocuments: string[] }
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
    questionTemplates: [
      {
        type: "reasoning",
        description: "sample question",
        bloomLevel: "analyze",
        recommendedDifficulty: "olympiad",
      },
    ],
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

/** Builds a sourceDocumentId -> SourceContribution[] map from real classifyDocument output. */
function contributionsMap(
  entries: [string, DocumentType][]
): Map<string, SourceContribution[]> {
  return new Map(entries.map(([id, type]) => [id, classifyDocument(type)]));
}

console.log("role-aware canonicalization");

test("D1: a core-knowledge (textbook) source creates a ConceptSource", () => {
  const ncert = concept({
    id: "fraction-concept",
    name: "Fractions",
    sourceDocuments: ["ncert.pdf"],
  });

  const map = contributionsMap([["ncert.pdf", "textbook"]]);
  const result = canonicalizeConcepts([ncert], undefined, map);

  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].sourceDocumentId, "ncert.pdf");
  assert.equal(result.questionPatterns.length, 0);
});

test("D2: an olympiad source matching an existing concept does not overwrite the core explanation, even when processed first", () => {
  const olympiadFractions = concept({
    id: "llm-id-a",
    name: "Fractions",
    sourceDocuments: ["olympiad.pdf"],
    explanation: "olympiad framing of fractions",
  });
  const ncertFractions = concept({
    id: "llm-id-b",
    name: "Fractions",
    sourceDocuments: ["ncert.pdf"],
    explanation: "NCERT core explanation of fractions",
  });

  const map = contributionsMap([
    ["olympiad.pdf", "olympiad"],
    ["ncert.pdf", "textbook"],
  ]);

  // Olympiad processed FIRST, NCERT second.
  const result = canonicalizeConcepts([olympiadFractions, ncertFractions], undefined, map);

  assert.equal(result.concepts.length, 1);
  assert.equal(result.concepts[0].explanation, "NCERT core explanation of fractions");
  assert.deepEqual(result.concepts[0].sourceDocuments.sort(), ["ncert.pdf", "olympiad.pdf"]);
});

test("D2b: once a concept has core-knowledge backing, a later core-knowledge source does not silently overwrite it either (first-wins among core sources preserved)", () => {
  const first = concept({
    id: "a",
    name: "Fractions",
    sourceDocuments: ["ncert-ch1.pdf"],
    explanation: "first NCERT explanation",
  });
  const second = concept({
    id: "b",
    name: "Fractions",
    sourceDocuments: ["ncert-ch5-review.pdf"],
    explanation: "second NCERT mention",
  });

  const map = contributionsMap([
    ["ncert-ch1.pdf", "textbook"],
    ["ncert-ch5-review.pdf", "textbook"],
  ]);

  const result = canonicalizeConcepts([first, second], undefined, map);

  assert.equal(result.concepts[0].explanation, "first NCERT explanation");
});

test("D3: an olympiad source contributes both depth-challenge and question-pattern provenance", () => {
  const olympiadFractions = concept({
    id: "llm-id",
    name: "Fractions",
    sourceDocuments: ["olympiad.pdf"],
  });

  const map = contributionsMap([["olympiad.pdf", "olympiad"]]);
  const result = canonicalizeConcepts([olympiadFractions], undefined, map);

  assert.equal(result.sources.length, 0, "olympiad is not core-knowledge, no ConceptSource");
  assert.equal(result.questionPatterns.length, 2);
  const contributions = result.questionPatterns.map((p) => p.contribution).sort();
  assert.deepEqual(contributions, ["depth-challenge", "question-pattern"]);
});

test("D4: a worksheet source matching an existing concept contributes a pattern but never overwrites display fields", () => {
  const ncertFractions = concept({
    id: "ncert-id",
    name: "Fractions",
    sourceDocuments: ["ncert.pdf"],
    explanation: "NCERT core explanation",
  });
  const worksheetFractions = concept({
    id: "worksheet-id",
    name: "Fractions",
    sourceDocuments: ["worksheet.pdf"],
    explanation: "worksheet's own restatement",
  });

  const map = contributionsMap([
    ["ncert.pdf", "textbook"],
    ["worksheet.pdf", "worksheet"],
  ]);

  const result = canonicalizeConcepts([ncertFractions, worksheetFractions], undefined, map);

  assert.equal(result.concepts.length, 1);
  assert.equal(result.concepts[0].explanation, "NCERT core explanation");
  assert.equal(result.questionPatterns.length, 1);
  assert.equal(result.questionPatterns[0].contribution, "question-pattern");
  assert.equal(result.questionPatterns[0].sourceDocumentId, "worksheet.pdf");
});

test("D5: an exam source does not create an arbitrary new canonical concept", () => {
  const examConcept = concept({
    id: "llm-id",
    name: "Some Exam-Only Topic",
    sourceDocuments: ["exam.pdf"],
  });

  const map = contributionsMap([["exam.pdf", "exam"]]);
  const result = canonicalizeConcepts([examConcept], undefined, map);

  assert.equal(result.concepts.length, 0);
  assert.equal(result.sources.length, 0);
  assert.equal(result.questionPatterns.length, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(
    result.candidates[0].reason,
    "source type is not authorized to create new canonical concepts"
  );
  assert.equal(result.candidates[0].createdConceptId, undefined);
});

test("D6: an answer-key source does not create an arbitrary new canonical concept", () => {
  const answerKeyConcept = concept({
    id: "llm-id",
    name: "Some Answer-Key-Only Topic",
    sourceDocuments: ["answer-key.pdf"],
  });

  const map = contributionsMap([["answer-key.pdf", "answer-key"]]);
  const result = canonicalizeConcepts([answerKeyConcept], undefined, map);

  assert.equal(result.concepts.length, 0);
  assert.equal(result.candidates.length, 1);
});

test("D7: student-work does not modify the shared Knowledge Graph at all", () => {
  const existing = {
    concepts: [
      concept({ id: "fractions", name: "Fractions", sourceDocuments: ["ncert.pdf"] }),
    ],
    relationships: [],
  };

  const studentConcept = concept({
    id: "llm-id",
    name: "Fractions",
    sourceDocuments: ["student-answer-sheet.pdf"],
    explanation: "student's own (possibly wrong) restatement",
  });

  const map = contributionsMap([["student-answer-sheet.pdf", "student-work"]]);
  const result = canonicalizeConcepts([studentConcept], existing, map);

  assert.equal(result.concepts.length, 0);
  assert.equal(result.sources.length, 0);
  assert.equal(result.questionPatterns.length, 0);
  assert.equal(result.candidates.length, 0);
});

test("D8: a genuinely new concept from an authorized (depth-challenge) source can still be created", () => {
  const fractions = concept({
    id: "fractions-id",
    name: "Fractions",
    sourceDocuments: ["ncert.pdf"],
  });
  const advancedReasoning = concept({
    id: "llm-id",
    name: "Advanced Fraction Reasoning",
    sourceDocuments: ["olympiad.pdf"],
  });

  const map = contributionsMap([
    ["ncert.pdf", "textbook"],
    ["olympiad.pdf", "olympiad"],
  ]);

  const result = canonicalizeConcepts([fractions, advancedReasoning], undefined, map);

  assert.equal(result.concepts.length, 2);
  const names = result.concepts.map((c) => c.name).sort();
  assert.deepEqual(names, ["Advanced Fraction Reasoning", "Fractions"]);
});

test("D9: existing ambiguous-match ConceptCandidate behavior remains intact under role-awareness", () => {
  const existingGraph = {
    concepts: [
      concept({ id: "fractions-a", name: "Fractions", sourceDocuments: ["book-a.pdf"] }),
      concept({ id: "fractions-b", name: "Fractions", sourceDocuments: ["book-b.pdf"] }),
    ],
    relationships: [],
  };

  const ambiguousRef = concept({
    id: "llm-id",
    name: "Understanding of Fractions",
    sourceDocuments: ["ncert.pdf"],
  });

  const map = contributionsMap([["ncert.pdf", "textbook"]]);
  const result = canonicalizeConcepts([ambiguousRef], existingGraph, map);

  assert.equal(result.concepts.length, 1, "ambiguous but authorized source still creates a concept");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].possibleMatches.length, 2);
  assert.notEqual(result.candidates[0].createdConceptId, undefined);
});

test("default behavior (no sourceContributions map) is unchanged: everything treated as core-knowledge, first source wins", () => {
  const a = concept({ id: "a", name: "Fractions", sourceDocuments: ["x.pdf"], explanation: "first" });
  const b = concept({ id: "b", name: "Fractions", sourceDocuments: ["y.pdf"], explanation: "second" });

  const result = canonicalizeConcepts([a, b]);

  assert.equal(result.concepts.length, 1);
  assert.equal(result.concepts[0].explanation, "first");
  assert.equal(result.sources.length, 2);
});

console.log(`\n${passed} passed`);
