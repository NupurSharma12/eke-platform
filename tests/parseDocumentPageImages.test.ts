import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseDocument } from "../packages/knowledge-engine/ingestion/parseDocument";

let passed = 0;

async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/**
 * Same minimal-PDF builder as parseDocument.test.ts, extended to
 * accept `null` for a page's text — a `null` entry gets an empty
 * content stream (no text-drawing operator at all), so
 * pdf-parse's getText() genuinely returns "" for that page,
 * exactly the `page.text.trim().length === 0` condition this
 * milestone treats as image-only. No embedded image is needed to
 * exercise this: rendering (getScreenshot) still succeeds against a
 * blank/textless page, which is all these tests need to verify —
 * that the pipeline reaches for an image, not what the image
 * contains.
 */
function buildMixedPdf(pageTexts: Array<string | null>): Buffer {
  const numPages = pageTexts.length;
  const pageObjNums = pageTexts.map((_, i) => 3 + i);
  const contentObjNums = pageTexts.map((_, i) => 3 + numPages + i);
  const fontObjNum = 3 + numPages * 2;
  const totalObjs = 2 + numPages * 2 + 1;

  const objects: string[] = [];

  objects[0] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums
    .map((n) => `${n} 0 R`)
    .join(" ")}] /Count ${numPages} >>\nendobj\n`;

  pageTexts.forEach((_, i) => {
    objects[2 + i] =
      `${pageObjNums[i]} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> ` +
      `/MediaBox [0 0 300 300] /Contents ${contentObjNums[i]} 0 R >>\nendobj\n`;
  });

  pageTexts.forEach((text, i) => {
    const stream = text === null ? "" : `BT /F1 18 Tf 20 250 Td (${text}) Tj ET`;
    objects[2 + numPages + i] =
      `${contentObjNums[i]} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  });

  objects[2 + numPages * 2] =
    `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  let body = `%PDF-1.4\n`;
  const offsets: number[] = [];
  for (let i = 0; i < totalObjs; i++) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += objects[i];
  }

  const xrefOffset = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body + xref + trailer, "latin1");
}

async function main() {
  console.log("parseDocument (image-only / mixed PDF page evidence)");

  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "eke-parse-document-images-test-"));

  try {
    await test("a text-only PDF gets no pageImages at all (existing behavior preserved)", async () => {
      const pdfPath = path.join(rootDir, "text-only.pdf");
      await fs.writeFile(pdfPath, buildMixedPdf(["First page", "Second page", "Third page"]));

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.pages.length, 3);
      assert.equal(doc.pageImages, undefined);
    });

    await test("an image-only PDF (every page textless) gets an image for every page", async () => {
      const pdfPath = path.join(rootDir, "image-only.pdf");
      await fs.writeFile(pdfPath, buildMixedPdf([null, null, null]));

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.pages.length, 3);
      assert.ok(doc.pages.every((text) => text.trim().length === 0));
      assert.ok(doc.pageImages, "pageImages should be present");
      assert.equal(doc.pageImages!.length, 3);
      for (const image of doc.pageImages!) {
        assert.ok(image, "every page should have an image in an image-only PDF");
        assert.equal(image!.mediaType, "image/png");
        assert.ok(image!.base64.length > 0);
      }
    });

    await test("a mixed PDF: text pages get no image, textless pages do, in the correct positions", async () => {
      const pdfPath = path.join(rootDir, "mixed.pdf");
      await fs.writeFile(
        pdfPath,
        buildMixedPdf(["Chapter 4 intro", null, null, "Chapter 5 intro"])
      );

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.pages.length, 4);
      assert.match(doc.pages[0], /Chapter 4 intro/);
      assert.equal(doc.pages[1].trim(), "");
      assert.equal(doc.pages[2].trim(), "");
      assert.match(doc.pages[3], /Chapter 5 intro/);

      assert.ok(doc.pageImages, "pageImages should be present for a mixed document");
      const images = doc.pageImages!;
      assert.equal(images.length, 4);

      // Ordering: pageImages[i] corresponds to pages[i] (1-indexed
      // PAGE i+1) — text pages (index 0, 3) get no image, textless
      // pages (index 1, 2) do.
      assert.equal(images[0], null);
      assert.ok(images[1], "PAGE 2 (textless) should have an image");
      assert.ok(images[2], "PAGE 3 (textless) should have an image");
      assert.equal(images[3], null);
    });

    await test("only textless pages are rendered — a page with any real text is never rasterized", async () => {
      const pdfPath = path.join(rootDir, "sparse-mixed.pdf");
      await fs.writeFile(
        pdfPath,
        buildMixedPdf(["Has text", null, "Also has text", "Has text too", null])
      );

      const doc = await parseDocument(pdfPath);

      const textlessIndexes = doc.pages
        .map((text, i) => (text.trim().length === 0 ? i : null))
        .filter((i): i is number => i !== null);

      assert.deepEqual(textlessIndexes, [1, 4]);
      assert.ok(doc.pageImages);
      doc.pages.forEach((text, i) => {
        if (text.trim().length === 0) {
          assert.ok(doc.pageImages![i], `page ${i + 1} is textless and should have an image`);
        } else {
          assert.equal(doc.pageImages![i], null, `page ${i + 1} has text and should not have an image`);
        }
      });
    });

    await test("existing text extraction is unaffected: text content, page count, id/filename/kind still correct", async () => {
      const pdfPath = path.join(rootDir, "regression.pdf");
      await fs.writeFile(pdfPath, buildMixedPdf(["Alpha", "Bravo", "Charlie"]));

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.id, "regression.pdf");
      assert.equal(doc.filename, "regression.pdf");
      assert.equal(doc.kind, "pdf");
      assert.match(doc.pages[0], /Alpha/);
      assert.match(doc.pages[1], /Bravo/);
      assert.match(doc.pages[2], /Charlie/);
      assert.ok(doc.text.includes("Alpha"));
    });
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
