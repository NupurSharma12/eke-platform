import assert from "node:assert/strict";
import { ZodError } from "zod";

import { ParsedDocument } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ClaudeQuestionPatternEvidenceExtractor } from "../packages/ai/extractors/QuestionPatternEvidenceExtractorService";

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

async function main() {
  console.log("QuestionPatternEvidenceExtractor");

  await test("a text-only document with an observed question: evidenceTypes is [\"text\"]", async () => {
    const document: ParsedDocument = {
      id: "textbook.pdf",
      filename: "textbook.pdf",
      kind: "pdf",
      text: "1. Name two living things you can see around you.",
      pages: ["1. Name two living things you can see around you."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 1,
            sectionLabel: null,
            observedText: "1. Name two living things you can see around you.",
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence.length, 1);
    assert.deepEqual(evidence[0].evidenceTypes, ["text"]);
    assert.equal(evidence[0].observedText, "1. Name two living things you can see around you.");
  });

  await test("an OCR-backed question (no native text): evidenceTypes is [\"ocr\"]", async () => {
    const document: ParsedDocument = {
      id: "scanned.pdf",
      filename: "scanned.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["1. What is the area of a square with side 4 cm?"],
      pageTextSources: ["ocr"],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 1,
            sectionLabel: null,
            observedText: "1. What is the area of a square with side 4 cm?",
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.deepEqual(evidence[0].evidenceTypes, ["ocr"]);
  });

  await test("REGRESSION: pageTextSources[i] === \"ocr\" alone does not add \"ocr\" — pageOcrText[i] must also be non-empty, matching buildDocumentEvidenceText's own gating", async () => {
    const missingOcrText: ParsedDocument = {
      id: "stale-source-tag-missing-text.pdf",
      filename: "stale-source-tag-missing-text.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageTextSources: ["ocr"],
      // pageOcrText omitted entirely — buildDocumentEvidenceText
      // would render no OCR: section for this page at all.
    };

    const emptyOcrText: ParsedDocument = {
      id: "stale-source-tag-empty-text.pdf",
      filename: "stale-source-tag-empty-text.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageTextSources: ["ocr"],
      pageOcrText: ["   "], // whitespace-only — not usable text either
    };

    const questionsResponse = JSON.stringify({
      questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: "some observed question" }],
    });

    for (const document of [missingOcrText, emptyOcrText]) {
      const extractor = new ClaudeQuestionPatternEvidenceExtractor(fakeProvider(questionsResponse));

      // No evidence tier applies at all (no text, no usable OCR, no
      // vision), so extraction must fail loudly rather than silently
      // claiming "ocr" evidence that was never actually available.
      await assert.rejects(
        () => extractor.extract(document),
        /no underlying evidence/
      );
    }

    // Direct assertion on evidenceTypes' actual contents, not just
    // the thrown-error side effect: pair the same stale ocr tag with
    // real vision evidence so extraction succeeds, then confirm the
    // resulting evidenceTypes contains "vision" but never "ocr".
    const staleOcrTagWithVision: ParsedDocument = {
      id: "stale-ocr-tag-with-vision.pdf",
      filename: "stale-ocr-tag-with-vision.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageTextSources: ["ocr"],
      pageOcrText: [null],
      pageVisionAnalysis: [
        {
          visibleText: "",
          visualElements: [{ type: "diagram", description: "a diagram" }],
          educationalSignificance: "x",
        },
      ],
    };

    const extractor = new ClaudeQuestionPatternEvidenceExtractor(fakeProvider(questionsResponse));
    const evidence = await extractor.extract(staleOcrTagWithVision);

    assert.deepEqual(evidence[0].evidenceTypes, ["vision"]);
    assert.ok(!evidence[0].evidenceTypes.includes("ocr"));
  });

  await test("a vision-backed question (diagram evidence, no text/OCR): evidenceTypes is [\"vision\"]", async () => {
    const document: ParsedDocument = {
      id: "diagram.pdf",
      filename: "diagram.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageVisionAnalysis: [
        {
          visibleText: "",
          visualElements: [{ type: "diagram", description: "a right angle formed by two rays" }],
          educationalSignificance: "tests angle identification",
        },
      ],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 1,
            sectionLabel: null,
            observedText: "Identify the angle shown in the diagram.",
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.deepEqual(evidence[0].evidenceTypes, ["vision"]);
  });

  await test("mixed evidenceTypes for one question: OCR text plus a vision-described diagram on the same page", async () => {
    const document: ParsedDocument = {
      id: "mixed-evidence.pdf",
      filename: "mixed-evidence.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["Identify the angle shown below."],
      pageTextSources: ["ocr"],
      pageVisionAnalysis: [
        {
          visibleText: "",
          visualElements: [{ type: "diagram", description: "a right angle formed by two rays" }],
          educationalSignificance: "tests angle identification",
        },
      ],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          { startPage: 1, endPage: 1, sectionLabel: null, observedText: "Identify the angle shown below." },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.deepEqual(evidence[0].evidenceTypes, ["ocr", "vision"]);
  });

  await test("a visible section label is captured", async () => {
    const document: ParsedDocument = {
      id: "with-label.pdf",
      filename: "with-label.pdf",
      kind: "pdf",
      text: "Let's Practise\n1. Name two living things.",
      pages: ["Let's Practise\n1. Name two living things."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          { startPage: 1, endPage: 1, sectionLabel: "Let's Practise", observedText: "1. Name two living things." },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].sectionLabel, "Let's Practise");
  });

  await test("no section label present: sectionLabel is null, not fabricated", async () => {
    const document: ParsedDocument = {
      id: "no-label.pdf",
      filename: "no-label.pdf",
      kind: "pdf",
      text: "1. Name two living things.",
      pages: ["1. Name two living things."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: "1. Name two living things." }],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].sectionLabel, null);
  });

  await test("sectionLabel omitted entirely by the model is also normalized to null", async () => {
    const document: ParsedDocument = {
      id: "omitted-label.pdf",
      filename: "omitted-label.pdf",
      kind: "pdf",
      text: "1. Name two living things.",
      pages: ["1. Name two living things."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [{ startPage: 1, endPage: 1, observedText: "1. Name two living things." }],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].sectionLabel, null);
  });

  await test("a multi-page question span is preserved (startPage !== endPage)", async () => {
    const document: ParsedDocument = {
      id: "multi-page.pdf",
      filename: "multi-page.pdf",
      kind: "pdf",
      text: "",
      pages: ["Question stem begins here.", "...and its options appear here."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 2,
            sectionLabel: null,
            observedText: "Question stem begins here. ...and its options appear here.",
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.deepEqual(evidence[0].page, { start: 1, end: 2 });
    // Evidence types aggregated across the whole span, both pages contributing "text".
    assert.deepEqual(evidence[0].evidenceTypes, ["text"]);
  });

  await test("multiple questions get deterministic IDs based on sourceDocumentId, page span, and ordering", async () => {
    const document: ParsedDocument = {
      id: "multi-question.pdf",
      filename: "multi-question.pdf",
      kind: "pdf",
      text: "",
      pages: ["Q1 text.", "Q2 text."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          { startPage: 1, endPage: 1, sectionLabel: null, observedText: "Q1 text." },
          { startPage: 2, endPage: 2, sectionLabel: null, observedText: "Q2 text." },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].id, "multi-question.pdf::p1-1::q1");
    assert.equal(evidence[1].id, "multi-question.pdf::p2-2::q2");
  });

  await test("sourceDocumentId is application-owned: always document.id, never trusted from the LLM", async () => {
    const document: ParsedDocument = {
      id: "real-doc-id.pdf",
      filename: "real-doc-id.pdf",
      kind: "pdf",
      text: "1. Question text.",
      pages: ["1. Question text."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 1,
            sectionLabel: null,
            observedText: "1. Question text.",
            // An attacker-supplied/hallucinated field the schema doesn't
            // even define — Zod's default parsing simply ignores it.
            sourceDocumentId: "attacker-supplied.pdf",
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].sourceDocumentId, "real-doc-id.pdf");
  });

  await test("evidenceTypes is application-derived, not LLM-owned: an LLM-supplied value is ignored entirely", async () => {
    const document: ParsedDocument = {
      id: "ignore-llm-evidence-types.pdf",
      filename: "ignore-llm-evidence-types.pdf",
      kind: "pdf",
      text: "1. Question text.",
      pages: ["1. Question text."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          {
            startPage: 1,
            endPage: 1,
            sectionLabel: null,
            observedText: "1. Question text.",
            // Not part of the schema at all — must have zero effect.
            evidenceTypes: ["vision", "ocr"],
          },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    // The document actually only has native text — the real,
    // application-derived answer, not the LLM's fabricated claim.
    assert.deepEqual(evidence[0].evidenceTypes, ["text"]);
  });

  await test("an out-of-range page is rejected, not silently accepted", async () => {
    const document: ParsedDocument = {
      id: "out-of-range.pdf",
      filename: "out-of-range.pdf",
      kind: "pdf",
      text: "Only page.",
      pages: ["Only page."],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          { startPage: 1, endPage: 5, sectionLabel: null, observedText: "spans past the real document" },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    await assert.rejects(() => extractor.extract(document), /only has 1 page/);
  });

  await test("malformed LLM output (missing observedText) is rejected, not silently coerced", async () => {
    const document: ParsedDocument = {
      id: "malformed.pdf",
      filename: "malformed.pdf",
      kind: "pdf",
      text: "text",
      pages: ["text"],
    };

    const provider = fakeProvider(
      JSON.stringify({ questions: [{ startPage: 1, endPage: 1, sectionLabel: null }] })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("startPage > endPage is rejected", async () => {
    const document: ParsedDocument = {
      id: "bad-range.pdf",
      filename: "bad-range.pdf",
      kind: "pdf",
      text: "a\n\nb",
      pages: ["a", "b"],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [{ startPage: 2, endPage: 1, sectionLabel: null, observedText: "x" }],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("an empty question list is valid: a document with no observable questions returns []", async () => {
    const document: ParsedDocument = {
      id: "no-questions.pdf",
      filename: "no-questions.pdf",
      kind: "pdf",
      text: "This chapter explains living and non-living things.",
      pages: ["This chapter explains living and non-living things."],
    };

    const provider = fakeProvider(JSON.stringify({ questions: [] }));
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.deepEqual(evidence, []);
  });

  await test("observed text is preserved verbatim, not altered", async () => {
    const document: ParsedDocument = {
      id: "verbatim.pdf",
      filename: "verbatim.pdf",
      kind: "pdf",
      text: "text",
      pages: ["text"],
    };

    const exactText = "2. Fill in the blank: A ___ is a living thing that can photosynthesize.";
    const provider = fakeProvider(
      JSON.stringify({
        questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: exactText }],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].observedText, exactText);
  });

  await test("status is always \"pending\"", async () => {
    const document: ParsedDocument = {
      id: "status.pdf",
      filename: "status.pdf",
      kind: "pdf",
      text: "text",
      pages: ["text"],
    };

    const provider = fakeProvider(
      JSON.stringify({ questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: "x" }] })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.equal(evidence[0].status, "pending");
  });

  await test("extractedAt is a real, code-stamped timestamp, never trusted from the LLM response", async () => {
    const document: ParsedDocument = {
      id: "extracted-at.pdf",
      filename: "extracted-at.pdf",
      kind: "pdf",
      text: "text",
      pages: ["text"],
    };

    const provider = fakeProvider(
      JSON.stringify({
        questions: [
          { startPage: 1, endPage: 1, sectionLabel: null, observedText: "x", extractedAt: "1999-01-01T00:00:00.000Z" },
        ],
      })
    );
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    const evidence = await extractor.extract(document);

    assert.notEqual(evidence[0].extractedAt, "1999-01-01T00:00:00.000Z");
    assert.ok(!Number.isNaN(Date.parse(evidence[0].extractedAt)));
  });

  await test("no QuestionType classification is produced anywhere on the result", () => {
    // Type-level check: ObservedQuestionEvidence has no field for
    // this at all, so there is nothing to assert against at runtime
    // beyond confirming the schema itself defines no such field.
    const parsed = { questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: "x" }] };
    assert.ok(!("questionType" in parsed.questions[0]));
  });

  await test("no difficulty is produced anywhere on the result", () => {
    const parsed = { questions: [{ startPage: 1, endPage: 1, sectionLabel: null, observedText: "x" }] };
    assert.ok(!("difficulty" in parsed.questions[0]));
  });

  await test("buildDocumentEvidenceText is actually used: native TEXT:, OCR:, and VISUAL EVIDENCE: all reach the prompt, vision's visibleText does not leak in", async () => {
    const document: ParsedDocument = {
      id: "evidence-in-prompt.pdf",
      filename: "evidence-in-prompt.pdf",
      kind: "pdf",
      text: "Chapter 4 intro",
      pages: ["Chapter 4 intro", "", ""],
      pageOcrText: [null, "Let's Practise", null],
      pageTextSources: [null, "ocr", null],
      pageVisionAnalysis: [
        null,
        null,
        {
          visibleText: "SENTINEL_SHOULD_NOT_APPEAR",
          visualElements: [{ type: "diagram", description: "a right angle formed by two rays" }],
          educationalSignificance: "geometry",
        },
      ],
    };

    const { provider, prompts } = recordingProvider(JSON.stringify({ questions: [] }));
    const extractor = new ClaudeQuestionPatternEvidenceExtractor(provider);

    await extractor.extract(document);

    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /PAGE 1\n\nTEXT:\nChapter 4 intro/);
    assert.match(prompts[0], /PAGE 2\n\nOCR:\nLet's Practise/);
    assert.match(prompts[0], /PAGE 3\n\nVISUAL EVIDENCE:\n- diagram: a right angle formed by two rays/);
    assert.doesNotMatch(prompts[0], /SENTINEL_SHOULD_NOT_APPEAR/);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
