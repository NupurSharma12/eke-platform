import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { KnowledgeGraph } from "../packages/shared-types";
import { saveKnowledgeGraph } from "../packages/knowledge-engine/graph/saveKnowledgeGraph";

let passed = 0;

function test(name: string, fn: () => Promise<void> | void) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`  ok - ${name}`);
  })();
}

const TEST_FILENAME = "__test-save-knowledge-graph__.json";
const TEST_PATH = path.resolve("data/graphs", TEST_FILENAME);

const sampleGraph: KnowledgeGraph = {
  concepts: [],
  relationships: [
    { from: "a", to: "b", type: "prerequisite" },
  ],
};

async function main() {
  console.log("saveKnowledgeGraph");

  try {
    await test("writes the graph as formatted JSON to data/graphs/<filename>", async () => {
      const outputPath = await saveKnowledgeGraph(sampleGraph, TEST_FILENAME);

      assert.equal(outputPath, TEST_PATH);

      const written = await fs.readFile(outputPath, "utf-8");
      assert.deepEqual(JSON.parse(written), sampleGraph);

      // formatted (indented), not minified
      assert.ok(written.includes("\n  "));
    });

    await test("overwrites deterministically on repeated writes", async () => {
      await saveKnowledgeGraph(sampleGraph, TEST_FILENAME);
      const first = await fs.readFile(TEST_PATH, "utf-8");

      await saveKnowledgeGraph(sampleGraph, TEST_FILENAME);
      const second = await fs.readFile(TEST_PATH, "utf-8");

      assert.equal(first, second);
    });
  } finally {
    await fs.rm(TEST_PATH, { force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
