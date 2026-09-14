import assert from "node:assert/strict";
import { ZodError } from "zod";

import { ObservedQuestionEvidence } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ClaudeQuestionTypeInterpreter } from "../packages/ai/extractors/QuestionTypeInterpreterService";

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

/** Records the exact prompt text sent, and returns a canned response. */
function recordingProvider(rawResponse: string): { provider: AIProvider; prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    provider: {
      async generate(prompt: string) {
        prompts.push(prompt);
        return rawResponse;
      },
    },
  };
}

function evidence(overrides: Partial<ObservedQuestionEvidence> = {}): ObservedQuestionEvidence {
  return {
    id: "EVS grade2.pdf::p5-5::q1",
    sourceDocumentId: "EVS grade2.pdf",
    page: { start: 5, end: 5 },
    evidenceTypes: ["ocr"],
    sectionLabel: null,
    observedText: "1. Which of the following are natural things?",
    status: "pending",
    extractedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function main() {
  console.log("QuestionTypeInterpreter");

  await test("an MCQ-shaped question is classified as \"mcq\"", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "mcq", answerStyle: "select one option" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(
      evidence({ observedText: "1. Which is a living thing? (a) Rock (b) Dog (c) Table" })
    );

    assert.equal(result.questionType, "mcq");
    assert.equal(result.answerStyle, "select one option");
  });

  await test("a true/false question is classified as \"true-false\"", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "true-false", answerStyle: "write True or False" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(
      evidence({ observedText: "State whether the following is True or False: Plants are non-living things." })
    );

    assert.equal(result.questionType, "true-false");
  });

  await test("a fill-in-the-blank question is classified as \"fill-blanks\"", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "fill-blanks", answerStyle: "write one word" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(
      evidence({ observedText: "A _______ is a living thing that can photosynthesize." })
    );

    assert.equal(result.questionType, "fill-blanks");
  });

  await test("a matching question is classified as \"matching\" (a non-MCQ form)", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "matching", answerStyle: "draw a line connecting each pair" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(
      evidence({ observedText: "Match the animals in Column A with their habitats in Column B." })
    );

    assert.equal(result.questionType, "matching");
  });

  await test("a sequencing question is classified as \"sequencing\" (another non-MCQ form)", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "sequencing", answerStyle: "write the steps in the correct order" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(
      evidence({ observedText: "Arrange the following stages of a plant's growth in the correct order." })
    );

    assert.equal(result.questionType, "sequencing");
  });

  await test("sectionLabel is passed to the prompt as context when present", async () => {
    const { provider, prompts } = recordingProvider(
      JSON.stringify({ questionType: "short-answer", answerStyle: "write a short sentence" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await interpreter.interpret(evidence({ sectionLabel: "Value Based Question" }));

    assert.match(prompts[0], /Value Based Question/);
  });

  await test("no sectionLabel: the prompt does not fabricate one", async () => {
    const { provider, prompts } = recordingProvider(
      JSON.stringify({ questionType: "short-answer", answerStyle: "write a short sentence" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await interpreter.interpret(evidence({ sectionLabel: null }));

    assert.doesNotMatch(prompts[0], /section heading/);
  });

  await test("application-owned observedEvidenceId is preserved from evidence.id", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "short-answer", answerStyle: "write a short sentence" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence({ id: "real-evidence-id::p1-1::q1" }));

    assert.equal(result.observedEvidenceId, "real-evidence-id::p1-1::q1");
  });

  await test("application-owned status is always \"pending\"", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "short-answer", answerStyle: "write a short sentence" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence());

    assert.equal(result.status, "pending");
  });

  await test("application-owned interpretedAt is a real, code-stamped timestamp", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "short-answer", answerStyle: "write a short sentence" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence());

    assert.ok(!Number.isNaN(Date.parse(result.interpretedAt)));
  });

  await test("provider output cannot inject application-owned provenance: LLM-supplied observedEvidenceId/status/interpretedAt are ignored entirely", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        questionType: "short-answer",
        answerStyle: "write a short sentence",
        observedEvidenceId: "attacker-supplied-id",
        status: "confirmed",
        interpretedAt: "1999-01-01T00:00:00.000Z",
      })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence({ id: "real-id" }));

    assert.equal(result.observedEvidenceId, "real-id");
    assert.equal(result.status, "pending");
    assert.notEqual(result.interpretedAt, "1999-01-01T00:00:00.000Z");
  });

  await test("malformed JSON response fails, not silently coerced", async () => {
    const provider = fakeProvider("not valid json {{{");
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence()));
  });

  await test("schema-invalid output (unsupported questionType) fails", async () => {
    const provider = fakeProvider(
      JSON.stringify({ questionType: "essay", answerStyle: "write an essay" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence()), ZodError);
  });

  await test("schema-invalid output (missing answerStyle) fails", async () => {
    const provider = fakeProvider(JSON.stringify({ questionType: "mcq" }));
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence()), ZodError);
  });

  await test("empty observedText does not call the provider at all", async () => {
    let called = false;
    const provider: AIProvider = {
      async generate() {
        called = true;
        return JSON.stringify({ questionType: "mcq", answerStyle: "x" });
      },
    };
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence({ observedText: "" })));
    assert.equal(called, false);
  });

  await test("whitespace-only observedText does not call the provider", async () => {
    let called = false;
    const provider: AIProvider = {
      async generate() {
        called = true;
        return JSON.stringify({ questionType: "mcq", answerStyle: "x" });
      },
    };
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence({ observedText: "   " })));
    assert.equal(called, false);
  });

  await test("missing evidence.id does not call the provider", async () => {
    let called = false;
    const provider: AIProvider = {
      async generate() {
        called = true;
        return JSON.stringify({ questionType: "mcq", answerStyle: "x" });
      },
    };
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence({ id: "" })));
    assert.equal(called, false);
  });

  await test("missing evidence.sourceDocumentId does not call the provider", async () => {
    let called = false;
    const provider: AIProvider = {
      async generate() {
        called = true;
        return JSON.stringify({ questionType: "mcq", answerStyle: "x" });
      },
    };
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence({ sourceDocumentId: "" })));
    assert.equal(called, false);
  });

  await test("an invalid page range (start > end) does not call the provider", async () => {
    let called = false;
    const provider: AIProvider = {
      async generate() {
        called = true;
        return JSON.stringify({ questionType: "mcq", answerStyle: "x" });
      },
    };
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    await assert.rejects(() => interpreter.interpret(evidence({ page: { start: 5, end: 2 } })));
    assert.equal(called, false);
  });

  await test("concept/difficulty/marks are not part of the output schema — an LLM-supplied value for any of them is silently ignored", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        questionType: "mcq",
        answerStyle: "select one option",
        difficulty: "advanced",
        marks: 5,
        conceptId: "living-things",
      })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence());

    assert.ok(!("difficulty" in result));
    assert.ok(!("marks" in result));
    assert.ok(!("conceptId" in result));
  });

  await test("the existing generation QuestionType is untouched: ObservedQuestionType is a structurally distinct set of values", async () => {
    // mcq is the only value the two vocabularies happen to share;
    // "visual"/"word-problem"/"reasoning"/"olympiad" (generation
    // QuestionType) never appear as valid ObservedQuestionType
    // values, and "true-false"/"matching"/"sequencing"/"diagram-based"/
    // "other" (ObservedQuestionType) never appear as valid generation
    // QuestionType values.
    const provider = fakeProvider(
      JSON.stringify({ questionType: "true-false", answerStyle: "write True or False" })
    );
    const interpreter = new ClaudeQuestionTypeInterpreter(provider);

    const result = await interpreter.interpret(evidence());

    assert.equal(result.questionType, "true-false");

    const generationOnlyValues = ["visual", "word-problem", "reasoning", "olympiad"];
    for (const value of generationOnlyValues) {
      const invalidProvider = fakeProvider(
        JSON.stringify({ questionType: value, answerStyle: "x" })
      );
      const invalidInterpreter = new ClaudeQuestionTypeInterpreter(invalidProvider);
      await assert.rejects(() => invalidInterpreter.interpret(evidence()), ZodError);
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
