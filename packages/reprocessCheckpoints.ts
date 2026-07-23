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
  saveQuestionPatterns,
} from "./knowledge-engine/canonicalization";
import { classifyDocument } from "./knowledge-engine/classification";
import {
  buildKnowledgeGraph,
  saveKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "./knowledge-engine/graph";
import {
  Concept,
  ConceptExtractionResult,
  DocumentType,
  DOCUMENT_TYPES,
  SourceContribution,
} from "./shared-types";

const RAW_EXTRACTIONS_DIR = path.resolve("data/extractions/raw");

/**
 * Parses an optional `--document-type <type>` applying uniformly
 * to every checkpoint reprocessed in this run. Defaults to
 * "textbook" — every checkpoint ingested so far genuinely is
 * NCERT/textbook content, so this default reproduces the exact
 * pre-role-awareness behavior when no override is given.
 */
export function parseDocumentTypeArg(argv: string[]): DocumentType {
  const index = argv.indexOf("--document-type");
  const value = index === -1 ? undefined : argv[index + 1];

  if (!value) {
    return "textbook";
  }

  if (!(DOCUMENT_TYPES as string[]).includes(value)) {
    throw new Error(
      `Unknown --document-type "${value}". Expected one of: ${DOCUMENT_TYPES.join(", ")}`
    );
  }

  return value as DocumentType;
}

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
  const documentType = parseDocumentTypeArg(process.argv.slice(2));

  const filenames = (await fs.readdir(RAW_EXTRACTIONS_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();

  console.log(`Reprocessing ${filenames.length} checkpoint(s) as documentType="${documentType}"`);

  const allConcepts: Concept[] = [];

  for (const filename of filenames) {
    const sourceDocumentId = filename.replace(/\.json$/, "");

    const raw: ConceptExtractionResult = JSON.parse(
      await fs.readFile(path.join(RAW_EXTRACTIONS_DIR, filename), "utf-8")
    );

    allConcepts.push(...normalizeConcepts(raw, sourceDocumentId));
  }

  const contributions: SourceContribution[] = classifyDocument(documentType);

  const sourceContributions = new Map(
    Array.from(new Set(allConcepts.map((c) => c.sourceDocuments[0]))).map(
      (id) => [id, contributions] as const
    )
  );

  const { concepts, sources, questionPatterns, candidates } = canonicalizeConcepts(
    allConcepts,
    undefined,
    sourceContributions
  );

  await saveConceptSources(sources);
  await saveConceptCandidates(candidates);
  await saveQuestionPatterns(questionPatterns);

  const graph = buildKnowledgeGraph(concepts);

  const graphPath = await saveKnowledgeGraph(
    graph,
    CANONICAL_GRAPH_FILENAME
  );

  console.log(`\nCanonical knowledge graph saved to: ${graphPath}`);
  console.log(`Concepts: ${graph.concepts.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
  console.log(`Question patterns: ${questionPatterns.length}`);
  console.log(`Candidates needing review: ${candidates.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
