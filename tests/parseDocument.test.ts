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
 * Builds the smallest valid multi-page PDF (uncompressed, no
 * external fonts/images) needed to exercise real per-page text
 * extraction deterministically, without depending on any
 * developer-local file — data/ncert/eemm103.pdf exists locally but
 * is gitignored (the whole data/ directory is), so it is not
 * something this test suite can rely on being present in every
 * environment/CI. Each page gets its own distinct, known text so a
 * test can assert exactly which page a given string ended up on.
 */
function buildMinimalPdf(pageTexts: string[]): Buffer {
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
    const stream = `BT /F1 18 Tf 20 250 Td (${text}) Tj ET`;
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
  console.log("parseDocument (PDF page-boundary preservation)");

  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "eke-parse-document-test-"));

  try {
    await test("a multi-page PDF produces one ParsedDocument.pages entry per actual page", async () => {
      const pdfPath = path.join(rootDir, "multi-page.pdf");
      await fs.writeFile(
        pdfPath,
        buildMinimalPdf(["First page content", "Second page content", "Third page content"])
      );

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.pages.length, 3);
    });

    await test("each page contains its own corresponding text, in page order, not concatenated together", async () => {
      const pdfPath = path.join(rootDir, "page-content.pdf");
      await fs.writeFile(
        pdfPath,
        buildMinimalPdf(["Alpha page marker", "Bravo page marker", "Charlie page marker"])
      );

      const doc = await parseDocument(pdfPath);

      assert.match(doc.pages[0], /Alpha page marker/);
      assert.match(doc.pages[1], /Bravo page marker/);
      assert.match(doc.pages[2], /Charlie page marker/);
      // Not smeared across pages — page 0 doesn't also contain page 2's text.
      assert.doesNotMatch(doc.pages[0], /Charlie page marker/);
    });

    await test("page order matches the PDF's actual page order (num-based, not array-position-trusted)", async () => {
      const pdfPath = path.join(rootDir, "ordered.pdf");
      await fs.writeFile(
        pdfPath,
        buildMinimalPdf(["Page one text", "Page two text", "Page three text", "Page four text"])
      );

      const doc = await parseDocument(pdfPath);

      assert.deepEqual(doc.pages.map((p) => p.trim()), [
        "Page one text",
        "Page two text",
        "Page three text",
        "Page four text",
      ]);
    });

    await test("ParsedDocument.text remains the parser's full flattened text, unaffected by the pages fix", async () => {
      const pdfPath = path.join(rootDir, "text-field.pdf");
      await fs.writeFile(pdfPath, buildMinimalPdf(["Only page content"]));

      const doc = await parseDocument(pdfPath);

      assert.ok(doc.text.includes("Only page content"));
      assert.equal(typeof doc.text, "string");
    });

    await test("a single-page PDF still works: pages has exactly one entry with that page's text", async () => {
      const pdfPath = path.join(rootDir, "single-page.pdf");
      await fs.writeFile(pdfPath, buildMinimalPdf(["The only page"]));

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.pages.length, 1);
      assert.match(doc.pages[0], /The only page/);
    });

    await test("id/filename/kind are unchanged: still the file's own basename and \"pdf\"", async () => {
      const pdfPath = path.join(rootDir, "identity-check.pdf");
      await fs.writeFile(pdfPath, buildMinimalPdf(["content"]));

      const doc = await parseDocument(pdfPath);

      assert.equal(doc.id, "identity-check.pdf");
      assert.equal(doc.filename, "identity-check.pdf");
      assert.equal(doc.kind, "pdf");
    });

    await test("parsing the same PDF twice is deterministic", async () => {
      const pdfPath = path.join(rootDir, "deterministic.pdf");
      await fs.writeFile(pdfPath, buildMinimalPdf(["First", "Second"]));

      const first = await parseDocument(pdfPath);
      const second = await parseDocument(pdfPath);

      assert.deepEqual(first, second);
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
