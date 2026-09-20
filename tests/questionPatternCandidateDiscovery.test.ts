import assert from "node:assert/strict";
import { ZodError } from "zod";

import { ObservedQuestionEvidence, InterpretedQuestionEvidence } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { LLMQuestionPatternCandidateDiscovery } from "../packages/ai/extractors/QuestionPatternCandidateDiscoveryService";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/** Returns a canned response and counts how many times generate() was called. */
function countingProvider(responses: string[]): { provider: AIProvider; callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    provider: {
      async generate() {
        const response = responses[calls] ?? responses[responses.length - 1];
        calls += 1;
        return response;
      },
    },
  };
}

function observed(overrides: Partial<ObservedQuestionEvidence> = {}): ObservedQuestionEvidence {
  return {
    id: "doc.pdf::p1-1::q1",
    sourceDocumentId: "doc.pdf",
    page: { start: 1, end: 1 },
    evidenceTypes: ["ocr"],
    sectionLabel: null,
    observedText: "Which animal gives us milk? (a) Cow (b) Lion (c) Crow",
    status: "pending",
    extractedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function interpreted(overrides: Partial<InterpretedQuestionEvidence> = {}): InterpretedQuestionEvidence {
  return {
    observedEvidenceId: "doc.pdf::p1-1::q1",
    questionType: "mcq",
    answerStyle: "select one option",
    interpretedAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

async function main() {
  console.log("QuestionPatternCandidateDiscovery");

  await test("empty input produces no candidates and never calls the provider", async () => {
    const { provider, callCount } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const candidates = await discovery.discover([], []);

    assert.deepEqual(candidates, []);
    assert.equal(callCount(), 0);
  });

  await test("a singleton pre-group produces one single-observation candidate without calling the provider", async () => {
    const { provider, callCount } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });

    const candidates = await discovery.discover([o1], [i1]);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].confidence, "single-observation");
    assert.deepEqual(candidates[0].observedEvidenceIds, ["doc.pdf::p1-1::q1"]);
    assert.equal(candidates[0].sharedQuestionType, "mcq");
    assert.equal(candidates[0].sourceDocumentId, "doc.pdf");
    assert.equal(candidates[0].status, "pending");
    assert.equal(callCount(), 0);
  });

  await test("two observations, same document + same type: exactly ONE provider call", async () => {
    const { provider, callCount } = countingProvider([
      JSON.stringify({
        groups: [{ observationIndexes: [1, 2], patternDescription: "shared MCQ form" }],
      }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1", observedText: "Which animal gives us milk?" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2", observedText: "Which animal lives in water?" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    const candidates = await discovery.discover([o1, o2], [i1, i2]);

    assert.equal(callCount(), 1);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].confidence, "multiple-observations");
    assert.deepEqual(candidates[0].observedEvidenceIds, ["doc.pdf::p1-1::q1", "doc.pdf::p1-1::q2"]);
    assert.equal(candidates[0].patternDescription, "shared MCQ form");
  });

  await test("the LLM partitions a pre-group into multiple candidates from one provider call", async () => {
    const { provider, callCount } = countingProvider([
      JSON.stringify({
        groups: [
          { observationIndexes: [1, 3], patternDescription: "factual-property MCQ" },
          { observationIndexes: [2], patternDescription: "odd-one-out MCQ" },
        ],
      }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const o3 = observed({ id: "doc.pdf::p1-1::q3" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });
    const i3 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q3" });

    const candidates = await discovery.discover([o1, o2, o3], [i1, i2, i3]);

    assert.equal(callCount(), 1);
    assert.equal(candidates.length, 2);
    assert.deepEqual(candidates[0].observedEvidenceIds, ["doc.pdf::p1-1::q1", "doc.pdf::p1-1::q3"]);
    assert.equal(candidates[0].confidence, "multiple-observations");
    assert.deepEqual(candidates[1].observedEvidenceIds, ["doc.pdf::p1-1::q2"]);
    assert.equal(candidates[1].confidence, "single-observation");
  });

  await test("different ObservedQuestionTypes form separate pre-groups, one call per non-singleton pre-group", async () => {
    const { provider, callCount } = countingProvider([
      JSON.stringify({ groups: [{ observationIndexes: [1, 2], patternDescription: "mcq form" }] }),
      JSON.stringify({ groups: [{ observationIndexes: [1, 2], patternDescription: "matching form" }] }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const mcq1 = observed({ id: "doc.pdf::p1-1::q1" });
    const mcq2 = observed({ id: "doc.pdf::p1-1::q2" });
    const match1 = observed({ id: "doc.pdf::p2-2::q1" });
    const match2 = observed({ id: "doc.pdf::p2-2::q2" });

    const iMcq1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1", questionType: "mcq" });
    const iMcq2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2", questionType: "mcq" });
    const iMatch1 = interpreted({ observedEvidenceId: "doc.pdf::p2-2::q1", questionType: "matching" });
    const iMatch2 = interpreted({ observedEvidenceId: "doc.pdf::p2-2::q2", questionType: "matching" });

    const candidates = await discovery.discover(
      [mcq1, mcq2, match1, match2],
      [iMcq1, iMcq2, iMatch1, iMatch2]
    );

    assert.equal(callCount(), 2);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].sharedQuestionType, "mcq");
    assert.equal(candidates[1].sharedQuestionType, "matching");
  });

  await test("different sourceDocumentIds are never grouped together, even with the same questionType", async () => {
    const { provider, callCount } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "docA.pdf::p1-1::q1", sourceDocumentId: "docA.pdf" });
    const o2 = observed({ id: "docB.pdf::p1-1::q1", sourceDocumentId: "docB.pdf" });
    const i1 = interpreted({ observedEvidenceId: "docA.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "docB.pdf::p1-1::q1" });

    const candidates = await discovery.discover([o1, o2], [i1, i2]);

    assert.equal(callCount(), 0);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].sourceDocumentId, "docA.pdf");
    assert.equal(candidates[1].sourceDocumentId, "docB.pdf");
  });

  await test("sectionLabel does not force separate pre-groups", async () => {
    const { provider, callCount } = countingProvider([
      JSON.stringify({ groups: [{ observationIndexes: [1, 2], patternDescription: "shared form" }] }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1", sectionLabel: "Let's Practise" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2", sectionLabel: "Value Based Question" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    const candidates = await discovery.discover([o1, o2], [i1, i2]);

    assert.equal(callCount(), 1);
    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates[0].observedEvidenceIds, ["doc.pdf::p1-1::q1", "doc.pdf::p1-1::q2"]);
  });

  await test("stable ordering: pre-groups and candidates preserve input order", async () => {
    const { provider } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const matching = observed({ id: "doc.pdf::p1-1::q1", sourceDocumentId: "doc.pdf" });
    const mcq = observed({ id: "doc.pdf::p2-2::q1", sourceDocumentId: "doc.pdf" });

    const iMatching = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1", questionType: "matching" });
    const iMcq = interpreted({ observedEvidenceId: "doc.pdf::p2-2::q1", questionType: "mcq" });

    const candidates = await discovery.discover([matching, mcq], [iMatching, iMcq]);

    assert.equal(candidates[0].sharedQuestionType, "matching");
    assert.equal(candidates[1].sharedQuestionType, "mcq");
  });

  await test("candidate IDs are deterministic given the same observed evidence", async () => {
    const { provider } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });

    const first = await discovery.discover([o1], [i1]);
    const second = await discovery.discover([o1], [i1]);

    assert.equal(first[0].id, second[0].id);
  });

  await test("an out-of-range observation index from the provider is rejected", async () => {
    const { provider } = countingProvider([
      JSON.stringify({ groups: [{ observationIndexes: [1, 99], patternDescription: "x" }] }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    await assert.rejects(() => discovery.discover([o1, o2], [i1, i2]));
  });

  await test("duplicate observation indexes across groups are rejected", async () => {
    const { provider } = countingProvider([
      JSON.stringify({
        groups: [
          { observationIndexes: [1], patternDescription: "a" },
          { observationIndexes: [1, 2], patternDescription: "b" },
        ],
      }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    await assert.rejects(() => discovery.discover([o1, o2], [i1, i2]));
  });

  await test("a missing observation (not accounted for by any group) is rejected", async () => {
    const { provider } = countingProvider([
      JSON.stringify({ groups: [{ observationIndexes: [1], patternDescription: "a" }] }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    await assert.rejects(() => discovery.discover([o1, o2], [i1, i2]));
  });

  await test("an empty group returned by the provider is rejected", async () => {
    const { provider } = countingProvider([
      JSON.stringify({
        groups: [{ observationIndexes: [], patternDescription: "a" }],
      }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    await assert.rejects(() => discovery.discover([o1, o2], [i1, i2]), ZodError);
  });

  await test("malformed JSON response is surfaced, not silently coerced into a candidate", async () => {
    const { provider } = countingProvider(["not valid json {{{"]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    await assert.rejects(() => discovery.discover([o1, o2], [i1, i2]));
  });

  await test("candidate provenance comes from application input, never from provider output", async () => {
    const { provider } = countingProvider([
      JSON.stringify({
        groups: [
          {
            observationIndexes: [1, 2],
            patternDescription: "shared form",
            sourceDocumentId: "attacker-supplied.pdf",
            observedEvidenceIds: ["fabricated-1", "fabricated-2"],
          },
        ],
      }),
    ]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1", sourceDocumentId: "doc.pdf" });
    const o2 = observed({ id: "doc.pdf::p1-1::q2", sourceDocumentId: "doc.pdf" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });
    const i2 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q2" });

    const candidates = await discovery.discover([o1, o2], [i1, i2]);

    assert.equal(candidates[0].sourceDocumentId, "doc.pdf");
    assert.deepEqual(candidates[0].observedEvidenceIds, ["doc.pdf::p1-1::q1", "doc.pdf::p1-1::q2"]);
  });

  await test("a candidate never contains concept/difficulty/Bloom/marks/generation-type fields", async () => {
    const { provider } = countingProvider([]);
    const discovery = new LLMQuestionPatternCandidateDiscovery(provider);

    const o1 = observed({ id: "doc.pdf::p1-1::q1" });
    const i1 = interpreted({ observedEvidenceId: "doc.pdf::p1-1::q1" });

    const candidates = await discovery.discover([o1], [i1]);

    const forbiddenKeys = [
      "conceptId",
      "canonicalConceptId",
      "chapterId",
      "difficulty",
      "recommendedDifficulty",
      "bloomLevel",
      "marks",
      "questionType",
      "contribution",
      "questionTemplates",
    ];
    for (const key of forbiddenKeys) {
      assert.ok(!(key in candidates[0]), `candidate must not contain "${key}"`);
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
