import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  extractZip,
  findSupportedFiles,
  getRawExtractionPath,
  parseDocument,
  parseImage,
  saveRawExtraction,
  saveSourceMetadata,
  saveAssessmentStructureEvidence,
} from "./knowledge-engine/ingestion";
import { DiscoveredFile } from "./knowledge-engine/ingestion/findSupportedFiles";
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
  loadKnowledgeGraph,
  saveKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "./knowledge-engine/graph";
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  GeminiProvider,
  ConceptExtractor,
  ClaudeConceptExtractor,
  ClaudeAssessmentStructureExtractor,
  withRetry,
} from "./ai";
import { shouldExtractAssessmentStructure } from "./ai/extractors/AssessmentStructureExtractor";
import {
  Concept,
  ConceptExtractionResult,
  DocumentType,
  DOCUMENT_TYPES,
  SourceContribution,
} from "./shared-types";

export interface ParsedArgs {
  // Kept as `zipPath` for backward compatibility with existing
  // callers/tests, even though this may now also be a directory
  // path containing PDFs/images directly (see resolveInputDirectory).
  zipPath: string;
  force: boolean;
  documentType: DocumentType;
}

/**
 * Parses CLI args for: <zip-or-directory-path> [--force] [--document-type <type>]
 * The path is required and may be any zip/directory path — it is
 * never assumed to be a specific book/chapter. documentType
 * defaults to "textbook" so existing/legacy invocations keep
 * behaving exactly as before role-awareness was introduced — all
 * files discovered share the same documentType, since they're
 * chapters/pages of the same uploaded source.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes("--force");

  const documentTypeIndex = argv.indexOf("--document-type");
  const documentTypeValue =
    documentTypeIndex === -1 ? undefined : argv[documentTypeIndex + 1];

  if (documentTypeValue && !(DOCUMENT_TYPES as string[]).includes(documentTypeValue)) {
    throw new Error(
      `Unknown --document-type "${documentTypeValue}". Expected one of: ${DOCUMENT_TYPES.join(", ")}`
    );
  }

  const documentType = (documentTypeValue as DocumentType | undefined) ?? "textbook";

  const zipPath = argv.find(
    (arg, index) =>
      arg !== "--force" &&
      arg !== "--document-type" &&
      argv[index - 1] !== "--document-type"
  );

  if (!zipPath) {
    throw new Error(
      "Usage: runBatchPipeline.ts <path-to-zip-or-directory> [--force] [--document-type <type>]"
    );
  }

  return { zipPath, force, documentType };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the directory that should actually be scanned for
 * supported files. If `inputPath` is already a directory (a
 * parent pointing straight at a folder of PDFs/images), it's used
 * as-is — no zip extraction. Otherwise `inputPath` is treated as
 * a zip file and extracted into `tempDir`.
 */
export async function resolveInputDirectory(
  inputPath: string,
  tempDir: string
): Promise<string> {
  const stats = await fs.stat(inputPath);

  if (stats.isDirectory()) {
    return inputPath;
  }

  const extension = path.extname(inputPath).toLowerCase();

  if (extension === ".zip") {
    await extractZip(inputPath, tempDir);
    return tempDir;
  }

  if (
    extension === ".pdf" ||
    extension === ".jpeg" ||
    extension === ".jpg" ||
    extension === ".png"
  ) {
    await fs.copyFile(
      inputPath,
      path.join(tempDir, path.basename(inputPath))
    );

    return tempDir;
  }

  throw new Error(
    `Unsupported input file type: ${inputPath}. Expected .zip, .pdf, .jpeg, .jpg, or .png.`
  );
}

export interface BatchFailure {
  // Kept as `pdfPath` for backward compatibility with existing
  // callers/tests; holds a PDF or image path depending on the
  // file that failed.
  pdfPath: string;
  error: string;
}

/**
 * Runs the existing single-input stages shared by every supported
 * file kind: check for a reusable checkpoint -> ConceptExtractor
 * (skipped on a checkpoint hit) -> saveRawExtraction ->
 * normalizeConcepts. Both processPdf and processImage delegate
 * here after doing their own kind-specific parsing, so there is
 * exactly one place that implements checkpoint reuse / `--force`
 * / normalization, regardless of input format.
 */
async function processExtractionInput(
  document: Awaited<ReturnType<typeof parseDocument>> | Awaited<ReturnType<typeof parseImage>>,
  extractor: ConceptExtractor,
  force: boolean
): Promise<Concept[]> {
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
  return processExtractionInput(document, extractor, force);
}

/**
 * Same shape as processPdf, for one image file (JPEG/JPG/PNG).
 * sourceDocumentId is the image's own filename — each photographed
 * page is independently checkpointed and independently
 * reprocessable, exactly like each PDF is today.
 */
export async function processImage(
  imagePath: string,
  extractor: ConceptExtractor,
  force: boolean
): Promise<Concept[]> {
  const document = await parseImage(imagePath);
  return processExtractionInput(document, extractor, force);
}

