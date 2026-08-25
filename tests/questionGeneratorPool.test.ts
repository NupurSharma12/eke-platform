import assert from "node:assert/strict";

import { ClaudeQuestionGenerator } from "../packages/ai/generators/QuestionGeneratorService";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { QuestionBlueprint } from "../packages/shared-types";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeProvider(rawResponse: string): AIProvider {
  return {
    async generate() {
      return rawResponse;
    },
  };
}

const blueprint: QuestionBlueprint = {
  conceptId: "fractions",
  conceptName: "Fractions",
  questionType: "mcq",
  difficulty: "grade",
  description: "Understanding parts of a whole expressed as fractions.",
  sourcePatternIds: [],
  origin: "llm-inferred",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const validDraft = {
  questionText: "What is 1/2 + 1/4?",
  questionType: "mcq",
  options: ["1/4", "3/4", "1/2"],
  correctAnswer: "3/4",
  explanation: "1/2 is the same as 2/4, so 2/4 + 1/4 = 3/4.",
};

async function main() {
  console.log("ClaudeQuestionGenerator.generateBatch (pool response parsing)");

  await test('a { "questions": [...] } response is parsed and unwrapped into a plain draft array', async () => {
    const provider = fakeProvider(JSON.stringify({ questions: [validDraft, validDraft] }));
    const generator = new ClaudeQuestionGenerator(provider);

    const drafts = await generator.generateBatch(blueprint, 2);

    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].questionText, validDraft.questionText);
  });

  await test(
    "regression: a bare top-level array (no \"questions\" wrapper) is rejected with a clear error, not silently misparsed",
    async () => {
      // The literal shape an OpenAI-compatible json_object response
      // mode (e.g. GroqProvider) can never return as its top-level
      // JSON, and what the pool prompt asked for before this fix —
      // reproduces the original bug's failure class in mirror form
      // (schema now expects an object; a bare array is now the
      // invalid shape, and is rejected instead of silently accepted
      // or crashing the request with an opaque error).
      const provider = fakeProvider(JSON.stringify([validDraft, validDraft]));
      const generator = new ClaudeQuestionGenerator(provider);

      await assert.rejects(() => generator.generateBatch(blueprint, 2));
    }
  );

  await test(
    'regression: an object wrapped under an unexpected key (e.g. the live "questionPool" key Groq actually returned) is rejected with a clear error rather than silently producing an empty pool',
    async () => {
      // This is exactly the raw shape a live Groq call returned in
      // production and triggered the "Expected array, received
      // object" Zod error reported by the UI: { "questionPool": [...] }
      // instead of { "questions": [...] }.
      const provider = fakeProvider(JSON.stringify({ questionPool: [validDraft] }));
      const generator = new ClaudeQuestionGenerator(provider);

      await assert.rejects(() => generator.generateBatch(blueprint, 1));
    }
  );

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
