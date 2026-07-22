import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  extractZip,
  findPdfFiles,
  getRawExtractionPath,
  parseDocument,
  saveRawExtraction,
} from "./knowledge-engine/ingestion";
import { normalizeConcepts } from "./knowledge-engine/normalization";
import {
  canonicalizeConcepts,
  saveConceptSources,
  saveConceptCandidates,
} from "./knowledge-engine/canonicalization";
import {
  buildKnowledgeGraph,
  loadKnowledgeGraph,
  saveKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "./knowledge-engine/graph";
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  ConceptExtractor,
  ClaudeConceptExtractor,
} from "./ai";
import { Concept, ConceptExtractionResult } from "./shared-types";

export interface ParsedArgs {
  zipPath: string;
  force: boolean;
}

/**
 * Parses CLI args for: <zip-path> [--force]
 * The zip path is required and may be any path/filename — it is
 * never assumed to be a specific book/chapter.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes("--force");
  const zipPath = argv.find((arg) => arg !== "--force");

  if (!zipPath) {
    throw new Error(
      "Usage: runBatchPipeline.ts <path-to-zip> [--force]"
    );
  }

  return { zipPath, force };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface BatchFailure {
  pdfPath: string;
  error: string;
}

/**
 * Runs the existing single-document stages for one PDF:
 * parseDocument -> ConceptExtractor -> saveRawExtraction ->
 * normalizeConcepts.
 *
 * If a raw extraction checkpoint already exists for this
 * document's id and `force` is false, the AI extraction stage
 * (and the checkpoint write) is skipped and the existing
 * checkpoint is normalized instead — avoiding an unnecessary API
 * call on batch re-runs.
 */
export async function processPdf(
  pdfPath: string,
  extractor: ConceptExtractor,
  force: boolean
): Promise<Concept[]> {
  const document = await parseDocument(pdfPath);

  const checkpointPath = getRawExtractionPath(`${document.id}.json`);
  const reuseCheckpoint = !force && (await fileExists(checkpointPath));

  let extraction: ConceptExtractionResult;

  if (reuseCheckpoint) {
    extraction = JSON.parse(
      await fs.readFile(checkpointPath, "utf-8")
    );
  } else {
    extraction = await extractor.extract(document);
    await saveRawExtraction(extraction, `${document.id}.json`);
  }

  return normalizeConcepts(extraction, document.id);
}

/**
 * Processes every discovered PDF, continuing past individual
 * failures rather than aborting the whole batch. Successes are
 * merged into one Concept[]; failures are collected with the
 * offending path and error message.
 */
export async function runBatch(
  pdfPaths: string[],
  extractor: ConceptExtractor,
  force: boolean
): Promise<{ concepts: Concept[]; failures: BatchFailure[] }> {
  const concepts: Concept[] = [];
  const failures: BatchFailure[] = [];

  for (const pdfPath of pdfPaths) {
    try {
      const result = await processPdf(pdfPath, extractor, force);
      concepts.push(...result);
    } catch (error) {
      failures.push({
        pdfPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { concepts, failures };
}

async function main() {
  const { zipPath, force } = parseArgs(process.argv.slice(2));

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-batch-")
  );

  try {
    await extractZip(zipPath, tempDir);

    const pdfPaths = await findPdfFiles(tempDir);

    console.log(`Discovered ${pdfPaths.length} PDF(s) in ${zipPath}`);

    const provider: AIProvider =
      process.env.AI_PROVIDER === "groq"
        ? new GroqProvider()
        : new ClaudeProvider();

    const extractor = new ClaudeConceptExtractor(provider);

    const { concepts, failures } = await runBatch(
      pdfPaths,
      extractor,
      force
    );

    const existingGraph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

    const canonicalization = canonicalizeConcepts(concepts, existingGraph);

    await saveConceptSources(canonicalization.sources);
    await saveConceptCandidates(canonicalization.candidates);

    const graph = buildKnowledgeGraph(
      canonicalization.concepts,
      existingGraph
    );

    const graphPath = await saveKnowledgeGraph(
      graph,
      CANONICAL_GRAPH_FILENAME
    );

    console.log(`\nCanonical knowledge graph saved to: ${graphPath}`);
    console.log(`Concepts: ${graph.concepts.length}`);
    console.log(`Relationships: ${graph.relationships.length}`);
    console.log(
      `Succeeded: ${pdfPaths.length - failures.length}/${pdfPaths.length}`
    );
    if (canonicalization.candidates.length > 0) {
      console.log(
        `Candidates needing review: ${canonicalization.candidates.length}`
      );
    }

    if (failures.length > 0) {
      console.log(`Failed: ${failures.length}`);
      for (const failure of failures) {
        console.log(`  - ${failure.pdfPath}: ${failure.error}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

const isMain = process.argv[1]?.endsWith("runBatchPipeline.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
