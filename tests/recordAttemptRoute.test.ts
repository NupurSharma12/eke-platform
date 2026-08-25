import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";

import { POST } from "../app/api/eke/record-attempt/route";
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

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/eke/record-attempt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("POST /api/eke/record-attempt");

  const testStudentIds: string[] = [];

  async function cleanup() {
    for (const studentId of testStudentIds) {
      await fs.rm(path.dirname(getStudentAttemptsPath(studentId)), {
        recursive: true,
        force: true,
      });
    }
    testStudentIds.length = 0;
  }

  try {
    await test("records an attempt and it's visible via findAttemptedQuestionIds", async () => {
      const studentId = "__test-route-record-attempt__";
      testStudentIds.push(studentId);

      const res = await POST(postRequest({ studentId, questionId: "question-a" }));
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.recorded, true);

      const ids = await findAttemptedQuestionIds(studentId);
      assert.deepEqual(ids, ["question-a"]);
    });

    await test("a duplicate call for the same (studentId, questionId) is idempotent through the route too", async () => {
      const studentId = "__test-route-record-attempt-dup__";
      testStudentIds.push(studentId);

      await POST(postRequest({ studentId, questionId: "question-a" }));
      await POST(postRequest({ studentId, questionId: "question-a" }));

      const ids = await findAttemptedQuestionIds(studentId);
      assert.deepEqual(ids, ["question-a"]);
    });

    await test("missing studentId is rejected with a clear 400", async () => {
      const res = await POST(postRequest({ questionId: "question-a" }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /studentId/);
    });

    await test("missing questionId is rejected with a clear 400", async () => {
      const res = await POST(postRequest({ studentId: "__test-route-missing-question-id__" }));
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.match(body.error, /questionId/);
    });
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
