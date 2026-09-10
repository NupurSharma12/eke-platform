import assert from "node:assert/strict";

import { ParsedDocument } from "../packages/shared-types";
import { VisionProvider, VisionAnalysisResult } from "../packages/ai/providers/VisionProvider";
import { ProviderImage } from "../packages/ai/providers/ImageCapableProvider";
import { enrichWithVision } from "../packages/enrichWithVision";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function result(tag: string): VisionAnalysisResult {
  return {
    visibleText: `text-${tag}`,
    visualElements: [{ type: "diagram", description: `diagram-${tag}` }],
    educationalSignificance: `significance-${tag}`,
  };
}

/**
 * A deterministic fake VisionProvider: returns a canned result (or
 * throws a canned error) per call, keyed by call index, and records
 * every image/prompt it was called with.
 */
function fakeVisionProvider(
  results: Array<VisionAnalysisResult | Error>
): { provider: VisionProvider; calls: Array<{ image: ProviderImage; prompt?: string }> } {
  const calls: Array<{ image: ProviderImage; prompt?: string }> = [];
  let callIndex = 0;

  return {
    calls,
    provider: {
      async analyzePage(image: ProviderImage, prompt?: string): Promise<VisionAnalysisResult> {
        calls.push({ image, prompt });
        const r = results[callIndex];
        callIndex += 1;
        if (r instanceof Error) {
          throw r;
        }
        return r;
      },
    },
  };
}

function image(tag: string): ProviderImage {
  return { base64: `base64-${tag}`, mediaType: "image/png" };
}

