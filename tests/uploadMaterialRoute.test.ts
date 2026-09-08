import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import { NextRequest } from "next/server";

import { POST } from "../app/api/eke/upload-material/route";
import { getUploadedDocumentPath } from "../packages/knowledge-engine/ingestion/uploadDocument";
import { getSourceMetadataPath } from "../packages/knowledge-engine/ingestion/saveSourceMetadata";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function postRequest(formData: FormData): NextRequest {
  return new NextRequest("http://localhost/api/eke/upload-material", {
    method: "POST",
    body: formData,
  });
}

function pdfFile(filename: string, content = "fake pdf bytes"): File {
  return new File([content], filename, { type: "application/pdf" });
}

async function main() {
  console.log("POST /api/eke/upload-material");

  const persistedSourceIds: string[] = [];

  async function cleanup() {
    for (const id of persistedSourceIds) {
      await fs.rm(getUploadedDocumentPath(id), { force: true });
      await fs.rm(getSourceMetadataPath(id), { force: true });
    }
    persistedSourceIds.length = 0;
  }

  try {
    await test("missing file returns a 400 validation error", async () => {
      const form = new FormData();
      form.set("documentType", "textbook");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /file is required/);
    });

    await test("an empty file returns a 400 validation error", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-empty.pdf", ""));
      form.set("documentType", "textbook");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /empty/);
    });

    await test("an unsupported file type returns a 400 validation error, before any registration happens", async () => {
      const form = new FormData();
      form.set(
        "file",
        new File(["not supported"], "__test-upload-route__-notes.txt", { type: "text/plain" })
      );
      form.set("documentType", "textbook");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /Unsupported file type/);

      const metadataExists = await fs
        .access(getSourceMetadataPath("__test-upload-route__-notes.txt"))
        .then(() => true)
        .catch(() => false);
      assert.equal(metadataExists, false);
    });

    await test("missing documentType returns a 400 validation error", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-no-type.pdf"));

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /documentType is required/);
    });

    await test("an invalid documentType returns a 400 validation error", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-bad-type.pdf"));
      form.set("documentType", "not-a-real-type");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /Unknown documentType/);
    });

    await test("a malformed gradeId returns a 400 validation error", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-bad-grade.pdf"));
      form.set("documentType", "textbook");
      form.set("gradeId", "not-a-number");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /gradeId/);
    });

    await test("a valid upload succeeds: persists the file, creates SourceMetadata, and returns sourceDocumentId", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-valid.pdf", "real enough content"));
      form.set("documentType", "worksheet");
      form.set("gradeId", "2");
      form.set("subjectId", "EVS");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 201);
      assert.equal(body.sourceDocumentId, "__test-upload-route__-valid.pdf");
      persistedSourceIds.push(body.sourceDocumentId);

      // File persisted with the actual uploaded bytes.
      const persistedContent = await fs.readFile(
        getUploadedDocumentPath(body.sourceDocumentId),
        "utf-8"
      );
      assert.equal(persistedContent, "real enough content");

      // SourceMetadata created with the caller-supplied contextual
      // fields, and contributions derived deterministically from
      // documentType (not chosen directly by the caller).
      assert.equal(body.sourceMetadata.sourceDocumentId, "__test-upload-route__-valid.pdf");
      assert.equal(body.sourceMetadata.documentType, "worksheet");
      assert.equal(body.sourceMetadata.grade, 2);
      assert.equal(body.sourceMetadata.subject, "EVS");
      assert.deepEqual(body.sourceMetadata.contributions, ["question-pattern"]);

      const savedMetadata = JSON.parse(
        await fs.readFile(getSourceMetadataPath(body.sourceDocumentId), "utf-8")
      );
      assert.deepEqual(savedMetadata, body.sourceMetadata);
    });

    await test("grade/subject are optional: a valid upload without them still succeeds", async () => {
      const form = new FormData();
      form.set("file", pdfFile("__test-upload-route__-no-context.pdf"));
      form.set("documentType", "textbook");

      const res = await POST(postRequest(form));
      const body = await res.json();

      assert.equal(res.status, 201);
      persistedSourceIds.push(body.sourceDocumentId);

      assert.equal(body.sourceMetadata.grade, undefined);
      assert.equal(body.sourceMetadata.subject, undefined);
    });
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
