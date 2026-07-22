import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { promises as fs } from "fs";
import path from "path";

import { normalizeConcepts } from "./knowledge-engine/normalization";
import {
  canonicalizeConcepts,
  saveConceptSources,
  saveConceptCandidates,
} from "./knowledge-engine/canonicalization";
import {
  buildKnowledgeGraph,
  saveKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "./knowledge-engine/graph";
import { Concept, ConceptExtractionResult } from "./shared-types";

const RAW_EXTRACTIONS_DIR = path.resolve("data/extractions/raw");

/**
 * Rebuilds the canonical Knowledge Graph from scratch, purely
 * from existing raw extraction checkpoints — no PDFs, no zip, no
 * AI provider calls. Useful after changing/improving the
 * canonicalization algorithm itself, or for auditing what the
 * current algorithm produces from everything ingested so far.
 *
 * Unlike runPipeline/runBatchPipeline (which load and grow the
 * existing canonical graph incrementally), this always starts
 * from an empty graph and overwrites the canonical graph file —
 * a full, deterministic rebuild, not an incremental merge.
 */
async function main() {
  const filenames = (await fs.readdir(RAW_EXTRACTIONS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();

  console.log(`Reprocessing ${filenames.length} checkpoint(s)`);

  const allConcepts: Concept[] = [];

  for (const filename of filenames) {
    const sourceDocumentId = filename.replace(/\.json$/, "");

    const raw: ConceptExtractionResult = JSON.parse(
      await fs.readFile(path.join(RAW_EXTRACTIONS_DIR, filename), "utf-8")
    );

    allConcepts.push(...normalizeConcepts(raw, sourceDocumentId));
  }

  const { concepts, sources, candidates } = canonicalizeConcepts(allConcepts);

  await saveConceptSources(sources);
  await saveConceptCandidates(candidates);

  const graph = buildKnowledgeGraph(concepts);

  const graphPath = await saveKnowledgeGraph(
    graph,
    CANONICAL_GRAPH_FILENAME
  );

  console.log(`\nCanonical knowledge graph saved to: ${graphPath}`);
  console.log(`Concepts: ${graph.concepts.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
  console.log(`Candidates needing review: ${candidates.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
