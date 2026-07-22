import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import { Concept } from "../packages/shared-types";
import { canonicalizeConcepts } from "../packages/knowledge-engine/canonicalization/canonicalizeConcepts";
import {
  getConceptSourcePath,
} from "../packages/knowledge-engine/canonicalization/saveConceptSources";
import { saveConceptSource } from "../packages/knowledge-engine/canonicalization";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function concept(
  overrides: Partial<Concept> & { id: string; name: string; sourceDocuments: string[] }
): Concept {
  return {
    aliases: [],
    domains: [],
    learningObjectives: [],
    bloomLevel: "understand",
    difficulty: "grade",
    explanation: "",
    realLifeExamples: [],
    stories: [],
    analogies: [],
    prerequisites: [],
    leadsTo: [],
    relatedConcepts: [],
    misconceptions: [],
    teaching: {
      primary: "activity",
      activities: [],
      parentTips: [],
      visualIdeas: [],
    },
    questionTemplates: [],
    estimatedMinutes: 10,
    version: 1,
    keywords: [],
    metadata: {
      version: 1,
      sourceDocuments: overrides.sourceDocuments,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

async function main() {
  console.log("canonicalizeConcepts");

  await test("resolves duplicate-name concepts (fraction-concept / fractions) to one canonical id", () => {
    const fractionConcept = concept({
      id: "fraction-concept",
      name: "Fractions",
      sourceDocuments: ["eemm102.pdf"],
      explanation: "equivalent fractions represent the same part of a whole",
    });
    const fractions = concept({
      id: "fractions",
      name: "Fractions",
      sourceDocuments: ["eemm115.pdf"],
      explanation: "Fractions are only used for pizza",
    });

    const result = canonicalizeConcepts([fractionConcept, fractions]);

    const ids = new Set(result.concepts.map((c) => c.id));
    assert.equal(ids.size, 1);

    const merged = result.concepts[0];
    // First-source-wins for display content.
    assert.equal(merged.explanation, "equivalent fractions represent the same part of a whole");
    assert.deepEqual(merged.sourceDocuments.sort(), ["eemm102.pdf", "eemm115.pdf"]);
  });

  await test("keeps Fractions, Equivalent Fractions, and Comparing Fractions as distinct concepts", () => {
    const fractions = concept({
      id: "fraction-concept",
      name: "Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });
    const equivalent = concept({
      id: "equivalent-fractions-concept",
      name: "Equivalent Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });
    const comparing = concept({
      id: "comparing-fractions-concept",
      name: "Comparing Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });

    const result = canonicalizeConcepts([fractions, equivalent, comparing]);

    assert.equal(result.concepts.length, 3);
    // Canonical ids are derived from name, not carried over from
    // the old LLM-generated input ids.
    const ids = result.concepts.map((c) => c.id).sort();
    assert.deepEqual(ids, [
      "comparing-fractions",
      "equivalent-fractions",
      "fractions",
    ]);
  });

  await test("resolves an 'Understanding of Fractions' prerequisite reference to the real Fractions node", () => {
    const fractions = concept({
      id: "fraction-concept",
      name: "Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });
    const equivalent = concept({
      id: "equivalent-fractions-concept",
      name: "Equivalent Fractions",
      sourceDocuments: ["eemm102.pdf"],
      prerequisites: [
        { id: "understanding-of-fractions", name: "Understanding of Fractions" },
      ],
    });

    const result = canonicalizeConcepts([fractions, equivalent]);

    const resolvedEquivalent = result.concepts.find(
      (c) => c.name === "Equivalent Fractions"
    )!;

    assert.deepEqual(resolvedEquivalent.prerequisites, [
      { id: "fractions", name: "Fractions" },
    ]);
  });

  await test("preserves an unresolved reference (does not drop it, does not fabricate a node)", () => {
    const equivalent = concept({
      id: "equivalent-fractions-concept",
      name: "Equivalent Fractions",
      sourceDocuments: ["eemm102.pdf"],
      prerequisites: [
        { id: "understanding-of-whole-numbers", name: "Understanding of whole numbers" },
      ],
    });

    const result = canonicalizeConcepts([equivalent]);

    assert.equal(result.concepts.length, 1);
    assert.deepEqual(result.concepts[0].prerequisites, [
      { id: "understanding-of-whole-numbers", name: "Understanding of whole numbers" },
    ]);
  });

  await test("REGRESSION: generic LLM ids (C1/C2/C3) from unrelated chapters no longer collide", () => {
    // Replays the real production bug: eemm113 and eemm114 both
    // independently extracted "C1"/"C2"/"C3" for completely
    // unrelated content. Under the old id = ExtractedConcept.id
    // scheme, the second chapter silently overwrote the first.
    const eemm113 = [
      concept({ id: "C1", name: "Factors and Multiples", sourceDocuments: ["eemm113.pdf"] }),
      concept({ id: "C2", name: "Prime Numbers", sourceDocuments: ["eemm113.pdf"] }),
      concept({ id: "C3", name: "Common Factors and Multiples", sourceDocuments: ["eemm113.pdf"] }),
    ];
    const eemm114 = [
      concept({ id: "C1", name: "Cardinal Directions", sourceDocuments: ["eemm114.pdf"] }),
      concept({ id: "C2", name: "Map Reading", sourceDocuments: ["eemm114.pdf"] }),
      concept({ id: "C3", name: "Grid Coordinates", sourceDocuments: ["eemm114.pdf"] }),
    ];

    const result = canonicalizeConcepts([...eemm113, ...eemm114]);

    const names = result.concepts.map((c) => c.name).sort();
    assert.deepEqual(names, [
      "Cardinal Directions",
      "Common Factors and Multiples",
      "Factors and Multiples",
      "Grid Coordinates",
      "Map Reading",
      "Prime Numbers",
    ]);
    assert.equal(result.concepts.length, 6, "all six concepts must survive — none silently overwritten");
  });

  await test("produces two distinct ConceptSource records for the same canonical concept from two sources", () => {
    const fractionConcept = concept({
      id: "fraction-concept",
      name: "Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });
    const fractions = concept({
      id: "fractions",
      name: "Fractions",
      sourceDocuments: ["eemm115.pdf"],
    });

    const result = canonicalizeConcepts([fractionConcept, fractions]);

    assert.equal(result.sources.length, 2);
    const sourceDocIds = result.sources.map((s) => s.sourceDocumentId).sort();
    assert.deepEqual(sourceDocIds, ["eemm102.pdf", "eemm115.pdf"]);
    assert.ok(result.sources.every((s) => s.canonicalConceptId === "fractions"));
  });

  await test("ConceptSource identity is deterministic (canonicalConceptId::sourceDocumentId) and idempotent on disk", async () => {
    const fractions = concept({
      id: "fractions",
      name: "Fractions",
      sourceDocuments: ["eemm103.pdf"],
    });

    const first = canonicalizeConcepts([fractions]);
    assert.equal(first.sources[0].id, "fractions::eemm103.pdf");

    const path1 = await saveConceptSource(first.sources[0]);
    const path2 = await saveConceptSource(first.sources[0]);
    assert.equal(path1, path2);
    assert.equal(path1, getConceptSourcePath("fractions", "eemm103.pdf"));

    await fs.rm(path1, { force: true });
  });

  await test("ambiguous concept identity is never silently merged — it gets its own concept plus a candidate record", () => {
    // Seed two pre-existing canonical concepts that already share
    // the exact same name (a pathological state canonicalization
    // itself would never create, but one it must handle safely if
    // it's ever encountered — e.g. manually-edited graph data).
    const existingGraph = {
      concepts: [
        concept({ id: "fractions-a", name: "Fractions", sourceDocuments: ["book-a.pdf"] }),
        concept({ id: "fractions-b", name: "Fractions", sourceDocuments: ["book-b.pdf"] }),
      ],
      relationships: [],
    };

    // Its wrapper-stripped core name ("Fractions") now matches
    // both existing concepts at once.
    const ambiguousRef = concept({
      id: "some-id",
      name: "Understanding of Fractions",
      sourceDocuments: ["book-c.pdf"],
    });

    const result = canonicalizeConcepts([ambiguousRef], existingGraph);

    assert.equal(result.concepts.length, 1, "ambiguous concept must still get its own node, not be dropped");
    assert.notEqual(result.concepts[0].id, "fractions-a");
    assert.notEqual(result.concepts[0].id, "fractions-b");
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].extractedName, "Understanding of Fractions");
    assert.equal(result.candidates[0].possibleMatches.length, 2);
  });

  await test("is idempotent: canonicalizing the same batch against its own prior output changes nothing", () => {
    const fractionConcept = concept({
      id: "fraction-concept",
      name: "Fractions",
      sourceDocuments: ["eemm102.pdf"],
    });
    const equivalent = concept({
      id: "equivalent-fractions-concept",
      name: "Equivalent Fractions",
      sourceDocuments: ["eemm102.pdf"],
      prerequisites: [{ id: "understanding-of-fractions", name: "Understanding of Fractions" }],
    });

    const firstRun = canonicalizeConcepts([fractionConcept, equivalent]);
    const graphAfterFirstRun = { concepts: firstRun.concepts, relationships: [] };

    const secondRun = canonicalizeConcepts(
      [fractionConcept, equivalent],
      graphAfterFirstRun
    );

    const sortedIds = (concepts: Concept[]) => [...concepts].map((c) => c.id).sort();
    assert.deepEqual(sortedIds(secondRun.concepts), sortedIds(firstRun.concepts));
    assert.equal(secondRun.concepts.length, firstRun.concepts.length);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
