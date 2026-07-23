import assert from "node:assert/strict";

import { DocumentType, DOCUMENT_TYPES } from "../packages/shared-types";
import { classifyDocument } from "../packages/knowledge-engine/classification";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

console.log("classifyDocument");

test("textbook -> core-knowledge", () => {
  assert.deepEqual(classifyDocument("textbook"), ["core-knowledge"]);
});

test("olympiad -> depth-challenge + question-pattern", () => {
  assert.deepEqual(classifyDocument("olympiad"), [
    "depth-challenge",
    "question-pattern",
  ]);
});

test("worksheet -> question-pattern", () => {
  assert.deepEqual(classifyDocument("worksheet"), ["question-pattern"]);
});

test("assignment -> question-pattern", () => {
  assert.deepEqual(classifyDocument("assignment"), ["question-pattern"]);
});

test("exam -> assessment-pattern", () => {
  assert.deepEqual(classifyDocument("exam"), ["assessment-pattern"]);
});

test("answer-key -> assessment-pattern", () => {
  assert.deepEqual(classifyDocument("answer-key"), ["assessment-pattern"]);
});

test("student-work -> student-evidence", () => {
  assert.deepEqual(classifyDocument("student-work"), ["student-evidence"]);
});

test("other -> neutral/unresolved (empty)", () => {
  assert.deepEqual(classifyDocument("other"), []);
});

test("every DocumentType has a mapping entry (no gaps)", () => {
  for (const documentType of DOCUMENT_TYPES as DocumentType[]) {
    const result = classifyDocument(documentType);
    assert.ok(Array.isArray(result), `${documentType} should map to an array`);
  }
});

test("is pure/deterministic: same input always yields deep-equal output", () => {
  assert.deepEqual(classifyDocument("olympiad"), classifyDocument("olympiad"));
});

console.log(`\n${passed} passed`);
