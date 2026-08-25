import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  recordQuestionAttempt,
  findAttemptedQuestionIds,
  getStudentAttemptsPath,
} from "../packages/knowledge-engine/studentAttempts";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function main() {
  console.log("studentAttempts (file-based dev persistence)");

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
    await test("no attempts recorded: findAttemptedQuestionIds returns an empty list", async () => {
      const studentId = "__test-student-no-attempts__";
      testStudentIds.push(studentId);

      const ids = await findAttemptedQuestionIds(studentId);

      assert.deepEqual(ids, []);
    });

    await test("recording an attempt makes it show up in findAttemptedQuestionIds", async () => {
      const studentId = "__test-student-one-attempt__";
      testStudentIds.push(studentId);

      await recordQuestionAttempt(studentId, "question-a");

      const ids = await findAttemptedQuestionIds(studentId);

      assert.deepEqual(ids, ["question-a"]);
    });

    await test("recording multiple distinct attempts accumulates all of them", async () => {
      const studentId = "__test-student-multiple-attempts__";
      testStudentIds.push(studentId);

      await recordQuestionAttempt(studentId, "question-a");
      await recordQuestionAttempt(studentId, "question-b");
      await recordQuestionAttempt(studentId, "question-c");

      const ids = await findAttemptedQuestionIds(studentId);

      assert.deepEqual(ids.sort(), ["question-a", "question-b", "question-c"]);
    });

    await test("recording the same (studentId, questionId) twice is idempotent — no duplicate entry", async () => {
      const studentId = "__test-student-idempotent__";
      testStudentIds.push(studentId);

      await recordQuestionAttempt(studentId, "question-a");
      await recordQuestionAttempt(studentId, "question-a");
      await recordQuestionAttempt(studentId, "question-a");

      const ids = await findAttemptedQuestionIds(studentId);

      assert.deepEqual(ids, ["question-a"]);
    });

    await test("attempts are isolated per student — one student's history doesn't leak into another's", async () => {
      const studentA = "__test-student-isolation-a__";
      const studentB = "__test-student-isolation-b__";
      testStudentIds.push(studentA, studentB);

      await recordQuestionAttempt(studentA, "question-a");

      const idsA = await findAttemptedQuestionIds(studentA);
      const idsB = await findAttemptedQuestionIds(studentB);

      assert.deepEqual(idsA, ["question-a"]);
      assert.deepEqual(idsB, []);
    });

    await test("persistence survives a simulated process restart: a fresh read call sees history written by an earlier one, with no in-memory state involved", async () => {
      const studentId = "__test-student-restart__";
      testStudentIds.push(studentId);

      await recordQuestionAttempt(studentId, "question-a");

      // Nothing here carries state forward except the file on disk —
      // loadAttempts() always re-reads from disk, never from a
      // module-level cache — so this read is equivalent to a fresh
      // process starting up and querying history for the first time.
      const raw = await fs.readFile(getStudentAttemptsPath(studentId), "utf-8");
      const onDisk = JSON.parse(raw);
      assert.equal(onDisk.length, 1);
      assert.equal(onDisk[0].questionId, "question-a");

      const ids = await findAttemptedQuestionIds(studentId);
      assert.deepEqual(ids, ["question-a"]);
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
