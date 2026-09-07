import assert from "node:assert/strict";

import { QuestionPattern, SourceMetadata } from "../packages/shared-types";
import {
  GenerationSourcePolicy,
  resolveAllowedPatternIds,
} from "../packages/knowledge-engine/examPlanning";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function pattern(
  overrides: Partial<QuestionPattern> & { id: string; sourceDocumentId: string }
): QuestionPattern {
  return {
    canonicalConceptId: "fractions",
    contribution: "question-pattern",
    questionTemplates: [],
    extractedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function metadata(
  overrides: Partial<SourceMetadata> & { sourceDocumentId: string }
): SourceMetadata {
  return {
    title: overrides.sourceDocumentId,
    documentType: "textbook",
    contributions: [],
    ...overrides,
  };
}

console.log("resolveAllowedPatternIds");

test("no restrictions: every pattern is returned, even one with no matching metadata", () => {
  const patterns = [
    pattern({ id: "p-textbook", sourceDocumentId: "book.pdf" }),
    pattern({ id: "p-unknown", sourceDocumentId: "unknown-doc.pdf" }),
  ];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];

  const result = resolveAllowedPatternIds(patterns, sourceMetadata, {});

  assert.deepEqual(result, ["p-textbook", "p-unknown"]);
});

test("document-type allow-list: only patterns whose metadata has an allowed documentType are returned", () => {
  const patterns = [
    pattern({ id: "p-textbook", sourceDocumentId: "book.pdf" }),
    pattern({ id: "p-olympiad", sourceDocumentId: "olympiad.pdf" }),
  ];
  const sourceMetadata = [
    metadata({ sourceDocumentId: "book.pdf", documentType: "textbook" }),
    metadata({ sourceDocumentId: "olympiad.pdf", documentType: "olympiad" }),
  ];

  const policy: GenerationSourcePolicy = { allowedDocumentTypes: ["textbook"] };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["p-textbook"]);
});

test("contribution allow-list: only patterns with an allowed contribution are returned", () => {
  const patterns = [
    pattern({ id: "p-question", sourceDocumentId: "book.pdf", contribution: "question-pattern" }),
    pattern({ id: "p-depth", sourceDocumentId: "book.pdf", contribution: "depth-challenge" }),
  ];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];

  const policy: GenerationSourcePolicy = {
    allowedContributions: ["question-pattern"],
  };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["p-question"]);
});

test("both restrictions: a pattern must satisfy document type AND contribution", () => {
  const patterns = [
    // satisfies both
    pattern({ id: "p-both-ok", sourceDocumentId: "textbook.pdf", contribution: "question-pattern" }),
    // right contribution, wrong document type
    pattern({ id: "p-wrong-doctype", sourceDocumentId: "olympiad.pdf", contribution: "question-pattern" }),
    // right document type, wrong contribution
    pattern({ id: "p-wrong-contribution", sourceDocumentId: "textbook.pdf", contribution: "depth-challenge" }),
  ];
  const sourceMetadata = [
    metadata({ sourceDocumentId: "textbook.pdf", documentType: "textbook" }),
    metadata({ sourceDocumentId: "olympiad.pdf", documentType: "olympiad" }),
  ];

  const policy: GenerationSourcePolicy = {
    allowedDocumentTypes: ["textbook"],
    allowedContributions: ["question-pattern"],
  };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["p-both-ok"]);
});

test("an explicitly empty allowedDocumentTypes list allows nothing, even with matching metadata", () => {
  const patterns = [pattern({ id: "p-textbook", sourceDocumentId: "book.pdf" })];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf", documentType: "textbook" })];

  const policy: GenerationSourcePolicy = { allowedDocumentTypes: [] };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, []);
});

test("an explicitly empty allowedContributions list allows nothing, regardless of contribution", () => {
  const patterns = [pattern({ id: "p-question", sourceDocumentId: "book.pdf" })];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];

  const policy: GenerationSourcePolicy = { allowedContributions: [] };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, []);
});

test("missing metadata: excluded when document-type filtering is required", () => {
  const patterns = [
    pattern({ id: "p-known", sourceDocumentId: "book.pdf" }),
    pattern({ id: "p-unknown", sourceDocumentId: "unknown-doc.pdf" }),
  ];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf", documentType: "textbook" })];

  const policy: GenerationSourcePolicy = { allowedDocumentTypes: ["textbook"] };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["p-known"]);
});

test("missing metadata is irrelevant when document-type filtering is not requested: contribution alone can still allow it", () => {
  const patterns = [
    pattern({ id: "p-unknown", sourceDocumentId: "unknown-doc.pdf", contribution: "question-pattern" }),
  ];
  const sourceMetadata: SourceMetadata[] = [];

  const policy: GenerationSourcePolicy = {
    allowedContributions: ["question-pattern"],
  };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["p-unknown"]);
});

test("deterministic ordering: returned ids are lexicographically sorted regardless of input order", () => {
  const patterns = [
    pattern({ id: "z-pattern", sourceDocumentId: "book.pdf" }),
    pattern({ id: "a-pattern", sourceDocumentId: "book.pdf" }),
    pattern({ id: "m-pattern", sourceDocumentId: "book.pdf" }),
  ];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];

  const result = resolveAllowedPatternIds(patterns, sourceMetadata, {});

  assert.deepEqual(result, ["a-pattern", "m-pattern", "z-pattern"]);
});

test("duplicate pattern ids are deduplicated in the result", () => {
  const patterns = [
    pattern({ id: "dup-pattern", sourceDocumentId: "book.pdf" }),
    pattern({ id: "dup-pattern", sourceDocumentId: "book.pdf" }),
  ];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];

  const result = resolveAllowedPatternIds(patterns, sourceMetadata, {});

  assert.deepEqual(result, ["dup-pattern"]);
});

test("does not mutate the supplied patterns, sourceMetadata, or policy", () => {
  const patterns = [pattern({ id: "p-1", sourceDocumentId: "book.pdf" })];
  const sourceMetadata = [metadata({ sourceDocumentId: "book.pdf" })];
  const policy: GenerationSourcePolicy = { allowedDocumentTypes: ["textbook"] };

  const patternsSnapshot = JSON.parse(JSON.stringify(patterns));
  const metadataSnapshot = JSON.parse(JSON.stringify(sourceMetadata));
  const policySnapshot = JSON.parse(JSON.stringify(policy));

  resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(patterns, patternsSnapshot);
  assert.deepEqual(sourceMetadata, metadataSnapshot);
  assert.deepEqual(policy, policySnapshot);
});

test("document type and contribution are never inferred from the pattern id or sourceDocumentId string", () => {
  // A sourceDocumentId that looks like it names an Olympiad resource,
  // and a pattern id that looks like it names a textbook, must never
  // influence the decision — only the actual documentType/contribution
  // fields matter.
  const patterns = [
    pattern({
      id: "textbook-looking-id",
      sourceDocumentId: "totally-looks-like-an-olympiad-paper.pdf",
      contribution: "question-pattern",
    }),
  ];
  const sourceMetadata = [
    metadata({
      sourceDocumentId: "totally-looks-like-an-olympiad-paper.pdf",
      documentType: "textbook",
    }),
  ];

  const policy: GenerationSourcePolicy = {
    allowedDocumentTypes: ["textbook"],
    allowedContributions: ["question-pattern"],
  };
  const result = resolveAllowedPatternIds(patterns, sourceMetadata, policy);

  assert.deepEqual(result, ["textbook-looking-id"]);
});

console.log(`\n${passed} passed`);
