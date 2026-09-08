import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { DocumentStructureCandidate } from "../packages/shared-types";
import {
  saveDocumentStructureCandidate,
  getDocumentStructureCandidatePath,
} from "../packages/knowledge-engine/ingestion/saveDocumentStructureCandidate";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

const SOURCE_DOCUMENT_ID = "__test-save-structure-candidate__.pdf";

const candidate: DocumentStructureCandidate = {
  sourceDocumentId: SOURCE_DOCUMENT_ID,
  ranges: [
    {
      kind: "content",
      startPage: 1,
      endPage: 2,
      chapterTitle: "Angles as Turns",
      chapterNumber: 3,
      evidence: "Page 1 heading reads \"Chapter 3 — Angles as Turns\"",
    },
    {
      kind: "exercise",
      startPage: 3,
      endPage: 3,
      evidence: "Page 3 begins with \"Let Us Do\" followed by numbered questions",
    },
  ],
  status: "pending",
  extractedAt: "2026-01-01T00:00:00.000Z",
};

async function main() {
  console.log("saveDocumentStructureCandidate");

  const expectedPath = getDocumentStructureCandidatePath(SOURCE_DOCUMENT_ID);

  try {
    await test("has a deterministic path: same sourceDocumentId always resolves to the same path", () => {
      assert.equal(
        getDocumentStructureCandidatePath(SOURCE_DOCUMENT_ID),
        getDocumentStructureCandidatePath(SOURCE_DOCUMENT_ID)
      );
    });

    await test("writes the candidate to the deterministic path", async () => {
      const outputPath = await saveDocumentStructureCandidate(candidate);
      assert.equal(outputPath, expectedPath);
    });

    await test("the written file round-trips to the exact same candidate", async () => {
      await saveDocumentStructureCandidate(candidate);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.deepEqual(written, candidate);
    });

    await test("status: \"pending\" is preserved exactly through the round-trip", async () => {
      await saveDocumentStructureCandidate(candidate);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.status, "pending");
    });

    await test("sourceDocumentId is preserved exactly through the round-trip", async () => {
      await saveDocumentStructureCandidate(candidate);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.sourceDocumentId, SOURCE_DOCUMENT_ID);
    });

    await test("extractedAt is preserved exactly, not re-stamped by the persistence function", async () => {
      await saveDocumentStructureCandidate(candidate);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.extractedAt, "2026-01-01T00:00:00.000Z");
    });

    await test("re-saving the same sourceDocumentId overwrites in place rather than duplicating", async () => {
      await saveDocumentStructureCandidate(candidate);

      const updated: DocumentStructureCandidate = {
        ...candidate,
        ranges: [
          { kind: "exercise", startPage: 1, endPage: 1, evidence: "updated evidence" },
        ],
      };
      await saveDocumentStructureCandidate(updated);

      const written = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      assert.equal(written.ranges.length, 1);
      assert.equal(written.ranges[0].evidence, "updated evidence");
    });

    await test("the candidate is stored under a directory separate from data/curriculum (ChapterRegistry)", () => {
      assert.ok(!expectedPath.includes(`${path.sep}curriculum${path.sep}`));
      assert.match(expectedPath, /structure-candidates/);
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