/**
 * Processes every discovered PDF, continuing past individual
 * failures rather than aborting the whole batch. Successes are
 * merged into one Concept[]; failures are collected with the
 * offending path and error message.
 *
 * Kept for backward compatibility (signature and behavior
 * unchanged); implemented as a thin call into the more general
 * runBatchForFiles.
 */
export async function runBatch(
  pdfPaths: string[],
  extractor: ConceptExtractor,
  force: boolean
): Promise<{ concepts: Concept[]; failures: BatchFailure[] }> {
  return runBatchForFiles(
    pdfPaths.map((absolutePath): DiscoveredFile => ({ absolutePath, kind: "pdf" })),
    extractor,
    force
  );
}

/**
 * Generalizes runBatch to mixed PDF/image input. Same failure
 * isolation as runBatch: one failing file is recorded and
 * processing continues — a single bad photo or corrupt PDF never
 * silently discards the checkpoints/concepts already produced by
 * the rest of the batch.
 */
export async function runBatchForFiles(
  files: DiscoveredFile[],
  extractor: ConceptExtractor,
  force: boolean
): Promise<{ concepts: Concept[]; failures: BatchFailure[] }> {
  const concepts: Concept[] = [];
  const failures: BatchFailure[] = [];

  for (const file of files) {
    try {
      const result =
        file.kind === "pdf"
          ? await processPdf(file.absolutePath, extractor, force)
          : await processImage(file.absolutePath, extractor, force);

      concepts.push(...result);
    } catch (error) {
      failures.push({
        pdfPath: file.absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { concepts, failures };
}

async function main() {
  const { zipPath, force, documentType } = parseArgs(process.argv.slice(2));

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-batch-")
  );

  try {
    const inputDirectory = await resolveInputDirectory(zipPath, tempDir);

    const { files, skipped } = await findSupportedFiles(inputDirectory);

    const pdfCount = files.filter((f) => f.kind === "pdf").length;
    const imageCount = files.filter((f) => f.kind === "image").length;

    console.log(
      `Discovered ${files.length} supported file(s) in ${zipPath} (${pdfCount} PDF, ${imageCount} image)`
    );

    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length} unsupported file(s):`);
      for (const skippedPath of skipped) {
        console.log(`  - ${skippedPath}`);
      }
    }

    // Defaults to ClaudeProvider exactly as before Gemini existed —
    // AI_PROVIDER unset or any value other than "groq"/"gemini"
    // preserves today's behavior unchanged. Wrapped in withRetry so
    // a rate-limited call (e.g. Gemini's free-tier
    // RESOURCE_EXHAUSTED) is retried after the provider's own
    // suggested delay instead of failing the file outright.
    const provider: AIProvider = withRetry(
      process.env.AI_PROVIDER === "groq"
        ? new GroqProvider()
        : process.env.AI_PROVIDER === "gemini"
        ? new GeminiProvider()
        : new ClaudeProvider()
    );

    const extractor = new ClaudeConceptExtractor(provider);

    const { concepts, failures } = await runBatchForFiles(
      files,
      extractor,
      force
    );

    // Assessment structure evidence (observed question-type counts)
    // is only extracted for document types that are themselves
    // assessment documents — never for textbooks/worksheets/
    // assignments, whose concept-extraction pass above is the only
    // extraction they get. This is a separate LLM call from concept
    // extraction and does not affect concepts/failures above.
    if (shouldExtractAssessmentStructure(documentType)) {
      const structureExtractor = new ClaudeAssessmentStructureExtractor(
        provider
      );

      for (const file of files.filter((f) => f.kind === "pdf")) {
        try {
          const document = await parseDocument(file.absolutePath);
          const evidence = await structureExtractor.extract(document);
          const evidencePath = await saveAssessmentStructureEvidence(
            evidence
          );
          console.log(
            `Assessment structure evidence saved to: ${evidencePath}`
          );
        } catch (error) {
          console.log(
            `  - assessment structure extraction failed for ${file.absolutePath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    const contributions: SourceContribution[] = classifyDocument(documentType);

    // Every file in this batch is a chapter/page of the same
    // uploaded source, so they all share the same classification —
    // independent of whether that source is a PDF, JPEG, or PNG.
    const sourceDocumentIds = Array.from(
      new Set(concepts.map((concept) => concept.sourceDocuments[0]))
    );

    for (const sourceDocumentId of sourceDocumentIds) {
      await saveSourceMetadata({
        sourceDocumentId,
        title: sourceDocumentId,
        documentType,
        contributions,
      });
    }

    const sourceContributions = new Map(
      sourceDocumentIds.map((id) => [id, contributions])
    );

    const existingGraph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

    const canonicalization = canonicalizeConcepts(
      concepts,
      existingGraph,
      sourceContributions
    );

    await saveConceptSources(canonicalization.sources);
    await saveConceptCandidates(canonicalization.candidates);
    await saveQuestionPatterns(canonicalization.questionPatterns);

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
      `Succeeded: ${files.length - failures.length}/${files.length}`
    );
    if (canonicalization.questionPatterns.length > 0) {
      console.log(`Question patterns: ${canonicalization.questionPatterns.length}`);
    }
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
