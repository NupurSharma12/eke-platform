import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import { Concept, QuestionPattern } from "../packages/shared-types";
import { buildQuestionPattern } from "../packages/knowledge-engine/canonicalization/buildQuestionPattern";
import {
  saveQuestionPattern,
  saveQuestionPatterns,
  getQuestionPatternPath,
} from "../packages/knowledge-engine/canonicalization/saveQuestionPatterns";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
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
    questionTemplates: [
      {
        type: "reasoning",
        description: "A multi-step olympiad-style challenge question.",
        bloomLevel: "analyze",
        recommendedDifficulty: "olympiad",
      },
    ],
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

async function main() {
  console.log("QuestionPattern");

  await test("buildQuestionPattern reuses the concept's own questionTemplates verbatim", () => {
    const fractions = concept({ id: "fractions", name: "Fractions" });

    const pattern = buildQuestionPattern(
      fractions,
      "fractions",
      "olympiad-book.pdf",
      "depth-challenge"
    );

    assert.equal(pattern.id, "fractions::olympiad-book.pdf::depth-challenge");
    assert.equal(pattern.canonicalConceptId, "fractions");
    assert.equal(pattern.sourceDocumentId, "olympiad-book.pdf");
    assert.equal(pattern.contribution, "depth-challenge");
    assert.deepEqual(pattern.questionTemplates, fractions.questionTemplates);
  });

  await test("does not invent fields the extraction pipeline does not provide", () => {
    const fractions = concept({ id: "fractions", name: "Fractions" });
    const pattern = buildQuestionPattern(fractions, "fractions", "book.pdf", "question-pattern");

    // Only the fields defined on QuestionPattern exist — no
    // fabricated reasoning-complexity/distractor/combination data.
    assert.deepEqual(Object.keys(pattern).sort(), [
      "canonicalConceptId",
      "contribution",
      "extractedAt",
      "id",
      "questionTemplates",
      "sourceDocumentId",
    ]);
  });

  const samplePattern: QuestionPattern = {
    id: "fractions::__test-question-pattern__.pdf::question-pattern",
    canonicalConceptId: "fractions",
    sourceDocumentId: "__test-question-pattern__.pdf",
    contribution: "question-pattern",
    questionTemplates: [],
    extractedAt: "2026-01-01T00:00:00.000Z",
  };

  const expectedPath = getQuestionPatternPath(
    "fractions",
    "__test-question-pattern__.pdf",
    "question-pattern"
  );

  try {
    await test("saveQuestionPattern writes to a deterministic path derived from concept/source/contribution", async () => {
      const outputPath = await saveQuestionPattern(samplePattern);
      assert.equal(outputPath, expectedPath);

      const written = JSON.parse(await fs.readFile(outputPath, "utf-8"));
      assert.deepEqual(written, samplePattern);
    });

    await test("re-saving the same (concept, source, contribution) overwrites in place, no duplicates", async () => {
      const updated: QuestionPattern = {
        ...samplePattern,
        questionTemplates: [
          {
            type: "mcq",
            description: "updated",
            bloomLevel: "remember",
            recommendedDifficulty: "grade",
          },
        ],
      };

      await saveQuestionPattern(samplePattern);
      await saveQuestionPattern(updated);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.questionTemplates.length, 1);
      assert.equal(written.questionTemplates[0].description, "updated");
    });

    await test("a single source contributing to two categories produces two distinct records", async () => {
      const depthChallenge: QuestionPattern = {
        ...samplePattern,
        id: "fractions::__test-question-pattern__.pdf::depth-challenge",
        contribution: "depth-challenge",
      };

      const paths = await saveQuestionPatterns([samplePattern, depthChallenge]);
      assert.equal(paths.length, 2);
      assert.notEqual(paths[0], paths[1]);

      await fs.rm(paths[1], { force: true });
    });
  } finally {
    await fs.rm(expectedPath, { force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
