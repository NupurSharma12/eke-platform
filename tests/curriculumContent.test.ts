import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Chapter, ChapterRegistry } from "../packages/shared-types";
import { getChapterRegistryPath } from "../packages/knowledge-engine/curriculum";
import {
  getAvailableGrades,
  getAvailableSubjects,
  getAvailableChapters,
} from "../lib/content/curriculum";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// Distinct from both loadChapterRegistry.test.ts's fixture grade
// (9999) and generatePracticePaperRoute.test.ts's fixture grade
// (9998), so all three fixture files can coexist safely.
const FIXTURE_GRADE = 9997;
const FIXTURE_SUBJECT = "__Test Subject Content Catalog__";

const fixtureChapters: Chapter[] = [
  {
    id: "fixture-confirmed",
    grade: FIXTURE_GRADE,
    subject: FIXTURE_SUBJECT,
    number: 1,
    name: "Fixture Chapter",
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
];

const registryPath = getChapterRegistryPath(FIXTURE_GRADE, FIXTURE_SUBJECT);

async function main() {
  console.log("lib/content/curriculum (content catalog discovery)");

  try {
    await test("getAvailableSubjects returns nothing for an unknown grade, rather than throwing", async () => {
      const subjects = await getAvailableSubjects(123456);
      assert.deepEqual(subjects, []);
    });

    await test("getAvailableChapters returns an empty list for an unknown (grade, subject), rather than throwing", async () => {
      const chapters = await getAvailableChapters(123456, "__Nonexistent Subject__");
      assert.deepEqual(chapters, []);
    });

    const registry: ChapterRegistry = {
      grade: FIXTURE_GRADE,
      subject: FIXTURE_SUBJECT,
      chapters: fixtureChapters,
      excluded: [],
    };
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");

    await test("getAvailableGrades includes a newly written fixture grade", async () => {
      const grades = await getAvailableGrades();
      assert.ok(grades.includes(FIXTURE_GRADE));
    });

    await test("getAvailableSubjects includes the fixture subject for the fixture grade", async () => {
      const subjects = await getAvailableSubjects(FIXTURE_GRADE);
      assert.deepEqual(subjects, [FIXTURE_SUBJECT]);
    });

    await test("getAvailableChapters returns every chapter for the fixture grade+subject, pending included", async () => {
      const chapters = await getAvailableChapters(FIXTURE_GRADE, FIXTURE_SUBJECT);
      assert.equal(chapters.length, 2);
      assert.deepEqual(
        chapters.map((c) => c.id).sort(),
        ["fixture-confirmed", "fixture-pending"]
      );
      const pending = chapters.find((c) => c.id === "fixture-pending");
      assert.equal(pending?.status, "pending");
    });

    await test("the real grade 5 Mathematics registry is discoverable through the same catalog", async () => {
      const grades = await getAvailableGrades();
      assert.ok(grades.includes(5));

      const subjects = await getAvailableSubjects(5);
      assert.ok(subjects.includes("Mathematics"));

      const chapters = await getAvailableChapters(5, "Mathematics");
      assert.ok(chapters.length > 0);
    });
  } finally {
    await fs.rm(registryPath, { force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
