import assert from "node:assert/strict";
import { ZodError } from "zod";

import { ParsedDocument } from "../packages/shared-types";
import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ProviderImage } from "../packages/ai/providers/ImageCapableProvider";
import { ClaudeDocumentStructureExtractor } from "../packages/ai/extractors/DocumentStructureExtractorService";
import { buildDocumentStructureExtractionPrompt } from "../packages/ai/prompts/document-structure-extraction.prompt";

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

/**
 * A fake ImageCapableProvider that records the exact images and
 * prompt it was called with, so tests can assert both the ordering
 * of the images sent and that the multimodal path (not .generate)
 * was actually taken.
 */
function fakeImageCapableProvider(rawResponse: string): {
  provider: AIProvider & { generateFromImages: (images: ProviderImage[], prompt: string) => Promise<string> };
  calls: { generate: number; generateFromImages: Array<{ images: ProviderImage[]; prompt: string }> };
} {
  const calls = {
    generate: 0,
    generateFromImages: [] as Array<{ images: ProviderImage[]; prompt: string }>,
  };
  return {
    calls,
    provider: {
      async generate() {
        calls.generate += 1;
        return rawResponse;
      },
      async generateFromImages(images: ProviderImage[], prompt: string) {
        calls.generateFromImages.push({ images, prompt });
        return rawResponse;
      },
    },
  };
}

// A recording provider, to capture exactly what prompt the extractor
// actually built and sent — used to prove it's page-labelled, not
// the old flattened-document format.
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

const document: ParsedDocument = {
  id: "__test-structure-doc__.pdf",
  filename: "structure-doc.pdf",
  kind: "pdf",
  text: "Chapter 3 — Angles as Turns\n...\nLet Us Do\n1. Guess the angle.",
  pages: [
    "Chapter 3 — Angles as Turns\nA turn is a rotation around a fixed point.",
    "More explanation about angles and turns.",
    "Let Us Do\n1. Guess the angle.\n2. Name the turn.",
  ],
};

