import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";

import { POST } from "../app/api/eke/generate-practice-paper/route";
import { Chapter, ChapterRegistry, GeneratedQuestion } from "../packages/shared-types";
import { getChapterRegistryPath } from "../packages/knowledge-engine/curriculum";
import {
  saveGeneratedQuestion,
  getGeneratedQuestionPath,
} from "../packages/knowledge-engine/questionBank";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// A fixture grade/subject distinct from both real curriculum data and
// tests/loadChapterRegistry.test.ts's own fixture grade (9999), so the
// two test files can never collide if run in the same process/CI job.
const FIXTURE_GRADE = 9998;
const FIXTURE_SUBJECT = "__Test Subject Practice Paper__";

// A real sourceDocumentId and the exact set of real concepts it
// resolves to, taken from data/graphs/canonical.json —
// resolveChapterConcepts intersects a chapter's sourceDocumentIds
// against each concept's actual sourceDocuments, so a fixture chapter
// needs a real match to resolve to real, generatable concepts. In
// this graph, no single source document maps to exactly one concept
// (every document is shared), so this fixture's scope genuinely
// resolves to all three of these — every eligible concept must have
// a cached candidate seeded, or the route would attempt a real LLM
// call for whichever concept round-robin visits first.
const REAL_SOURCE_DOCUMENT_ID = "eemm102.pdf";
const REAL_ELIGIBLE_CONCEPT_IDS = ["comparing-fractions", "equivalent-fractions", "fractions"];

const confirmedChapter: Chapter = {
  id: "fixture-confirmed-chapter",
  grade: FIXTURE_GRADE,
  subject: FIXTURE_SUBJECT,
  number: 1,
  name: "Fixture Confirmed Chapter",
  sourceDocumentIds: [REAL_SOURCE_DOCUMENT_ID],
  status: "confirmed",
};

const pendingChapter: Chapter = {
  id: "fixture-pending-chapter",
  grade: FIXTURE_GRADE,
  subject: FIXTURE_SUBJECT,
  number: null,
  name: null,
  sourceDocumentIds: [REAL_SOURCE_DOCUMENT_ID],
  status: "pending",
};

const registryPath = getChapterRegistryPath(FIXTURE_GRADE, FIXTURE_SUBJECT);

async function writeRegistry(chapters: Chapter[]): Promise<void> {
  const registry: ChapterRegistry = {
    grade: FIXTURE_GRADE,
    subject: FIXTURE_SUBJECT,
    chapters,
    excluded: [],
  };
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");
}

