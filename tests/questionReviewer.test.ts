import assert from "node:assert/strict";

import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ClaudeQuestionReviewer } from "../packages/ai/generators/QuestionReviewerService";
import { GeneratedQuestionDraft, QuestionBlueprint } from "../packages/shared-types";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeProvider(response: string): AIProvider & { calls: number; lastPrompt?: string } {
  return {
    calls: 0,
    lastPrompt: undefined,
    async generate(prompt: string) {
      this.calls += 1;
      this.lastPrompt = prompt;
      return response;
    },
  };
}

const draft: GeneratedQuestionDraft = {
  questionText: "What is 1/2 + 1/4?",
  questionType: "reasoning",
  correctAnswer: "3/4",
  explanation: "1/2 is the same as 2/4, so 2/4 + 1/4 = 3/4.",
};

const blueprint: QuestionBlueprint = {
  conceptId: "fractions",
  conceptName: "Fractions",
  questionType: "reasoning",
  difficulty: "grade",
  description: "Fractions represent parts of a whole.",
  sourcePatternIds: [],
  origin: "llm-inferred",
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function main() {
  console.log("ClaudeQuestionReviewer (independent LLM review pass)");

  await test("parses an approved review result", async () => {
    const provider = fakeProvider(JSON.stringify({ approved: true }));
    const reviewer = new ClaudeQuestionReviewer(provider);

    const result = await reviewer.review(draft, blueprint);

    assert.equal(provider.calls, 1);
    assert.equal(result.approved, true);
    assert.ok(provider.lastPrompt?.includes(draft.questionText));
  });

  await test("parses a rejected review result with its reason", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        approved: false,
        reason: "The recomputed answer does not match the stated correct answer.",
      })
    );
    const reviewer = new ClaudeQuestionReviewer(provider);

    const result = await reviewer.review(draft, blueprint);

    assert.equal(result.approved, false);
    assert.equal(
      result.reason,
      "The recomputed answer does not match the stated correct answer."
    );
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