async function main() {
  console.log("enrichWithVision");

  await test("no page images at all: no vision calls, pageVisionAnalysis/Errors all null", async () => {
    const document: ParsedDocument = {
      id: "text-only.pdf",
      filename: "text-only.pdf",
      kind: "pdf",
      text: "First page\nSecond page",
      pages: ["First page", "Second page"],
    };

    const { provider, calls } = fakeVisionProvider([]);

    const enriched = await enrichWithVision(document, provider);

    assert.equal(calls.length, 0);
    assert.deepEqual(enriched.pageVisionAnalysis, [null, null]);
    assert.deepEqual(enriched.pageVisionErrors, [null, null]);
  });

  await test("one image page: exactly one call", async () => {
    const document: ParsedDocument = {
      id: "one-image.pdf",
      filename: "one-image.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "real text page"],
      pageImages: [image("p1"), null],
    };

    const { provider, calls } = fakeVisionProvider([result("p1")]);

    const enriched = await enrichWithVision(document, provider);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].image.base64, "base64-p1");
    assert.deepEqual(enriched.pageVisionAnalysis, [result("p1"), null]);
  });

  await test("multiple image pages: one call per page, in page order", async () => {
    const document: ParsedDocument = {
      id: "multi-image.pdf",
      filename: "multi-image.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "", ""],
      pageImages: [image("p1"), image("p2"), image("p3")],
    };

    const { provider, calls } = fakeVisionProvider([result("p1"), result("p2"), result("p3")]);

    await enrichWithVision(document, provider);

    assert.equal(calls.length, 3);
    assert.deepEqual(
      calls.map((c) => c.image.base64),
      ["base64-p1", "base64-p2", "base64-p3"]
    );
  });

  await test("page alignment is preserved: a successful result lands at the correct page index in a mixed document", async () => {
    const document: ParsedDocument = {
      id: "mixed.pdf",
      filename: "mixed.pdf",
      kind: "pdf",
      text: "Chapter 4 intro",
      pages: ["Chapter 4 intro", "", "", "Chapter 5 intro"],
      pageImages: [null, image("p2"), image("p3"), null],
    };

    const { provider, calls } = fakeVisionProvider([result("p2"), result("p3")]);

    const enriched = await enrichWithVision(document, provider);

    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map((c) => c.image.base64),
      ["base64-p2", "base64-p3"]
    );
    assert.equal(enriched.pageVisionAnalysis![0], null);
    assert.deepEqual(enriched.pageVisionAnalysis![1], result("p2"));
    assert.deepEqual(enriched.pageVisionAnalysis![2], result("p3"));
    assert.equal(enriched.pageVisionAnalysis![3], null);
  });

  await test("one page's failure does not prevent later pages from being analyzed", async () => {
    const document: ParsedDocument = {
      id: "one-failure.pdf",
      filename: "one-failure.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "", ""],
      pageImages: [image("p1"), image("p2"), image("p3")],
    };

    const { provider } = fakeVisionProvider([
      result("p1"),
      new Error("model overloaded"),
      result("p3"),
    ]);

    const enriched = await enrichWithVision(document, provider);

    assert.deepEqual(enriched.pageVisionAnalysis, [result("p1"), null, result("p3")]);
    assert.deepEqual(enriched.pageVisionErrors, [null, "model overloaded", null]);
  });

  await test("an empty/null page image is skipped, no fabricated call", async () => {
    const document: ParsedDocument = {
      id: "no-image.pdf",
      filename: "no-image.pdf",
      kind: "pdf",
      text: "real text page",
      pages: ["", "real text page"],
      pageImages: [null, null],
    };

    const { provider, calls } = fakeVisionProvider([]);

    const enriched = await enrichWithVision(document, provider);

    assert.equal(calls.length, 0);
    assert.deepEqual(enriched.pageVisionAnalysis, [null, null]);
    assert.deepEqual(enriched.pageVisionErrors, [null, null]);
  });

  await test("the original document object is not mutated", async () => {
    const document: ParsedDocument = {
      id: "immutable.pdf",
      filename: "immutable.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageImages: [image("p1")],
    };
    const originalSnapshot = JSON.parse(JSON.stringify(document));

    const { provider } = fakeVisionProvider([result("p1")]);

    await enrichWithVision(document, provider);

    assert.deepEqual(document, originalSnapshot);
    assert.equal((document as ParsedDocument).pageVisionAnalysis, undefined);
  });

  await test("existing pageImages[] are unchanged on the returned document", async () => {
    const p1 = image("p1");
    const p3 = image("p3");
    const document: ParsedDocument = {
      id: "preserve-images.pdf",
      filename: "preserve-images.pdf",
      kind: "pdf",
      text: "middle text",
      pages: ["", "middle text", ""],
      pageImages: [p1, null, p3],
    };

    const { provider } = fakeVisionProvider([result("p1"), result("p3")]);

    const enriched = await enrichWithVision(document, provider);

    assert.deepEqual(enriched.pageImages, [p1, null, p3]);
    assert.equal(enriched.pageImages, document.pageImages);
  });

  await test("existing OCR enrichment fields are carried through unchanged", async () => {
    const document: ParsedDocument = {
      id: "with-ocr.pdf",
      filename: "with-ocr.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "some pdf text"],
      pageImages: [image("p1"), null],
      pageOcrText: ["ocr text for page 1", null],
      pageTextSources: ["ocr", "pdf"],
      pageOcrErrors: [null, null],
    };

    const { provider } = fakeVisionProvider([result("p1")]);

    const enriched = await enrichWithVision(document, provider);

    assert.deepEqual(enriched.pageOcrText, ["ocr text for page 1", null]);
    assert.deepEqual(enriched.pageTextSources, ["ocr", "pdf"]);
    assert.deepEqual(enriched.pageOcrErrors, [null, null]);
  });

  await test("a custom prompt override is passed through to the provider", async () => {
    const document: ParsedDocument = {
      id: "custom-prompt.pdf",
      filename: "custom-prompt.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageImages: [image("p1")],
    };

    const { provider, calls } = fakeVisionProvider([result("p1")]);

    await enrichWithVision(document, provider, "a custom prompt");

    assert.equal(calls[0].prompt, "a custom prompt");
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
