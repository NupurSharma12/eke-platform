import assert from "node:assert/strict";

import { Concept, QuestionPattern } from "../packages/shared-types";
import { findSuitablePattern } from "../packages/knowledge-engine/questionGeneration/findSuitablePattern";
import { buildBlueprint } from "../packages/knowledge-engine/questionGeneration/buildBlueprint";
import { validateQuestionGenerationRequest } from "../packages/knowledge-engine/questionGeneration/validateQuestionGenerationRequest";
import { validateGeneratedQuestion } from "../packages/knowledge-engine/questionGeneration/validateGeneratedQuestion";

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
    explanation: "Fractions represent part of a whole.",
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

const olympiadPattern: QuestionPattern = {
  id: "fractions::olympiad.pdf::depth-challenge",
  canonicalConceptId: "fractions",
  sourceDocumentId: "olympiad.pdf",
  contribution: "depth-challenge",
  questionTemplates: [
    {
      type: "reasoning",
      description: "A multi-step comparison problem across three fractions.",
      bloomLevel: "analyze",
      recommendedDifficulty: "olympiad",
    },
  ],
  extractedAt: "2026-01-01T00:00:00.000Z",
};

console.log("QuestionBlueprint / validation");

test("findSuitablePattern matches on requested difficulty and type", () => {
  const match = findSuitablePattern([olympiadPattern], {
    conceptId: "fractions",
    difficulty: "olympiad",
    questionType: "reasoning",
  });

  assert.ok(match);
  assert.equal(match?.pattern.id, olympiadPattern.id);
});

test("findSuitablePattern returns null when nothing matches the request", () => {
  const match = findSuitablePattern([olympiadPattern], {
    conceptId: "fractions",
    difficulty: "foundation",
  });

  assert.equal(match, null);
});

test("findSuitablePattern matches a template that describes a visual (shaded region) — visual patterns are legitimate evidence, not skipped", () => {
  const shadedRegionPattern: QuestionPattern = {
    id: "fractions::CMO-Sample-Paper-for-Class-5.pdf::depth-challenge",
    canonicalConceptId: "fractions",
    sourceDocumentId: "CMO-Sample-Paper-for-Class-5.pdf",
    contribution: "depth-challenge",
    questionTemplates: [
      {
        type: "mcq",
        description: "What is the fraction represented by the shaded region?",
        bloomLevel: "understand",
        recommendedDifficulty: "grade",
      },
    ],
    extractedAt: "2026-01-01T00:00:00.000Z",
  };

  const match = findSuitablePattern([shadedRegionPattern], {
    conceptId: "fractions",
    difficulty: "grade",
    questionType: "mcq",
  });

  assert.ok(match);
  assert.equal(match?.pattern.id, shadedRegionPattern.id);
});

test("findSuitablePattern matches a template typed 'visual'", () => {
  const visualTypePattern: QuestionPattern = {
    id: "fractions::worksheet.pdf::question-pattern",
    canonicalConceptId: "fractions",
    sourceDocumentId: "worksheet.pdf",
    contribution: "question-pattern",
    questionTemplates: [
      {
        type: "visual",
        description: "Compare the two amounts shown.",
        bloomLevel: "understand",
        recommendedDifficulty: "grade",
      },
    ],
    extractedAt: "2026-01-01T00:00:00.000Z",
  };

  const match = findSuitablePattern([visualTypePattern], {
    conceptId: "fractions",
    difficulty: "grade",
  });

  assert.ok(match);
  assert.equal(match?.template.type, "visual");
});

test("findSuitablePattern restricts to explicit patternIds when given", () => {
  const otherPattern: QuestionPattern = {
    ...olympiadPattern,
    id: "fractions::worksheet.pdf::question-pattern",
    sourceDocumentId: "worksheet.pdf",
  };

  const match = findSuitablePattern([olympiadPattern, otherPattern], {
    conceptId: "fractions",
    patternIds: [otherPattern.id],
  });

  assert.equal(match?.pattern.id, otherPattern.id);
});

test("buildBlueprint is evidence-derived when a suitable pattern exists", () => {
  const fractions = concept({ id: "fractions", name: "Fractions" });

  const blueprint = buildBlueprint(
    fractions,
    { conceptId: "fractions", difficulty: "olympiad" },
    [olympiadPattern],
    "2026-02-01T00:00:00.000Z"
  );

  assert.equal(blueprint.origin, "evidence-derived");
  assert.deepEqual(blueprint.sourcePatternIds, [olympiadPattern.id]);
  assert.equal(blueprint.description, olympiadPattern.questionTemplates[0].description);
  assert.equal(blueprint.difficulty, "olympiad");
});

test("buildBlueprint falls back to llm-inferred when no suitable pattern exists", () => {
  const fractions = concept({ id: "fractions", name: "Fractions" });

  const blueprint = buildBlueprint(
    fractions,
    { conceptId: "fractions", difficulty: "olympiad" },
    [], // no patterns at all
    "2026-02-01T00:00:00.000Z"
  );

  assert.equal(blueprint.origin, "llm-inferred");
  assert.deepEqual(blueprint.sourcePatternIds, []);
  assert.equal(blueprint.description, fractions.explanation);
});

