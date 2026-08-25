import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";

import { POST } from "../app/api/eke/generate-question/route";
import { POST as recordAttemptPOST } from "../app/api/eke/record-attempt/route";
import { GeneratedQuestion } from "../packages/shared-types";
import {
  saveGeneratedQuestion,
  getGeneratedQuestionPath,
} from "../packages/knowledge-engine/questionBank";
import {
  findAttemptedQuestionIds,
  getStudentAttemptsPath,
} from "../packages/knowledge-engine/studentAttempts";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// Same real concept the rest of the question-generation tests use —
// generateQuestion() reads the actual canonical graph by design.
const REAL_CONCEPT_ID = "fractions";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/eke/generate-question", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("POST /api/eke/generate-question (questionType contract)");

  const generatedIds: string[] = [];

  async function cleanupGenerated() {
    for (const id of generatedIds) {
      await fs.rm(getGeneratedQuestionPath(id), { force: true });
    }
    generatedIds.length = 0;
  }

  // Seeds a cached question so the route hits the offline question
  // bank instead of ever reaching the real LLM provider — the same
  // approach tests/generateQuestion.test.ts uses to keep these tests
  // fast, deterministic, and free of live network calls.
  async function seedCachedQuestion(overrides: {
    difficulty: GeneratedQuestion["difficulty"];
    questionType: GeneratedQuestion["questionType"];
    visualSpec?: GeneratedQuestion["visualSpec"];
    /** Distinguishes two fixtures seeded with the same difficulty/questionType. */
    idSuffix?: string;
  }): Promise<GeneratedQuestion> {
    const fixture: GeneratedQuestion = {
      id: `__test-route-cached__-${overrides.difficulty}-${overrides.questionType}${overrides.idSuffix ? `-${overrides.idSuffix}` : ""}`,
      conceptId: REAL_CONCEPT_ID,
      questionType: overrides.questionType,
      difficulty: overrides.difficulty,
      questionText: "cached question text",
      correctAnswer: "cached answer",
      explanation: "cached explanation",
      visualSpec: overrides.visualSpec,
      sourcePatternIds: [],
      origin: "llm-inferred",
      generatedBy: "llm",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await saveGeneratedQuestion(fixture);
    generatedIds.push(fixture.id);
    return fixture;
  }

  const testStudentIds: string[] = [];

  async function cleanupStudents() {
    for (const studentId of testStudentIds) {
      await fs.rm(path.dirname(getStudentAttemptsPath(studentId)), {
        recursive: true,
        force: true,
      });
    }
    testStudentIds.length = 0;
  }

  function recordAttemptRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/eke/record-attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  try {
    await test("omitted questionType defaults to mcq", async () => {
      const cached = await seedCachedQuestion({
        difficulty: "grade",
        questionType: "mcq",
      });

      const res = await POST(
        postRequest({ conceptId: REAL_CONCEPT_ID, difficulty: "grade" })
      );
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.question.id, cached.id);
      assert.equal(body.question.questionType, "mcq");
    });

    await test("questionType: mcq generates/returns an MCQ", async () => {
      const cached = await seedCachedQuestion({
        difficulty: "foundation",
        questionType: "mcq",
      });

      const res = await POST(
        postRequest({
          conceptId: REAL_CONCEPT_ID,
          difficulty: "foundation",
          questionType: "mcq",
        })
      );
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.question.id, cached.id);
      assert.equal(body.question.questionType, "mcq");
    });

    await test("an unsupported questionType is rejected with a clear 400, not silently coerced to mcq", async () => {
      const res = await POST(
        postRequest({
          conceptId: REAL_CONCEPT_ID,
          questionType: "essay",
        })
      );
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /questionType/);
      assert.match(body.error, /essay/);
    });

    await test("existing visual-question behavior is unaffected: questionType: visual is honored, not overridden to mcq", async () => {
      const cached = await seedCachedQuestion({
        difficulty: "advanced",
        questionType: "visual",
        visualSpec: { type: "fraction-bar", totalParts: 4, shadedParts: 3 },
      });

      const res = await POST(
        postRequest({
          conceptId: REAL_CONCEPT_ID,
          difficulty: "advanced",
          questionType: "visual",
        })
      );
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.question.id, cached.id);
      assert.equal(body.question.questionType, "visual");
      assert.deepEqual(body.question.visualSpec, cached.visualSpec);
    });

    await test("AI_PROVIDER=groq: a request succeeds even with ANTHROPIC_API_KEY unset, proving the route never constructs ClaudeProvider on the groq path", async () => {
      const cached = await seedCachedQuestion({
        difficulty: "olympiad",
        questionType: "reasoning",
      });

      const originalAiProvider = process.env.AI_PROVIDER;
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      process.env.AI_PROVIDER = "groq";
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const res = await POST(
          postRequest({
            conceptId: REAL_CONCEPT_ID,
            difficulty: "olympiad",
            questionType: "reasoning",
          })
        );
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.question.id, cached.id);
      } finally {
        if (originalAiProvider === undefined) {
          delete process.env.AI_PROVIDER;
        } else {
          process.env.AI_PROVIDER = originalAiProvider;
        }
        if (originalAnthropicKey === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
        }
      }
    });

    await test("control: with AI_PROVIDER not set to groq and ANTHROPIC_API_KEY unset, the same kind of cache-hit request fails clearly on Claude construction — proving the groq test above genuinely exercises the Claude-vs-Groq branch, not some other bypass", async () => {
      const cached = await seedCachedQuestion({
        difficulty: "olympiad",
        questionType: "word-problem",
      });

      const originalAiProvider = process.env.AI_PROVIDER;
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_PROVIDER;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const res = await POST(
          postRequest({
            conceptId: REAL_CONCEPT_ID,
            difficulty: "olympiad",
            questionType: "word-problem",
          })
        );
        const body = await res.json();

        assert.equal(res.status, 502);
        assert.match(body.error, /ANTHROPIC_API_KEY/);
        assert.notEqual(body.question?.id, cached.id);
      } finally {
        if (originalAiProvider === undefined) {
          delete process.env.AI_PROVIDER;
        } else {
          process.env.AI_PROVIDER = originalAiProvider;
        }
        if (originalAnthropicKey === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
        }
      }
    });

    await test("attempt-history end-to-end: generating alone doesn't record an attempt, Submit does, Next Question skips the submitted question, and exhausting the pool returns a clear 409", async () => {
      const studentId = "__test-route-attempt-history-student__";
      testStudentIds.push(studentId);

      const first = await seedCachedQuestion({
        difficulty: "grade",
        questionType: "reasoning",
        idSuffix: "first",
      });
      const second = await seedCachedQuestion({
        difficulty: "grade",
        questionType: "reasoning",
        idSuffix: "second",
      });

      const generateArgs = {
        conceptId: REAL_CONCEPT_ID,
        difficulty: "grade",
        questionType: "reasoning",
        studentId,
      };

      // 1. Generating (displaying) a question does not, by itself,
      // record an attempt.
      const res1 = await POST(postRequest(generateArgs));
      const body1 = await res1.json();
      assert.equal(res1.status, 200);
      assert.equal(body1.question.id, first.id);
      assert.deepEqual(await findAttemptedQuestionIds(studentId), []);

      // 2. Submit records the attempt.
      const recordRes = await recordAttemptPOST(
        recordAttemptRequest({ studentId, questionId: first.id })
      );
      assert.equal(recordRes.status, 200);
      assert.deepEqual(await findAttemptedQuestionIds(studentId), [first.id]);

      // 3. Next Question re-queries the persisted attempt history and
      // does not return the just-submitted question again.
      const res2 = await POST(postRequest(generateArgs));
      const body2 = await res2.json();
      assert.equal(res2.status, 200);
      assert.equal(body2.question.id, second.id);

      // Submit the second question too.
      await recordAttemptPOST(recordAttemptRequest({ studentId, questionId: second.id }));

      // 4. Every cached candidate for this combo has now been
      // attempted — a clear 409, not a silent repeat of `first`.
      const res3 = await POST(postRequest(generateArgs));
      const body3 = await res3.json();
      assert.equal(res3.status, 409);
      assert.equal(body3.poolExhausted, true);
    });

    await test("shared pool across students: two students draw from the same cached pool but keep independent attempt histories", async () => {
      const studentA = "__test-route-shared-pool-student-a__";
      const studentB = "__test-route-shared-pool-student-b__";
      testStudentIds.push(studentA, studentB);

      const first = await seedCachedQuestion({
        difficulty: "olympiad",
        questionType: "fill-blanks",
        idSuffix: "first",
      });
      const second = await seedCachedQuestion({
        difficulty: "olympiad",
        questionType: "fill-blanks",
        idSuffix: "second",
      });

      const baseArgs = {
        conceptId: REAL_CONCEPT_ID,
        difficulty: "olympiad",
        questionType: "fill-blanks",
      };

      // Student A gets the first pool question and attempts it.
      const resA1 = await POST(postRequest({ ...baseArgs, studentId: studentA }));
      const bodyA1 = await resA1.json();
      assert.equal(bodyA1.question.id, first.id);
      await recordAttemptPOST(recordAttemptRequest({ studentId: studentA, questionId: first.id }));

      // Student B is unaffected by A's attempt and sees the very same
      // pool question — proving the pool itself is shared, not
      // duplicated or regenerated per student.
      const resB1 = await POST(postRequest({ ...baseArgs, studentId: studentB }));
      const bodyB1 = await resB1.json();
      assert.equal(bodyB1.question.id, first.id);

      // Student A's own history correctly excludes `first` on their
      // next request, serving `second` from the same shared pool —
      // while student B, who hasn't attempted anything, would still
      // see `first` if asked again (independent histories).
      const resA2 = await POST(postRequest({ ...baseArgs, studentId: studentA }));
      const bodyA2 = await resA2.json();
      assert.equal(bodyA2.question.id, second.id);

      const resB2 = await POST(postRequest({ ...baseArgs, studentId: studentB }));
      const bodyB2 = await resB2.json();
      assert.equal(bodyB2.question.id, first.id);
    });
  } finally {
    await cleanupGenerated();
    await cleanupStudents();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