async function main() {
  console.log("DocumentStructureExtractor / persistence-shape / page-awareness");

  await test("a valid content + exercise response is parsed into a DocumentStructureCandidate with provenance", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [
          {
            kind: "content",
            startPage: 1,
            endPage: 2,
            chapterTitle: "Angles as Turns",
            chapterNumber: 3,
            evidence: "Page 1 heading reads \"Chapter 3 — Angles as Turns\"",
          },
          {
            kind: "exercise",
            startPage: 3,
            endPage: 3,
            evidence: "Page 3 begins with the heading \"Let Us Do\" followed by numbered questions",
          },
        ],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.sourceDocumentId, document.id);
    assert.equal(candidate.status, "pending");
    assert.equal(candidate.ranges.length, 2);
  });

  await test("multiple ranges of the same kind are preserved, not merged", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [
          { kind: "exercise", startPage: 1, endPage: 1, evidence: "first block of questions" },
          { kind: "exercise", startPage: 3, endPage: 3, evidence: "second block of questions" },
        ],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.ranges.length, 2);
    assert.deepEqual(candidate.ranges.map((r) => r.startPage), [1, 3]);
  });

  await test("chapterTitle is preserved exactly as returned", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [
          {
            kind: "content",
            startPage: 1,
            endPage: 1,
            chapterTitle: "Angles as Turns",
            evidence: "page 1 heading",
          },
        ],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.ranges[0].chapterTitle, "Angles as Turns");
  });

  await test("chapterNumber is preserved exactly as returned", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [
          { kind: "content", startPage: 1, endPage: 1, chapterNumber: 3, evidence: "page 1 heading" },
        ],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.ranges[0].chapterNumber, 3);
  });

  await test("evidence text is preserved verbatim", async () => {
    const evidenceText = "Page 3 begins with the heading \"Let Us Do\"";
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "exercise", startPage: 3, endPage: 3, evidence: evidenceText }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.ranges[0].evidence, evidenceText);
  });

  await test("malformed LLM output (invalid kind) is rejected, not silently coerced", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "section", startPage: 1, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("malformed LLM output (missing evidence) is rejected", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 1 }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("empty ranges is disallowed and rejected", async () => {
    const provider = fakeProvider(JSON.stringify({ ranges: [] }));
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("a non-positive page number is rejected", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 0, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("startPage > endPage is rejected", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 3, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), ZodError);
  });

  await test("a range ending past the document's actual page count is rejected (service-level check, not schema)", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        // document has only 3 pages
        ranges: [{ kind: "content", startPage: 1, endPage: 10, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await assert.rejects(() => extractor.extract(document), /only has 3 page/);
  });

  await test("provenance: sourceDocumentId always comes from the ParsedDocument, never the LLM response", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 1, evidence: "x", sourceDocumentId: "attacker-supplied.pdf" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.sourceDocumentId, document.id);
  });

  await test("provenance: extractedAt is a real, code-stamped timestamp, never trusted from the LLM response", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 1, evidence: "x", extractedAt: "1999-01-01T00:00:00.000Z" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.notEqual(candidate.extractedAt, "1999-01-01T00:00:00.000Z");
    assert.ok(!Number.isNaN(Date.parse(candidate.extractedAt)));
  });

  await test("status is always \"pending\", regardless of what the LLM response contains", async () => {
    const provider = fakeProvider(
      JSON.stringify({
        status: "confirmed",
        ranges: [{ kind: "content", startPage: 1, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(document);

    assert.equal(candidate.status, "pending");
  });

  await test("the extractor builds a page-labelled prompt from document.pages, not the flattened document.text", async () => {
    const { provider, prompts } = recordingProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await extractor.extract(document);

    assert.equal(prompts.length, 1);
    const prompt = prompts[0];

    assert.match(prompt, /PAGE 1/);
    assert.match(prompt, /PAGE 2/);
    assert.match(prompt, /PAGE 3/);
    assert.match(prompt, /Let Us Do/);
    // Each page's own text appears once — proof the prompt is built
    // from the per-page array, not a second, separately-flattened copy.
    assert.equal(prompt.split("More explanation about angles and turns.").length - 1, 1);
  });

  await test("an image-only document is sent through generateFromImages, not generate, with all page images in order", async () => {
    const imageDocument: ParsedDocument = {
      id: "__test-image-only-doc__.pdf",
      filename: "image-only-doc.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "", ""],
      pageImages: [
        { base64: "page1base64", mediaType: "image/png" },
        { base64: "page2base64", mediaType: "image/png" },
        { base64: "page3base64", mediaType: "image/png" },
      ],
    };

    const { provider, calls } = fakeImageCapableProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 3, evidence: "seen in the attached images" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(imageDocument);

    assert.equal(candidate.ranges.length, 1);
    assert.equal(calls.generate, 0, "the text-only path should not be used");
    assert.equal(calls.generateFromImages.length, 1, "one combined request, not one per page");

    const [{ images, prompt }] = calls.generateFromImages;
    assert.deepEqual(
      images.map((i) => i.base64),
      ["page1base64", "page2base64", "page3base64"],
      "images must be sent in page order"
    );
    assert.match(prompt, /PAGE 1/);
    assert.match(prompt, /PAGE 2/);
    assert.match(prompt, /PAGE 3/);
    assert.match(prompt, /attached as image 1 of 3/);
    assert.match(prompt, /attached as image 3 of 3/);
  });

  await test("a mixed document preserves text evidence for text pages and sends only image pages, in order, with full page context", async () => {
    const mixedDocument: ParsedDocument = {
      id: "__test-mixed-doc__.pdf",
      filename: "mixed-doc.pdf",
      kind: "pdf",
      text: "Chapter 4 — Living and Non-living things",
      pages: ["Chapter 4 — Living and Non-living things", "", "", "Chapter 5 — Plants Around Us"],
      pageImages: [null, { base64: "page2base64", mediaType: "image/png" }, { base64: "page3base64", mediaType: "image/png" }, null],
    };

    const { provider, calls } = fakeImageCapableProvider(
      JSON.stringify({
        ranges: [
          { kind: "content", startPage: 1, endPage: 1, chapterTitle: "Living and Non-living things", chapterNumber: 4, evidence: "PAGE 1 text" },
          { kind: "exercise", startPage: 2, endPage: 3, evidence: "attached images show practice activities" },
          { kind: "content", startPage: 4, endPage: 4, chapterTitle: "Plants Around Us", chapterNumber: 5, evidence: "PAGE 4 text" },
        ],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    const candidate = await extractor.extract(mixedDocument);

    assert.equal(candidate.ranges.length, 3);
    assert.equal(calls.generateFromImages.length, 1);

    const [{ images, prompt }] = calls.generateFromImages;
    assert.deepEqual(images.map((i) => i.base64), ["page2base64", "page3base64"]);

    // Full page context (both text and image-page placeholders) is
    // present, not just the image pages.
    assert.match(prompt, /Chapter 4 — Living and Non-living things/);
    assert.match(prompt, /Chapter 5 — Plants Around Us/);
    assert.match(prompt, /PAGE 2\n\[No extractable text/);
    assert.match(prompt, /PAGE 3\n\[No extractable text/);
  });

  await test("a non-image-capable provider fails clearly, rather than silently dropping the images, when image pages exist", async () => {
    const imageDocument: ParsedDocument = {
      id: "__test-needs-image-provider__.pdf",
      filename: "needs-image-provider.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageImages: [{ base64: "onlypage", mediaType: "image/png" }],
    };

    const textOnlyProvider = fakeProvider(JSON.stringify({ ranges: [] }));
    const extractor = new ClaudeDocumentStructureExtractor(textOnlyProvider);

    await assert.rejects(
      () => extractor.extract(imageDocument),
      /image-capable AI provider/
    );
  });

  await test("a document with pageImages entirely absent uses the plain text path unchanged (backward compatibility)", async () => {
    const { provider, calls } = fakeImageCapableProvider(
      JSON.stringify({
        ranges: [{ kind: "content", startPage: 1, endPage: 1, evidence: "x" }],
      })
    );
    const extractor = new ClaudeDocumentStructureExtractor(provider);

    await extractor.extract(document);

    assert.equal(calls.generateFromImages.length, 0, "no images exist, so generate() should be used");
    assert.equal(calls.generate, 1);
  });

  await test("buildDocumentStructureExtractionPrompt labels every page in order, independent of the extractor", () => {
    const prompt = buildDocumentStructureExtractionPrompt(["alpha", "beta", "gamma"]);

    const pageOneIndex = prompt.indexOf("PAGE 1");
    const pageTwoIndex = prompt.indexOf("PAGE 2");
    const pageThreeIndex = prompt.indexOf("PAGE 3");

    assert.ok(pageOneIndex < pageTwoIndex);
    assert.ok(pageTwoIndex < pageThreeIndex);
    assert.match(prompt, /PAGE 1\nalpha/);
    assert.match(prompt, /PAGE 2\nbeta/);
    assert.match(prompt, /PAGE 3\ngamma/);
  });

  await test("buildDocumentStructureExtractionPrompt with no imagePageNumbers is byte-identical to omitting the argument (backward compatibility)", () => {
    const withDefault = buildDocumentStructureExtractionPrompt(["alpha", "beta"]);
    const withExplicitEmpty = buildDocumentStructureExtractionPrompt(["alpha", "beta"], []);

    assert.equal(withDefault, withExplicitEmpty);
  });

  await test("buildDocumentStructureExtractionPrompt marks image pages with their ordinal, in page order", () => {
    const prompt = buildDocumentStructureExtractionPrompt(["alpha", "", "", "delta"], [2, 3]);

    assert.match(prompt, /PAGE 1\nalpha/);
    assert.match(prompt, /PAGE 2\n\[No extractable text on this page\. This page is attached as image 1 of 2/);
    assert.match(prompt, /PAGE 3\n\[No extractable text on this page\. This page is attached as image 2 of 2/);
    assert.match(prompt, /PAGE 4\ndelta/);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