test("buildBlueprint never labels an llm-inferred blueprint as evidence-derived", () => {
  const fractions = concept({ id: "fractions", name: "Fractions" });

  // A pattern exists for this concept, but not for the requested difficulty.
  const blueprint = buildBlueprint(
    fractions,
    { conceptId: "fractions", difficulty: "foundation" },
    [olympiadPattern],
    "2026-02-01T00:00:00.000Z"
  );

  assert.equal(blueprint.origin, "llm-inferred");
  assert.deepEqual(blueprint.sourcePatternIds, []);
});

test("buildBlueprint is evidence-derived from a visual pattern — a missing original diagram doesn't block using the pattern as inspiration", () => {
  const fractions = concept({ id: "fractions", name: "Fractions" });
  const shadedRegionPattern: QuestionPattern = {
    id: "fractions::CMO-Sample-Paper-for-Class-5.pdf::depth-challenge",
    canonicalConceptId: "fractions",
    sourceDocumentId: "CMO-Sample-Paper-for-Class-5.pdf",
    contribution: "depth-challenge",
    questionTemplates: [
      {
        type: "mcq",
        description: "What is the fraction represented by the shaded region?",
        bloomLevel: "understand",
        recommendedDifficulty: "grade",
      },
    ],
    extractedAt: "2026-01-01T00:00:00.000Z",
  };

  const blueprint = buildBlueprint(
    fractions,
    { conceptId: "fractions", difficulty: "grade", questionType: "mcq" },
    [shadedRegionPattern],
    "2026-02-01T00:00:00.000Z"
  );

  assert.equal(blueprint.origin, "evidence-derived");
  assert.deepEqual(blueprint.sourcePatternIds, [shadedRegionPattern.id]);
  assert.equal(blueprint.description, shadedRegionPattern.questionTemplates[0].description);
});

test("buildBlueprint is pure/deterministic given the same inputs", () => {
  const fractions = concept({ id: "fractions", name: "Fractions" });
  const request = { conceptId: "fractions", difficulty: "olympiad" as const };

  const a = buildBlueprint(fractions, request, [olympiadPattern], "2026-02-01T00:00:00.000Z");
  const b = buildBlueprint(fractions, request, [olympiadPattern], "2026-02-01T00:00:00.000Z");

  assert.deepEqual(a, b);
});

test("validateQuestionGenerationRequest requires a conceptId", () => {
  assert.equal(validateQuestionGenerationRequest({ conceptId: "" }).valid, false);
  assert.equal(validateQuestionGenerationRequest({ conceptId: "fractions" }).valid, true);
});

test("validateQuestionGenerationRequest rejects an invalid difficulty/questionType", () => {
  assert.equal(
    validateQuestionGenerationRequest({
      conceptId: "fractions",
      difficulty: "impossible" as never,
    }).valid,
    false
  );
  assert.equal(
    validateQuestionGenerationRequest({
      conceptId: "fractions",
      questionType: "essay" as never,
    }).valid,
    false
  );
});

test("validateGeneratedQuestion rejects empty required fields", () => {
  const result = validateGeneratedQuestion(
    { questionText: "", questionType: "reasoning", correctAnswer: "", explanation: "" },
    { conceptId: "fractions" }
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test("validateGeneratedQuestion requires mcq options to include the correct answer", () => {
  const missingOptions = validateGeneratedQuestion(
    {
      questionText: "Which is bigger?",
      questionType: "mcq",
      correctAnswer: "1/2",
      explanation: "because",
    },
    { conceptId: "fractions" }
  );
  assert.equal(missingOptions.valid, false);

  const answerNotInOptions = validateGeneratedQuestion(
    {
      questionText: "Which is bigger?",
      questionType: "mcq",
      options: ["1/4", "1/8"],
      correctAnswer: "1/2",
      explanation: "because",
    },
    { conceptId: "fractions" }
  );
  assert.equal(answerNotInOptions.valid, false);

  const valid = validateGeneratedQuestion(
    {
      questionText: "Which is bigger?",
      questionType: "mcq",
      options: ["1/4", "1/2"],
      correctAnswer: "1/2",
      explanation: "because 1/2 > 1/4",
    },
    { conceptId: "fractions" }
  );
  assert.equal(valid.valid, true);
});

test("validateGeneratedQuestion flags a questionType mismatch against the request", () => {
  const result = validateGeneratedQuestion(
    {
      questionText: "text",
      questionType: "mcq",
      options: ["a", "b"],
      correctAnswer: "a",
      explanation: "exp",
    },
    { conceptId: "fractions", questionType: "reasoning" }
  );
  assert.equal(result.valid, false);
});

console.log(`\n${passed} passed`);
