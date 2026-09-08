import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  uploadDocument,
  getUploadedDocumentPath,
} from "../packages/knowledge-engine/ingestion/uploadDocument";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function main() {
  console.log("uploadDocument");

  // A scratch source directory distinct from data/ — this test must
  // not depend on, or pollute, the developer's existing data/
  // contents.
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "eke-upload-source-"));
  const persistedIds: string[] = [];

  async function cleanupPersisted() {
    for (const id of persistedIds) {
      await fs.rm(getUploadedDocumentPath(id), { force: true });
    }
    persistedIds.length = 0;
  }

  async function writeSourceFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(sourceDir, filename);
    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  }

  try {
    await test("a supported PDF is persisted and returns a deterministic sourceDocumentId", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-chapter.pdf",
        "fake pdf bytes"
      );
      const id = await uploadDocument(filePath);
      persistedIds.push(id);

      assert.equal(id, "__test-upload__-chapter.pdf");
      const persisted = await fs.readFile(getUploadedDocumentPath(id), "utf-8");
      assert.equal(persisted, "fake pdf bytes");
    });

    await test("a supported JPEG is persisted", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-photo.jpeg",
        "fake jpeg bytes"
      );
      const id = await uploadDocument(filePath);
      persistedIds.push(id);

      assert.equal(id, "__test-upload__-photo.jpeg");
      const persisted = await fs.readFile(getUploadedDocumentPath(id), "utf-8");
      assert.equal(persisted, "fake jpeg bytes");
    });

    await test("a supported PNG is persisted", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-photo.png",
        "fake png bytes"
      );
      const id = await uploadDocument(filePath);
      persistedIds.push(id);

      assert.equal(id, "__test-upload__-photo.png");
      const persisted = await fs.readFile(getUploadedDocumentPath(id), "utf-8");
      assert.equal(persisted, "fake png bytes");
    });

    await test("a missing file is rejected", async () => {
      await assert.rejects(
        () => uploadDocument(path.join(sourceDir, "__test-upload__-does-not-exist.pdf")),
        /No file found/
      );
    });

    await test("an unsupported extension is rejected, and nothing is persisted for it", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-notes.txt",
        "not a supported type"
      );

      await assert.rejects(
        () => uploadDocument(filePath),
        /Unsupported file type/
      );

      const exists = await fs
        .access(getUploadedDocumentPath("__test-upload__-notes.txt"))
        .then(() => true)
        .catch(() => false);
      assert.equal(exists, false);
    });

    await test("the destination directory is created if it doesn't already exist", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-dir-check.pdf",
        "content"
      );
      const id = await uploadDocument(filePath);
      persistedIds.push(id);

      const stats = await fs.stat(path.dirname(getUploadedDocumentPath(id)));
      assert.ok(stats.isDirectory());
    });

    await test("the original uploaded file is left untouched, not moved or modified", async () => {
      const filePath = await writeSourceFile(
        "__test-upload__-original.pdf",
        "original content"
      );
      const id = await uploadDocument(filePath);
      persistedIds.push(id);

      const originalStillThere = await fs.readFile(filePath, "utf-8");
      assert.equal(originalStillThere, "original content");
    });

    await test("re-uploading the same filename overwrites the previous copy at that id, deterministically", async () => {
      const filePath1 = await writeSourceFile(
        "__test-upload__-overwrite.pdf",
        "version 1"
      );
      const id1 = await uploadDocument(filePath1);
      persistedIds.push(id1);

      const filePath2 = await writeSourceFile(
        "__test-upload__-overwrite.pdf",
        "version 2"
      );
      const id2 = await uploadDocument(filePath2);

      assert.equal(id1, id2);
      const persisted = await fs.readFile(getUploadedDocumentPath(id2), "utf-8");
      assert.equal(persisted, "version 2");
    });
  } finally {
    await cleanupPersisted();
    await fs.rm(sourceDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
