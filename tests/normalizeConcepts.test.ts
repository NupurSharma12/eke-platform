import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ConceptExtractionResult } from "../packages/shared-types";
import {
  inferPrimaryStrategy,
  inferQuestionType,
  normalizeConcepts,
  slugify,
} from "../packages/knowledge-engine/normalization/normalizeConcepts";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fixture(
  overrides: Partial<ConceptExtractionResult["concepts"][number]> = {}
): ConceptExtractionResult {
  return {
    concepts: [
      {
        id: "equivalent-fractions",
        name: "Equivalent Fractions",
        learningObjectives: ["Recognize equivalent fractions"],
        explanation: "Fractions that represent the same quantity.",
        prerequisites: ["Understanding of basic geometry concepts"],
        misconceptions: ["A larger denominator always means a larger fraction"],
        teachingStrategies: ["Play a matching game with fraction cards"],
        activities: ["Fold paper into equal parts"],
        realLifeExamples: ["Sharing a pizza fairly"],
        questionTemplates: ["Fill in the blank: 1/2 = ?/4"],
        keywords: ["fractions", "equivalent"],
        ...overrides,
      },
    ],
    warnings: [],
    metadata: {
      documentId: "doc-123",
      extractor: "test-fixture",
      extractedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

console.log("normalizeConcepts");

test("preserves id and name", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.equal(concept.id, "equivalent-fractions");
  assert.equal(concept.name, "Equivalent Fractions");
});

test("maps prerequisites to ConceptReference objects", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.deepEqual(concept.prerequisites, [
    {
      id: "understanding-of-basic-geometry-concepts",
      name: "Understanding of basic geometry concepts",
    },
  ]);
});

test("identical prerequisite text across concepts collapses to the same id", () => {
  const data = fixture();
  data.concepts.push({
    ...data.concepts[0],
    id: "comparing-fractions",
    name: "Comparing Fractions",
  });

  const [first, second] = normalizeConcepts(data);
  assert.equal(first.prerequisites[0].id, second.prerequisites[0].id);
});

test("maps misconceptions with empty correction and no fabricated confidence", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.equal(concept.misconceptions.length, 1);
  assert.equal(
    concept.misconceptions[0].misconception,
    "A larger denominator always means a larger fraction"
  );
  assert.equal(concept.misconceptions[0].correction, "");
  assert.equal("confidence" in concept.misconceptions[0], false);
});

test("maps activities and real-life examples", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.deepEqual(concept.teaching.activities, ["Fold paper into equal parts"]);
  assert.deepEqual(concept.realLifeExamples, ["Sharing a pizza fairly"]);
});

test("infers primary teaching strategy from keywords", () => {
  assert.equal(inferPrimaryStrategy(["Play a fun game"]), "game");
  assert.equal(inferPrimaryStrategy(["Tell a short story"]), "story");
  assert.equal(inferPrimaryStrategy(["Use a diagram"]), "visual");
  assert.equal(inferPrimaryStrategy(["Lead a class discussion"]), "discussion");
  assert.equal(inferPrimaryStrategy(["Do a hands-on task"]), "activity");
});

test("infers question template type from prompt text", () => {
  assert.equal(inferQuestionType("Fill in the blank: ___"), "fill-blanks");
  assert.equal(inferQuestionType("Draw a diagram of the shape"), "visual");
  assert.equal(inferQuestionType("How many sides does it have?"), "word-problem");
  assert.equal(inferQuestionType("Explain why this is true"), "reasoning");
  assert.equal(inferQuestionType("An olympiad challenge question"), "olympiad");
  assert.equal(inferQuestionType("What type of turn is this?"), "mcq");
});

test("sets sensible defaults for fields absent from extraction", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.equal(concept.bloomLevel, "understand");
  assert.equal(concept.difficulty, "grade");
  assert.equal(concept.estimatedMinutes, 10);
  assert.equal(concept.version, 1);
  assert.deepEqual(concept.domains, []);
  assert.deepEqual(concept.stories, []);
  assert.deepEqual(concept.leadsTo, []);
  assert.deepEqual(concept.relatedConcepts, []);
});

test("derives sourceDocuments and metadata timestamps from extraction metadata, not wall-clock time", () => {
  const [concept] = normalizeConcepts(fixture());
  assert.deepEqual(concept.sourceDocuments, ["doc-123"]);
  assert.equal(concept.metadata.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(concept.metadata.updatedAt, "2026-01-01T00:00:00.000Z");
});

test("is deterministic: same input produces deep-equal output", () => {
  const data = fixture();
  assert.deepEqual(normalizeConcepts(data), normalizeConcepts(data));
});

test("slugify produces stable, url-safe ids", () => {
  assert.equal(slugify("Understanding of Basic Geometry!"), "understanding-of-basic-geometry");
  assert.equal(slugify("   "), "unknown");
});

test("normalizes the real eemm103 extraction checkpoint without throwing", () => {
  const checkpointPath = path.resolve(
    __dirname,
    "../data/extractions/raw/eemm103.pdf.json"
  );
  const raw: ConceptExtractionResult = JSON.parse(
    readFileSync(checkpointPath, "utf-8")
  );

  const concepts = normalizeConcepts(raw);

  assert.equal(concepts.length, raw.concepts.length);
  for (const concept of concepts) {
    assert.ok(concept.id.length > 0);
    assert.ok(Array.isArray(concept.prerequisites));
    assert.ok(Array.isArray(concept.questionTemplates));
  }
});

console.log(`\n${passed} passed`);
