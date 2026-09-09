import assert from "node:assert/strict";

import { ParsedDocument } from "../packages/shared-types";
import { OcrProvider } from "../packages/ai/providers/OcrProvider";
import { ProviderImage } from "../packages/ai/providers/ImageCapableProvider";
import { enrichWithOcr } from "../packages/knowledge-engine/ingestion/enrichWithOcr";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/**
 * A deterministic fake OcrProvider: returns a canned result (or
 * throws a canned error) per call, keyed by call index, and records
 * every image it was called with so tests can assert exactly which
 * pages triggered OCR and in what order.
 */
function fakeOcrProvider(
  results: Array<string | Error>
): { provider: OcrProvider; calls: ProviderImage[] } {
  const calls: ProviderImage[] = [];
  let callIndex = 0;

  return {
    calls,
    provider: {
      async extractText(image: ProviderImage): Promise<string> {
        calls.push(image);
        const result = results[callIndex];
        callIndex += 1;
        if (result instanceof Error) {
          throw result;
        }
        return result;
      },
    },
  };
}

function image(tag: string): ProviderImage {
  return { base64: `base64-${tag}`, mediaType: "image/png" };
}

async function main() {
  console.log("enrichWithOcr");

  await test("a text-only document: no OCR calls, pageOcrText all null, pageTextSources all \"pdf\", no errors", async () => {
    const document: ParsedDocument = {
      id: "text-only.pdf",
      filename: "text-only.pdf",
      kind: "pdf",
      text: "First page\nSecond page",
      pages: ["First page", "Second page"],
    };

    const { provider, calls } = fakeOcrProvider([]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(calls.length, 0);
    assert.deepEqual(enriched.pageOcrText, [null, null]);
    assert.deepEqual(enriched.pageTextSources, ["pdf", "pdf"]);
    assert.deepEqual(enriched.pageOcrErrors, [null, null]);
  });

  await test("a fully scanned document: every page with an image is OCR'd, pages[] unchanged", async () => {
    const document: ParsedDocument = {
      id: "scanned.pdf",
      filename: "scanned.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "", ""],
      pageImages: [image("p1"), image("p2"), image("p3")],
    };

    const { provider, calls } = fakeOcrProvider([
      "Chapter 4 — Living and Non-living things",
      "Let's Practise",
      "Chapter 5 — Plants Around Us",
    ]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(calls.length, 3);
    assert.deepEqual(enriched.pageOcrText, [
      "Chapter 4 — Living and Non-living things",
      "Let's Practise",
      "Chapter 5 — Plants Around Us",
    ]);
    assert.deepEqual(enriched.pageTextSources, ["ocr", "ocr", "ocr"]);
    assert.deepEqual(enriched.pageOcrErrors, [null, null, null]);
    assert.deepEqual(enriched.pages, ["", "", ""]);
  });

  await test("a mixed document: text pages are not OCR'd, image-only pages are, at the correct indexes", async () => {
    const document: ParsedDocument = {
      id: "mixed.pdf",
      filename: "mixed.pdf",
      kind: "pdf",
      text: "Chapter 4 intro",
      pages: ["Chapter 4 intro", "", "", "Chapter 5 intro"],
      pageImages: [null, image("p2"), image("p3"), null],
    };

    const { provider, calls } = fakeOcrProvider(["Let's Practise page 2", "Let's Practise page 3"]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map((c) => c.base64),
      ["base64-p2", "base64-p3"]
    );

    assert.deepEqual(enriched.pageTextSources, ["pdf", "ocr", "ocr", "pdf"]);
    assert.deepEqual(enriched.pageOcrText, [null, "Let's Practise page 2", "Let's Practise page 3", null]);
    assert.deepEqual(enriched.pageOcrErrors, [null, null, null, null]);
  });

  await test("OCR failure on one page is captured, other pages still succeed, the call does not reject", async () => {
    const document: ParsedDocument = {
      id: "one-failure.pdf",
      filename: "one-failure.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "", ""],
      pageImages: [image("p1"), image("p2"), image("p3")],
    };

    const { provider } = fakeOcrProvider([
      "page one text",
      new Error("engine crashed"),
      "page three text",
    ]);

    const enriched = await enrichWithOcr(document, provider);

    assert.deepEqual(enriched.pageOcrText, ["page one text", null, "page three text"]);
    assert.deepEqual(enriched.pageTextSources, ["ocr", null, "ocr"]);
    assert.deepEqual(enriched.pageOcrErrors, [null, "engine crashed", null]);
  });

  await test("OCR failure on every page: the document is still returned, every page carries its own error", async () => {
    const document: ParsedDocument = {
      id: "all-failures.pdf",
      filename: "all-failures.pdf",
      kind: "pdf",
      text: "",
      pages: ["", ""],
      pageImages: [image("p1"), image("p2")],
    };

    const { provider } = fakeOcrProvider([new Error("timeout"), new Error("timeout")]);

    const enriched = await enrichWithOcr(document, provider);

    assert.deepEqual(enriched.pageOcrText, [null, null]);
    assert.deepEqual(enriched.pageTextSources, [null, null]);
    assert.deepEqual(enriched.pageOcrErrors, ["timeout", "timeout"]);
  });

  await test("a textless page with no image: OCR is not called, no fabricated result", async () => {
    const document: ParsedDocument = {
      id: "no-image.pdf",
      filename: "no-image.pdf",
      kind: "pdf",
      text: "",
      pages: ["", "real text page"],
      // pageImages omitted entirely, as parseDocument() would do if
      // getScreenshot somehow produced nothing for this page.
    };

    const { provider, calls } = fakeOcrProvider([]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(calls.length, 0);
    assert.deepEqual(enriched.pageOcrText, [null, null]);
    assert.deepEqual(enriched.pageTextSources, [null, "pdf"]);
    assert.deepEqual(enriched.pageOcrErrors, [null, null]);
  });

  await test("OCR returning only whitespace is not treated as usable", async () => {
    const document: ParsedDocument = {
      id: "blank-ocr.pdf",
      filename: "blank-ocr.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageImages: [image("p1")],
    };

    const { provider } = fakeOcrProvider(["   \n  "]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(enriched.pageOcrText![0], "   \n  ");
    assert.equal(enriched.pageTextSources![0], null);
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

    const { provider } = fakeOcrProvider(["ocr result"]);

    await enrichWithOcr(document, provider);

    assert.deepEqual(document, originalSnapshot);
    assert.equal((document as ParsedDocument).pageOcrText, undefined);
  });

  await test("pageImages[] is preserved exactly (same values, correct positions) on the returned document", async () => {
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

    const { provider } = fakeOcrProvider(["one", "three"]);

    const enriched = await enrichWithOcr(document, provider);

    assert.deepEqual(enriched.pageImages, [p1, null, p3]);
    assert.equal(enriched.pageImages, document.pageImages);
  });

  await test("id/filename/kind/text/pages are carried through unchanged", async () => {
    const document: ParsedDocument = {
      id: "identity.pdf",
      filename: "identity.pdf",
      kind: "pdf",
      text: "flattened text",
      pages: ["a", "b"],
    };

    const { provider } = fakeOcrProvider([]);

    const enriched = await enrichWithOcr(document, provider);

    assert.equal(enriched.id, "identity.pdf");
    assert.equal(enriched.filename, "identity.pdf");
    assert.equal(enriched.kind, "pdf");
    assert.equal(enriched.text, "flattened text");
    assert.deepEqual(enriched.pages, ["a", "b"]);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