async function removeRegistry(): Promise<void> {
  await fs.rm(registryPath, { force: true });
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/eke/generate-practice-paper", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Seeds a cached question so the route hits the offline question bank
// instead of ever reaching a real LLM provider — same approach as
// tests/generateQuestionRoute.test.ts.
async function seedCachedQuestion(conceptId: string, idSuffix: string): Promise<GeneratedQuestion> {
  const fixture: GeneratedQuestion = {
    id: `__test-practice-paper-route-cached__-${conceptId}-${idSuffix}`,
    conceptId,
    questionType: "mcq",
    difficulty: "grade",
    questionText: "cached question text",
    options: ["a", "b", "c", "d"],
    correctAnswer: "a",
    explanation: "cached explanation",
    sourcePatternIds: [],
    origin: "llm-inferred",
    generatedBy: "llm",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await saveGeneratedQuestion(fixture);
  return fixture;
}

async function main() {
  console.log("POST /api/eke/generate-practice-paper");

  const seededQuestionIds: string[] = [];

  async function cleanupQuestions() {
    for (const id of seededQuestionIds) {
      await fs.rm(getGeneratedQuestionPath(id), { force: true });
    }
    seededQuestionIds.length = 0;
  }

  try {
    await test("invalid request: missing gradeId is rejected with a 400 before any generation is attempted", async () => {
      const res = await POST(postRequest({ subjectId: FIXTURE_SUBJECT, chapterId: confirmedChapter.id }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /gradeId/);
    });

    await test("invalid request: missing subjectId is rejected with a 400", async () => {
      const res = await POST(postRequest({ gradeId: FIXTURE_GRADE, chapterId: confirmedChapter.id }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /subjectId/);
    });

    await test("invalid request: missing chapterId is rejected with a 400", async () => {
      const res = await POST(postRequest({ gradeId: FIXTURE_GRADE, subjectId: FIXTURE_SUBJECT }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /chapterId/);
    });

    await test("invalid request: unknown grade/subject (no registry on disk) is rejected with a 400, not a silent fallback", async () => {
      const res = await POST(
        postRequest({ gradeId: 123456, subjectId: "__Nonexistent Subject__", chapterId: "anything" })
      );
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /No curriculum found/);
    });

    await writeRegistry([confirmedChapter, pendingChapter]);

    await test("invalid request: unknown chapterId within a real registry is rejected with a 400", async () => {
      const res = await POST(
        postRequest({ gradeId: FIXTURE_GRADE, subjectId: FIXTURE_SUBJECT, chapterId: "does-not-exist" })
      );
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /Unknown chapterId/);
    });

    await test("pending chapter: PendingChapterSelectedError is surfaced as a distinct client error, not swallowed, and no generation is attempted", async () => {
      // Deliberately unset provider credentials: if this request ever
      // reached provider/generator construction it would fail with a
      // 502 (as tests/generateQuestionRoute.test.ts's own "control"
      // test proves for the sibling route), not the 409 asserted
      // below — so a 409 here structurally proves generation was
      // never attempted.
      const originalAiProvider = process.env.AI_PROVIDER;
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_PROVIDER;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const res = await POST(
          postRequest({ gradeId: FIXTURE_GRADE, subjectId: FIXTURE_SUBJECT, chapterId: pendingChapter.id })
        );
        const body = await res.json();

        assert.equal(res.status, 409);
        assert.deepEqual(body.pendingChapterIds, [pendingChapter.id]);
        assert.doesNotMatch(body.error.toLowerCase(), /anthropic|api key/);
      } finally {
        if (originalAiProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = originalAiProvider;
        if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      }
    });

    await test("valid request + generation shortfall: a confirmed chapter with cached questions returns a well-shaped, partially-filled PracticePaper (200, not an error)", async () => {
      const seeded = await Promise.all(
        REAL_ELIGIBLE_CONCEPT_IDS.map((conceptId) => seedCachedQuestion(conceptId, "only"))
      );
      seededQuestionIds.push(...seeded.map((q) => q.id));

      const res = await POST(
        postRequest({ gradeId: FIXTURE_GRADE, subjectId: FIXTURE_SUBJECT, chapterId: confirmedChapter.id })
      );
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.paper.allocations.length, 1);
      assert.equal(body.paper.allocations[0].questionType, "mcq");
      assert.equal(body.paper.allocations[0].difficulty, "grade");
      assert.equal(body.paper.allocations[0].requested, 5);

      // The MVP blueprint asks for 5, but this fixture's scope has 3
      // eligible concepts (see REAL_ELIGIBLE_CONCEPT_IDS) with exactly
      // 1 cached candidate each. Round-robin visits all 3 once
      // (slots 0-2, each a cache hit) then revisits the first two a
      // second time (slots 3-4) — whose sole cached candidate is now
      // excluded (already used), so those two slots deterministically
      // shortfall (QuestionPoolExhaustedError, no LLM call). Exactly
      // 3 of the requested 5 come back: real, expected
      // generatePracticePaper behavior (a visible per-allocation
      // shortfall), not a bug in this route, and proof the route
      // returns a partial paper as 200 rather than treating any
      // shortfall as a total failure.
      const returned: GeneratedQuestion[] = body.paper.allocations[0].questions;
      assert.equal(returned.length, 3);

      // "fractions" (unlike comparing-fractions/equivalent-fractions)
      // already has real, pre-existing cached questions in
      // data/questions/bank/ from before this test run — a known,
      // pre-existing environmental fact (see
      // tests/generateQuestion.test.ts's own last test for the same
      // caveat), not something this test seeded or controls. So the
      // fractions slot's exact returned id isn't asserted — only that
      // the other two concepts deterministically returned exactly the
      // ids this test seeded, and that a fractions-concept question
      // was returned at all.
      const returnedIds = returned.map((q) => q.id);
      const seededByConcept = new Map<string, string>(
        REAL_ELIGIBLE_CONCEPT_IDS.map((conceptId, i) => [conceptId, seeded[i].id])
      );
      assert.ok(returnedIds.includes(seededByConcept.get("comparing-fractions") ?? ""));
      assert.ok(returnedIds.includes(seededByConcept.get("equivalent-fractions") ?? ""));
      assert.ok(returned.some((q) => q.conceptId === "fractions"));

      await cleanupQuestions();
    });

    await test("multi-grade/subject: a request for a different (grade, subject) than the fixture is never silently served from it", async () => {
      // No registry exists for this grade/subject pair at all — if the
      // route ever fell back to *some* default dataset instead of the
      // exact requested grade/subject, this would not be a clean 400.
      const res = await POST(
        postRequest({ gradeId: FIXTURE_GRADE + 1, subjectId: FIXTURE_SUBJECT, chapterId: confirmedChapter.id })
      );
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /No curriculum found/);
    });
  } finally {
    await cleanupQuestions();
    await removeRegistry();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
