import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";

import { ConceptExtractor } from "../packages/ai";
import { ConceptExtractionResult } from "../packages/shared-types";
import { getRawExtractionPath } from "../packages/knowledge-engine/ingestion";
import { classifyDocument } from "../packages/knowledge-engine/classification";
import { canonicalizeConcepts } from "../packages/knowledge-engine/canonicalization";
import {
  parseArgs,
  processPdf,
  processImage,
  runBatch,
  runBatchForFiles,
  resolveInputDirectory,
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
      documentType: "textbook",
    });
    assert.deepEqual(parseArgs(["book.zip", "--force"]), {
      zipPath: "book.zip",
      force: true,
      documentType: "textbook",
    });
    assert.deepEqual(parseArgs(["--force", "book.zip"]), {
      zipPath: "book.zip",
      force: true,
      documentType: "textbook",
    });
  });

  await test("parseArgs accepts --document-type and defaults to textbook when omitted", () => {
    assert.deepEqual(parseArgs(["book.zip", "--document-type", "olympiad"]), {
      zipPath: "book.zip",
      force: false,
      documentType: "olympiad",
    });
    assert.deepEqual(
      parseArgs(["--document-type", "worksheet", "book.zip", "--force"]),
      {
        zipPath: "book.zip",
        force: true,
        documentType: "worksheet",
      }
    );
  });

  await test("parseArgs rejects an unknown --document-type value", () => {
    assert.throws(() => parseArgs(["book.zip", "--document-type", "not-a-real-type"]));
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

  const fixtureImagePath = path.join(
    tempDir,
    "__test-runBatchPipeline-fixture__.jpeg"
  );
  const imageCheckpointPath = getRawExtractionPath(
    `${path.basename(fixtureImagePath)}.json`
  );

  try {
    await fs.copyFile(
      path.resolve("data/ncert/eemm103.pdf"),
      fixturePdfPath
    );

    await fs.writeFile(
      fixtureImagePath,
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03])
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

    await test("processImage calls the extractor and writes a checkpoint when none exists", async () => {
      await fs.rm(imageCheckpointPath, { force: true });

      const extractor = createFakeExtractor(fakeExtraction("image-fresh"));
      const concepts = await processImage(fixtureImagePath, extractor, false);

      assert.equal(extractor.calls, 1);
      assert.equal(concepts[0].id, "concept-image-fresh");
      assert.ok(await fs.stat(imageCheckpointPath).then(() => true));
    });

    await test("processImage reuses an existing checkpoint and skips extraction", async () => {
      await fs.writeFile(
        imageCheckpointPath,
        JSON.stringify(fakeExtraction("image-cached")),
        "utf-8"
      );

      const extractor = createThrowingExtractor();
      const concepts = await processImage(fixtureImagePath, extractor, false);

      assert.equal(extractor.calls, 0);
      assert.equal(concepts[0].id, "concept-image-cached");
    });

    await test("processImage --force re-runs extraction even when a checkpoint exists", async () => {
      await fs.writeFile(
        imageCheckpointPath,
        JSON.stringify(fakeExtraction("image-stale")),
        "utf-8"
      );

      const extractor = createFakeExtractor(fakeExtraction("image-forced"));
      const concepts = await processImage(fixtureImagePath, extractor, true);

      assert.equal(extractor.calls, 1);
      assert.equal(concepts[0].id, "concept-image-forced");

      const onDisk: ConceptExtractionResult = JSON.parse(
        await fs.readFile(imageCheckpointPath, "utf-8")
      );
      assert.equal(onDisk.concepts[0].id, "concept-image-forced");
    });

    await test("runBatchForFiles processes a mixed PDF+image batch and isolates a failing file from the rest", async () => {
      await fs.writeFile(
        checkpointPath,
        JSON.stringify(fakeExtraction("mixed-pdf-ok")),
        "utf-8"
      );
      await fs.writeFile(
        imageCheckpointPath,
        JSON.stringify(fakeExtraction("mixed-image-ok")),
        "utf-8"
      );

      const missingImagePath = path.join(tempDir, "does-not-exist.png");
      const extractor = createThrowingExtractor();

      const { concepts, failures } = await runBatchForFiles(
        [
          { absolutePath: fixturePdfPath, kind: "pdf" },
          { absolutePath: fixtureImagePath, kind: "image" },
          { absolutePath: missingImagePath, kind: "image" },
        ],
        extractor,
        false
      );

      const conceptIds = concepts.map((c) => c.id).sort();
      assert.deepEqual(conceptIds, ["concept-mixed-image-ok", "concept-mixed-pdf-ok"]);

      assert.equal(failures.length, 1);
      assert.equal(failures[0].pdfPath, missingImagePath);
      assert.ok(failures[0].error.length > 0);
    });

    await test("runBatch (PDF-only) remains implemented in terms of runBatchForFiles with identical behavior", async () => {
      await fs.writeFile(
        checkpointPath,
        JSON.stringify(fakeExtraction("wrapper-check")),
        "utf-8"
      );

      const extractor = createThrowingExtractor();
      const { concepts, failures } = await runBatch([fixturePdfPath], extractor, false);

      assert.equal(concepts[0].id, "concept-wrapper-check");
      assert.equal(failures.length, 0);
    });

    await test("resolveInputDirectory extracts a zip file into the given temp directory", async () => {
      const zipSourceDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "eke-zip-src-")
      );
      const zipTempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "eke-zip-dest-")
      );

      try {
        await fs.writeFile(
          path.join(zipSourceDir, "page-001.jpeg"),
          Buffer.from([0xff, 0xd8, 0xff])
        );

        const zipPath = path.join(zipSourceDir, "olympiad.zip");
        const zip = new AdmZip();
        zip.addLocalFile(path.join(zipSourceDir, "page-001.jpeg"));
        zip.writeZip(zipPath);

        const resolved = await resolveInputDirectory(zipPath, zipTempDir);

        assert.equal(resolved, zipTempDir);
        assert.ok(
          await fs
            .stat(path.join(zipTempDir, "page-001.jpeg"))
            .then(() => true)
        );
      } finally {
        await fs.rm(zipSourceDir, { recursive: true, force: true });
        await fs.rm(zipTempDir, { recursive: true, force: true });
      }
    });

    await test("resolveInputDirectory uses a directory input directly, without extracting anything", async () => {
      const directInputDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "eke-direct-dir-")
      );
      const unusedTempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "eke-unused-temp-")
      );

      try {
        await fs.writeFile(
          path.join(directInputDir, "page-001.jpeg"),
          Buffer.from([0xff, 0xd8, 0xff])
        );

        const resolved = await resolveInputDirectory(directInputDir, unusedTempDir);

        assert.equal(resolved, directInputDir);
        // Nothing was extracted into the temp dir.
        assert.deepEqual(await fs.readdir(unusedTempDir), []);
      } finally {
        await fs.rm(directInputDir, { recursive: true, force: true });
        await fs.rm(unusedTempDir, { recursive: true, force: true });
      }
    });

    await test("an olympiad-classified image source still yields depth-challenge + question-pattern contributions (format-independence regression)", () => {
      const imageSourceDocumentId = "chapter-1-page-1.jpeg";
      const contributions = classifyDocument("olympiad");

      assert.deepEqual(contributions, ["depth-challenge", "question-pattern"]);

      const concept = {
        id: "some-llm-id",
        name: "Advanced Fraction Reasoning",
        aliases: [],
        domains: [],
        learningObjectives: [],
        bloomLevel: "understand" as const,
        difficulty: "grade" as const,
        explanation: "",
        realLifeExamples: [],
        stories: [],
        analogies: [],
        prerequisites: [],
        leadsTo: [],
        relatedConcepts: [],
        misconceptions: [],
        teaching: {
          primary: "activity" as const,
          activities: [],
          parentTips: [],
          visualIdeas: [],
        },
        questionTemplates: [
          {
            type: "reasoning" as const,
            description: "from a photographed olympiad page",
            bloomLevel: "analyze" as const,
            recommendedDifficulty: "olympiad" as const,
          },
        ],
        estimatedMinutes: 10,
        sourceDocuments: [imageSourceDocumentId],
        version: 1,
        keywords: [],
        metadata: {
          version: 1,
          sourceDocuments: [imageSourceDocumentId],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      };

      const sourceContributions = new Map([[imageSourceDocumentId, contributions]]);

      const result = canonicalizeConcepts([concept], undefined, sourceContributions);

      assert.equal(result.sources.length, 0, "olympiad is not core-knowledge, no ConceptSource");
      assert.equal(result.questionPatterns.length, 2);
      assert.deepEqual(
        result.questionPatterns.map((p) => p.contribution).sort(),
        ["depth-challenge", "question-pattern"]
      );
      assert.ok(result.questionPatterns.every((p) => p.sourceDocumentId === imageSourceDocumentId));
    });
  } finally {
    await fs.rm(checkpointPath, { force: true });
    await fs.rm(imageCheckpointPath, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
