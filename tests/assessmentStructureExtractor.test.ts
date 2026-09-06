import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { ZodError } from "zod";

import { ParsedDocument, DocumentType } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ClaudeAssessmentStructureExtractor } from "../packages/ai/extractors/AssessmentStructureExtractorService";
import {
  ASSESSMENT_EVIDENCE_DOCUMENT_TYPES,
  shouldExtractAssessmentStructure,
} from "../packages/ai/extractors/AssessmentStructureExtractor";
import {
  saveAssessmentStructureEvidence,
  getAssessmentStructureEvidencePath,
} from "../packages/knowledge-engine/ingestion/saveAssessmentStructureEvidence";

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

const document: ParsedDocument = {
  id: "__test-cmo-sample-paper__.pdf",
  filename: "cmo-sample-paper.pdf",
  kind: "pdf",
  text: "1. What is 1/2 + 1/4? (a) 1/4 (b) 3/4 (c) 1/2 ...",
  pages: ["1. What is 1/2 + 1/4? (a) 1/4 (b) 3/4 (c) 1/2 ..."],
};

async function main() {
  console.log("AssessmentStructureExtractor / persistence / conditional invocation");

  await test("a valid extraction response is parsed into AssessmentStructureEvidence with provenance", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        allocations: [
          { questionType: "mcq", count: 10 },
          { questionType: "word-problem", count: 5 },
        ],
      })
    );
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence.sourceDocumentId, document.id);
    assert.deepEqual(evidence.allocations, [
      { questionType: "mcq", count: 10 },
      { questionType: "word-problem", count: 5 },
    ]);
    assert.equal(typeof evidence.extractedAt, "string");
    assert.ok(!Number.isNaN(Date.parse(evidence.extractedAt)));
  });

  await test("an invalid schema response (unsupported questionType) is rejected, not silently coerced", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        allocations: [{ questionType: "essay", count: 5 }],
      })
    );
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("an invalid schema response (non-positive count) is rejected", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        allocations: [{ questionType: "mcq", count: 0 }],
      })
    );
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("empty allocations is disallowed and rejected", async () => {
    const provider = fakeProvider(JSON.stringify({ allocations: [] }));
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("duplicate question types are preserved as separate allocation entries, not merged", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        allocations: [
          { questionType: "mcq", count: 6 },
          { questionType: "mcq", count: 4 },
        ],
      })
    );
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence.allocations.length, 2);
    assert.deepEqual(evidence.allocations, [
      { questionType: "mcq", count: 6 },
      { questionType: "mcq", count: 4 },
    ]);
  });

  await test("provenance: sourceDocumentId always comes from the ParsedDocument, never from the LLM response", async () => {
    const provider = fakeProvider(
      JSON.stringify({ allocations: [{ questionType: "mcq", count: 1 }] })
    );
    const extractor = new ClaudeAssessmentStructureExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence.sourceDocumentId, document.id);
  });

  const expectedPath = getAssessmentStructureEvidencePath(document.id);
  try {
    await test("persistence: evidence is written to the deterministic path and round-trips", async () => {
      const provider = fakeProvider(
        JSON.stringify({ allocations: [{ questionType: "mcq", count: 3 }] })
      );
      const extractor = new ClaudeAssessmentStructureExtractor(provider);
      const evidence = await extractor.extract(document);

      const outputPath = await saveAssessmentStructureEvidence(evidence);
      assert.equal(outputPath, expectedPath);

      const written = JSON.parse(await fs.readFile(outputPath, "utf-8"));
      assert.deepEqual(written, evidence);
    });
  } finally {
    await fs.rm(expectedPath, { force: true });
  }

  await test("conditional invocation: exam is an assessment-evidence document type", () => {
    assert.equal(shouldExtractAssessmentStructure("exam"), true);
  });

  await test("conditional invocation: olympiad is an assessment-evidence document type", () => {
    assert.equal(shouldExtractAssessmentStructure("olympiad"), true);
  });

  await test("conditional invocation: textbook is not an assessment-evidence document type", () => {
    assert.equal(shouldExtractAssessmentStructure("textbook"), false);
  });

  await test("conditional invocation: worksheet and assignment are not assessment-evidence document types", () => {
    assert.equal(shouldExtractAssessmentStructure("worksheet"), false);
    assert.equal(shouldExtractAssessmentStructure("assignment"), false);
  });

  await test("ASSESSMENT_EVIDENCE_DOCUMENT_TYPES is exactly exam + olympiad", () => {
    const sorted = [...ASSESSMENT_EVIDENCE_DOCUMENT_TYPES].sort();
    assert.deepEqual(sorted, ["exam", "olympiad"] as DocumentType[]);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
