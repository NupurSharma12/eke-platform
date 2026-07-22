import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ConceptExtractor } from "../packages/ai";
import { ConceptExtractionResult } from "../packages/shared-types";
import { getRawExtractionPath } from "../packages/knowledge-engine/ingestion";
import {
  parseArgs,
  processPdf,
  runBatch,
} from "../packages/runBatchPipeline";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeExtraction(marker: string): ConceptExtractionResult {
  return {
    concepts: [
      {
        id: `concept-${marker}`,
        name: marker,
        learningObjectives: [],
        explanation: "",
        prerequisites: [],
        misconceptions: [],
        teachingStrategies: [],
        activities: [],
        realLifeExamples: [],
        questionTemplates: [],
        keywords: [],
      },
    ],
    warnings: [],
    metadata: {
      documentId: "irrelevant-llm-generated-value",
      extractor: "fake",
      extractedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function createFakeExtractor(
  result: ConceptExtractionResult
): ConceptExtractor & { calls: number } {
  return {
    calls: 0,
    async extract() {
      this.calls += 1;
      return result;
    },
  };
}

function createThrowingExtractor(): ConceptExtractor & { calls: number } {
  return {
    calls: 0,
    async extract() {
      this.calls += 1;
      throw new Error("extractor should not have been called");
    },
  };
}

async function main() {
  console.log("runBatchPipeline");

  await test("parseArgs requires a zip path", () => {
    assert.throws(() => parseArgs([]));
    assert.throws(() => parseArgs(["--force"]));
  });

  await test("parseArgs accepts a zip path with or without --force, in either order", () => {
    assert.deepEqual(parseArgs(["book.zip"]), {
      zipPath: "book.zip",
      force: false,
    });
    assert.deepEqual(parseArgs(["book.zip", "--force"]), {
      zipPath: "book.zip",
      force: true,
    });
    assert.deepEqual(parseArgs(["--force", "book.zip"]), {
      zipPath: "book.zip",
      force: true,
    });
  });

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-batch-test-")
  );

  const fixturePdfPath = path.join(
    tempDir,
    "__test-runBatchPipeline-fixture__.pdf"
  );
  const checkpointPath = getRawExtractionPath(
    `${path.basename(fixturePdfPath)}.json`
  );

  try {
    await fs.copyFile(
      path.resolve("data/ncert/eemm103.pdf"),
      fixturePdfPath
    );

    await test("processPdf calls the extractor and writes a checkpoint when none exists", async () => {
      await fs.rm(checkpointPath, { force: true });

      const extractor = createFakeExtractor(fakeExtraction("fresh"));
      const concepts = await processPdf(fixturePdfPath, extractor, false);

      assert.equal(extractor.calls, 1);
      assert.equal(concepts[0].id, "concept-fresh");
      assert.ok(await fs.stat(checkpointPath).then(() => true));
    });

    await test("processPdf reuses an existing checkpoint and skips extraction", async () => {
      await fs.writeFile(
        checkpointPath,
        JSON.stringify(fakeExtraction("cached")),
        "utf-8"
      );

      const extractor = createThrowingExtractor();
      const concepts = await processPdf(fixturePdfPath, extractor, false);

      assert.equal(extractor.calls, 0);
      assert.equal(concepts[0].id, "concept-cached");
    });

    await test("--force re-runs extraction even when a checkpoint exists", async () => {
      await fs.writeFile(
        checkpointPath,
        JSON.stringify(fakeExtraction("stale")),
        "utf-8"
      );

      const extractor = createFakeExtractor(fakeExtraction("forced"));
      const concepts = await processPdf(fixturePdfPath, extractor, true);

      assert.equal(extractor.calls, 1);
      assert.equal(concepts[0].id, "concept-forced");

      const onDisk: ConceptExtractionResult = JSON.parse(
        await fs.readFile(checkpointPath, "utf-8")
      );
      assert.equal(onDisk.concepts[0].id, "concept-forced");
    });

    await test("runBatch continues past a failing PDF and reports it", async () => {
      await fs.writeFile(
        checkpointPath,
        JSON.stringify(fakeExtraction("batch-ok")),
        "utf-8"
      );

      const missingPdfPath = path.join(tempDir, "does-not-exist.pdf");
      const extractor = createThrowingExtractor();

      const { concepts, failures } = await runBatch(
        [fixturePdfPath, missingPdfPath],
        extractor,
        false
      );

      assert.equal(concepts.length, 1);
      assert.equal(concepts[0].id, "concept-batch-ok");

      assert.equal(failures.length, 1);
      assert.equal(failures[0].pdfPath, missingPdfPath);
      assert.ok(failures[0].error.length > 0);
    });
  } finally {
    await fs.rm(checkpointPath, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
