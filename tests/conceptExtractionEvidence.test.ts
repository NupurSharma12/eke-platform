import assert from "node:assert/strict";

import { ParsedDocument, ConceptExtractionResult, SourceContribution } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ClaudeConceptExtractor } from "../packages/ai/extractors/ConceptExtractorService";
import { normalizeConcepts } from "../packages/knowledge-engine/normalization/normalizeConcepts";
import { canonicalizeConcepts } from "../packages/knowledge-engine/canonicalization/canonicalizeConcepts";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

const EXTRACTION_RESULT: ConceptExtractionResult = {
  concepts: [
    {
      id: "angles-as-turns",
      name: "Angles as Turns",
      learningObjectives: ["Identify right, acute, and obtuse angles as turns"],
      explanation: "An angle can be understood as the amount of turn between two rays.",
      prerequisites: [],
      misconceptions: ["All angles look the same regardless of how much turn they represent"],
      teachingStrategies: ["Use a hands-on paper fan to demonstrate variable angles"],
      activities: ["Make a paper fan and show different angles"],
      realLifeExamples: ["Opening a door", "Turning a steering wheel"],
      questionTemplates: ["Identify the type of angle shown"],
      keywords: ["angle", "turn", "geometry"],
    },
  ],
  warnings: [],
  metadata: {
    documentId: "llm-generated-id-should-be-ignored",
    extractor: "test",
    extractedAt: "2026-01-01T00:00:00.000Z",
  },
};

/** Records the exact prompt text sent, and returns a canned ConceptExtractionResult. */
function recordingProvider(): { provider: AIProvider; prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    provider: {
      async generate(prompt: string) {
        prompts.push(prompt);
        return JSON.stringify(EXTRACTION_RESULT);
      },
    },
  };
}

