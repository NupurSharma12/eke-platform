import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ChapterRegistry } from "../packages/shared-types";
import {
  getChapterRegistryPath,
  loadChapterRegistry,
  loadConfirmedChapters,
} from "../packages/knowledge-engine/curriculum/loadChapterRegistry";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

const FIXTURE_GRADE = 9999;
const FIXTURE_SUBJECT = "__Test Subject__";

const fixtureRegistry: ChapterRegistry = {
  grade: FIXTURE_GRADE,
  subject: FIXTURE_SUBJECT,
  chapters: [
    {
      id: "fixture-confirmed",
      grade: FIXTURE_GRADE,
      subject: FIXTURE_SUBJECT,
      number: 1,
      name: "Confirmed Chapter",
      sourceDocumentIds: ["fixture-a.pdf"],
      status: "confirmed",
    },
    {
      id: "fixture-pending",
      grade: FIXTURE_GRADE,
      subject: FIXTURE_SUBJECT,
      number: null,
      name: null,
      sourceDocumentIds: ["fixture-b.pdf"],
      status: "pending",
    },
  ],
  excluded: [],
};

async function main() {
  console.log("loadChapterRegistry");

  const fixturePath = getChapterRegistryPath(FIXTURE_GRADE, FIXTURE_SUBJECT);

  try {
    await test("resolves a deterministic path per (grade, subject)", () => {
      assert.equal(
        getChapterRegistryPath(FIXTURE_GRADE, FIXTURE_SUBJECT),
        getChapterRegistryPath(FIXTURE_GRADE, FIXTURE_SUBJECT)
      );
    });

    await test("throws a clear error when no registry file exists for a grade/subject", async () => {
      await assert.rejects(
        () => loadChapterRegistry(FIXTURE_GRADE, FIXTURE_SUBJECT),
        /No chapter registry found/
      );
    });

    await fs.mkdir(path.dirname(fixturePath), { recursive: true });
    await fs.writeFile(fixturePath, JSON.stringify(fixtureRegistry, null, 2), "utf-8");

    await test("loads a registry's full chapter list, pending included", async () => {
      const registry = await loadChapterRegistry(FIXTURE_GRADE, FIXTURE_SUBJECT);
      assert.equal(registry.chapters.length, 2);
    });

    await test("loadConfirmedChapters excludes pending chapters", async () => {
      const confirmed = await loadConfirmedChapters(FIXTURE_GRADE, FIXTURE_SUBJECT);
      assert.equal(confirmed.length, 1);
      assert.equal(confirmed[0].id, "fixture-confirmed");
      assert.equal(confirmed[0].name, "Confirmed Chapter");
    });

    await test("the real Grade 5 Mathematics registry exists and is entirely pending", async () => {
      const registry = await loadChapterRegistry(5, "Mathematics");
      assert.equal(registry.grade, 5);
      assert.equal(registry.subject, "Mathematics");
      assert.ok(registry.chapters.length > 0);
      assert.ok(
        registry.chapters.every((chapter) => chapter.status === "pending"),
        "no chapter should be confirmed until a human reviewer has verified its name/number"
      );
      assert.ok(
        registry.chapters.every(
          (chapter) => chapter.number === null && chapter.name === null
        ),
        "no chapter should carry a guessed number or name while status is pending"
      );

      const confirmed = await loadConfirmedChapters(5, "Mathematics");
      assert.equal(
        confirmed.length,
        0,
        "the chapters API route must see zero chapters until curation confirms real ones"
      );
    });
  } finally {
    await fs.rm(fixturePath, { force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
