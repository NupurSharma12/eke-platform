import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";

import { POST } from "../app/api/eke/analyze-material/route";
import { ClaudeProvider } from "../packages/ai/providers/ClaudeProvider";
import { uploadDocument, getUploadedDocumentPath } from "../packages/knowledge-engine/ingestion/uploadDocument";
import { getDocumentStructureCandidatePath } from "../packages/knowledge-engine/ingestion/saveDocumentStructureCandidate";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/eke/analyze-material", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The smallest valid multi-page PDF, built the same way
 * tests/parseDocument.test.ts already does — no dependency on any
 * developer-local file, real enough for parseDocument()'s actual
 * pdf-parse call to succeed and report a real page count.
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
  console.log("POST /api/eke/analyze-material");

  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "eke-analyze-route-test-"));
  const uploadedIds: string[] = [];

  async function cleanup() {
    for (const id of uploadedIds) {
      await fs.rm(getUploadedDocumentPath(id), { force: true });
      await fs.rm(getDocumentStructureCandidatePath(id), { force: true });
    }
    uploadedIds.length = 0;
    await fs.rm(sourceDir, { recursive: true, force: true });
  }

  // ClaudeProvider.generate is a real prototype method that makes a
  // real network call — routes hardcode their own concrete provider
  // instance (no injection point, same as every other EKE route), so
  // the only way to exercise the real route without a real LLM call
  // is to substitute this one method for the duration of a test, the
  // same way `fakeProvider()` substitutes AIProvider.generate at the
  // unit level elsewhere in this suite. Always restored in `finally`.
  const originalGenerate = ClaudeProvider.prototype.generate;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalAiProvider = process.env.AI_PROVIDER;

  function fakeClaudeResponse(rawResponse: string) {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.AI_PROVIDER;
    ClaudeProvider.prototype.generate = async function () {
      return rawResponse;
    };
  }

  function restoreProvider() {
    ClaudeProvider.prototype.generate = originalGenerate;
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
    if (originalAiProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalAiProvider;
  }

  try {
    await test("missing sourceDocumentId returns a 400 validation error", async () => {
      const res = await POST(postRequest({}));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /sourceDocumentId is required/);
    });

    await test("a non-string sourceDocumentId returns a 400 validation error", async () => {
      const res = await POST(postRequest({ sourceDocumentId: 123 }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /sourceDocumentId is required/);
    });

    await test("an empty/whitespace sourceDocumentId returns a 400 validation error", async () => {
      const res = await POST(postRequest({ sourceDocumentId: "   " }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /sourceDocumentId is required/);
    });

    await test("an unknown/missing uploaded document returns a 404, without leaking a filesystem path", async () => {
      const res = await POST(postRequest({ sourceDocumentId: "__no-such-upload__.pdf" }));
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.doesNotMatch(body.error, /\/data\/uploads/);
    });

    await test("a parse failure (corrupt/non-PDF bytes) returns a 502, no LLM call is made", async () => {
      const filePath = path.join(sourceDir, "__test-analyze-route__-corrupt.pdf");
      await fs.writeFile(filePath, "this is not a real pdf file at all");
      const id = await uploadDocument(filePath);
      uploadedIds.push(id);

      // Deliberately no fakeClaudeResponse() call here — if parsing
      // genuinely fails before the extractor is ever reached, no
      // provider is even constructed, so ANTHROPIC_API_KEY being
      // unset would surface as a *different* error if this ever got
      // that far. A clean 502 here is evidence parsing failed first.
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_PROVIDER;

      const res = await POST(postRequest({ sourceDocumentId: id }));
      const body = await res.json();

      assert.equal(res.status, 502);
      assert.equal(body.error, "Failed to analyze the uploaded document");

      const candidateExists = await fs
        .access(getDocumentStructureCandidatePath(id))
        .then(() => true)
        .catch(() => false);
      assert.equal(candidateExists, false);
    });

    await test("an extraction failure (malformed LLM output) returns a 502, and nothing is persisted", async () => {
      const filePath = path.join(sourceDir, "__test-analyze-route__-malformed-llm.pdf");
      await fs.writeFile(filePath, buildMinimalPdf(["Some real page content"]));
      const id = await uploadDocument(filePath);
      uploadedIds.push(id);

      fakeClaudeResponse(JSON.stringify({ ranges: [] })); // schema requires >= 1 range

      const res = await POST(postRequest({ sourceDocumentId: id }));
      const body = await res.json();

      assert.equal(res.status, 502);
      assert.equal(body.error, "Failed to analyze the uploaded document");

      const candidateExists = await fs
        .access(getDocumentStructureCandidatePath(id))
        .then(() => true)
        .catch(() => false);
      assert.equal(candidateExists, false);
    });

    await test("a valid uploaded document is parsed, analyzed, persisted, and returned as-is (200)", async () => {
      const filePath = path.join(sourceDir, "__test-analyze-route__-valid.pdf");
      await fs.writeFile(
        filePath,
        buildMinimalPdf(["Chapter 1 intro content", "More content", "Let Us Do exercise text"])
      );
      const id = await uploadDocument(filePath);
      uploadedIds.push(id);

      fakeClaudeResponse(
        JSON.stringify({
          ranges: [
            {
              kind: "content",
              startPage: 1,
              endPage: 2,
              chapterTitle: "Sample Chapter",
              chapterNumber: 1,
              evidence: "Page 1 reads \"Chapter 1 intro content\"",
            },
            {
              kind: "exercise",
              startPage: 3,
              endPage: 3,
              evidence: "Page 3 begins with \"Let Us Do\"",
            },
          ],
        })
      );

      const res = await POST(postRequest({ sourceDocumentId: id }));
      const body = await res.json();

      assert.equal(res.status, 200);

      const candidate = body.candidate;
      assert.equal(candidate.sourceDocumentId, id);
      assert.equal(candidate.status, "pending");
      assert.equal(candidate.ranges.length, 2);
      assert.equal(candidate.ranges[0].chapterTitle, "Sample Chapter");
      assert.equal(candidate.ranges[1].kind, "exercise");

      // Persisted candidate matches the response exactly — the route
      // does not reconstruct or simplify it.
      const persisted = JSON.parse(
        await fs.readFile(getDocumentStructureCandidatePath(id), "utf-8")
      );
      assert.deepEqual(persisted, candidate);
    });
  } finally {
    restoreProvider();
    await cleanup();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