async function main() {
  console.log("Concept extraction with combined document evidence");

  await test("native-text page: concepts are extracted, and native text reaches the prompt", async () => {
    const document: ParsedDocument = {
      id: "eemm103.pdf",
      filename: "eemm103.pdf",
      kind: "pdf",
      text: "Angles arise in situations that involve a turn.",
      pages: ["Angles arise in situations that involve a turn."],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const result = await extractor.extract(document);

    assert.equal(result.concepts.length, 1);
    assert.equal(result.concepts[0].name, "Angles as Turns");
    assert.match(prompts[0], /Angles arise in situations that involve a turn\./);
  });

  await test("OCR-only page (scanned document): concepts are still extracted, OCR text reaches the prompt", async () => {
    const document: ParsedDocument = {
      id: "EVS grade2.pdf",
      filename: "EVS grade2.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["Chapter 4 — Living and Non-living things"],
      pageTextSources: ["ocr"],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const result = await extractor.extract(document);

    assert.equal(result.concepts.length, 1);
    assert.match(prompts[0], /OCR:\nChapter 4 — Living and Non-living things/);
  });

  await test("a page with visual evidence: the visual evidence reaches the extraction prompt", async () => {
    const document: ParsedDocument = {
      id: "eemm103.pdf",
      filename: "eemm103.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["angle diagrams page"],
      pageTextSources: ["ocr"],
      pageVisionAnalysis: [
        {
          visibleText: "should not leak into the prompt as text",
          visualElements: [
            { type: "diagram", description: "a right angle formed by two patterned sticks" },
          ],
          educationalSignificance: "demonstrates angle classification via turns",
        },
      ],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await extractor.extract(document);

    assert.match(prompts[0], /VISUAL EVIDENCE:\n- diagram: a right angle formed by two patterned sticks/);
  });

  await test("mixed native text + OCR + visual evidence in one document: all evidence kinds reach the prompt", async () => {
    const document: ParsedDocument = {
      id: "mixed.pdf",
      filename: "mixed.pdf",
      kind: "pdf",
      text: "Chapter 4 intro",
      pages: ["Chapter 4 intro", ""],
      pageOcrText: [null, "Let's Practise"],
      pageTextSources: [null, "ocr"],
      pageVisionAnalysis: [
        null,
        { visibleText: "x", visualElements: [{ type: "table", description: "a practice exercise table" }], educationalSignificance: "practice section" },
      ],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await extractor.extract(document);

    const prompt = prompts[0];
    assert.match(prompt, /TEXT:\nChapter 4 intro/);
    assert.match(prompt, /OCR:\nLet's Practise/);
    assert.match(prompt, /VISUAL EVIDENCE:\n- table: a practice exercise table/);
  });

  await test("native text remains available (not overwritten) even when OCR fields exist on the document", async () => {
    const document: ParsedDocument = {
      id: "native-wins.pdf",
      filename: "native-wins.pdf",
      kind: "pdf",
      text: "real native chapter text",
      pages: ["real native chapter text"],
      pageOcrText: ["a stray OCR value that must not override native text"],
      pageTextSources: ["pdf"],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await extractor.extract(document);

    assert.match(prompts[0], /TEXT:\nreal native chapter text/);
    assert.doesNotMatch(prompts[0], /a stray OCR value/);
  });

  await test("vision evidence does not overwrite or substitute for native/OCR text in the prompt", async () => {
    const document: ParsedDocument = {
      id: "vision-does-not-override.pdf",
      filename: "vision-does-not-override.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["the real OCR transcription"],
      pageTextSources: ["ocr"],
      pageVisionAnalysis: [
        {
          visibleText: "a completely different vision transcription that must never appear",
          visualElements: [{ type: "diagram", description: "some diagram" }],
          educationalSignificance: "x",
        },
      ],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await extractor.extract(document);

    assert.match(prompts[0], /OCR:\nthe real OCR transcription/);
    assert.doesNotMatch(prompts[0], /a completely different vision transcription/);
  });

  await test("sourceDocumentId is preserved through normalizeConcepts, independent of any evidence used", async () => {
    const document: ParsedDocument = {
      id: "eemm103.pdf",
      filename: "eemm103.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["some ocr text"],
      pageTextSources: ["ocr"],
    };

    const { provider } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const extraction = await extractor.extract(document);
    const concepts = normalizeConcepts(extraction, document.id);

    assert.equal(concepts.length, 1);
    assert.deepEqual(concepts[0].sourceDocuments, ["eemm103.pdf"]);
    assert.deepEqual(concepts[0].metadata.sourceDocuments, ["eemm103.pdf"]);
    // LLM-supplied metadata.documentId is never trusted as provenance.
    assert.notEqual(concepts[0].sourceDocuments[0], "llm-generated-id-should-be-ignored");
  });

  await test("existing canonicalization still runs unchanged: a core-knowledge source creates a canonical concept", async () => {
    const document: ParsedDocument = {
      id: "eemm103.pdf",
      filename: "eemm103.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["angle content"],
      pageTextSources: ["ocr"],
      pageVisionAnalysis: [
        { visibleText: "x", visualElements: [{ type: "diagram", description: "an angle diagram" }], educationalSignificance: "geometry" },
      ],
    };

    const { provider } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const extraction = await extractor.extract(document);
    const concepts = normalizeConcepts(extraction, document.id);

    const sourceContributions = new Map<string, SourceContribution[]>([
      [document.id, ["core-knowledge"]],
    ]);

    const result = canonicalizeConcepts(concepts, undefined, sourceContributions);

    assert.equal(result.concepts.length, 1);
    assert.equal(result.concepts[0].id, "angles-as-turns");
    assert.equal(result.sources.length, 1);
    assert.equal(result.candidates.length, 0);
  });

  await test("student-evidence rules remain unchanged: a student-evidence source never mints a concept, source, or candidate", async () => {
    const document: ParsedDocument = {
      id: "student-attempt.pdf",
      filename: "student-attempt.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["angle content from a student's own work"],
      pageTextSources: ["ocr"],
    };

    const { provider } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const extraction = await extractor.extract(document);
    const concepts = normalizeConcepts(extraction, document.id);

    const sourceContributions = new Map<string, SourceContribution[]>([
      [document.id, ["student-evidence"]],
    ]);

    const result = canonicalizeConcepts(concepts, undefined, sourceContributions);

    assert.equal(result.concepts.length, 0);
    assert.equal(result.sources.length, 0);
    assert.equal(result.questionPatterns.length, 0);
    assert.equal(result.candidates.length, 0);
  });

  await test("deterministic ordering: pages are always reflected in the prompt in page order", async () => {
    const document: ParsedDocument = {
      id: "ordering.pdf",
      filename: "ordering.pdf",
      kind: "pdf",
      text: "",
      pages: ["Alpha page", "Beta page", "Gamma page"],
    };

    const { provider, prompts } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await extractor.extract(document);

    const prompt = prompts[0];
    const alphaIndex = prompt.indexOf("Alpha page");
    const betaIndex = prompt.indexOf("Beta page");
    const gammaIndex = prompt.indexOf("Gamma page");
    assert.ok(alphaIndex < betaIndex && betaIndex < gammaIndex);
  });

  await test("a plain ParsedDocument with no OCR/vision enrichment at all still extracts concepts correctly (backward compatibility)", async () => {
    const document: ParsedDocument = {
      id: "plain.pdf",
      filename: "plain.pdf",
      kind: "pdf",
      text: "Angles arise in situations that involve a turn.",
      pages: ["Angles arise in situations that involve a turn."],
    };

    const { provider } = recordingProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    const result = await extractor.extract(document);

    assert.equal(result.concepts.length, 1);
    assert.equal(result.concepts[0].name, "Angles as Turns");
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
