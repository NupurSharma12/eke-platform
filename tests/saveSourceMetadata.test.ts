import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import { SourceMetadata } from "../packages/shared-types";
import {
  saveSourceMetadata,
  getSourceMetadataPath,
} from "../packages/knowledge-engine/ingestion/saveSourceMetadata";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

const SOURCE_DOCUMENT_ID = "__test-save-source-metadata__.pdf";

const metadata: SourceMetadata = {
  sourceDocumentId: SOURCE_DOCUMENT_ID,
  title: "Test Olympiad Book",
  documentType: "olympiad",
  contributions: ["depth-challenge", "question-pattern"],
};

async function main() {
  console.log("saveSourceMetadata");

  const expectedPath = getSourceMetadataPath(SOURCE_DOCUMENT_ID);

  try {
    await test("writes SourceMetadata to a deterministic path", async () => {
      const outputPath = await saveSourceMetadata(metadata);
      assert.equal(outputPath, expectedPath);

      const written = JSON.parse(await fs.readFile(outputPath, "utf-8"));
      assert.deepEqual(written, metadata);
    });

    await test("has deterministic identity: same sourceDocumentId always resolves to the same path", () => {
      assert.equal(
        getSourceMetadataPath(SOURCE_DOCUMENT_ID),
        getSourceMetadataPath(SOURCE_DOCUMENT_ID)
      );
    });

    await test("re-saving the same source overwrites in place rather than duplicating", async () => {
      const updated: SourceMetadata = { ...metadata, title: "Updated Title" };

      await saveSourceMetadata(metadata);
      await saveSourceMetadata(updated);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.title, "Updated Title");
    });
  } finally {
    await fs.rm(expectedPath, { force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
