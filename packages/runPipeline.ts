import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { parseDocument } from "./knowledge-engine/ingestion/parseDocument";
import {
  saveRawExtraction,
  saveSourceMetadata,
  saveAssessmentStructureEvidence,
} from "./knowledge-engine/ingestion";
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
import { AIProvider } from "./ai/providers/AIProvider";
import { ClaudeProvider } from "./ai/providers/ClaudeProvider";
import { GroqProvider } from "./ai/providers/GroqProvider";
import { ClaudeConceptExtractor } from "./ai/extractors/ConceptExtractorService";
import { ClaudeAssessmentStructureExtractor } from "./ai/extractors/AssessmentStructureExtractorService";
import { shouldExtractAssessmentStructure } from "./ai/extractors/AssessmentStructureExtractor";
import { DocumentType, DOCUMENT_TYPES, SourceContribution } from "./shared-types";

/**
 * Parses `--document-type <type>` from argv. Defaults to
 * "textbook" when not supplied, so existing/legacy invocations of
 * this script keep behaving exactly as before role-awareness was
 * introduced.
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

async function main() {
  const documentType = parseDocumentTypeArg(process.argv.slice(2));

  const document = await parseDocument(
    "data/ncert/eemm103.pdf"
  );

  const contributions: SourceContribution[] = classifyDocument(documentType);

  await saveSourceMetadata({
    sourceDocumentId: document.id,
    title: document.filename,
    documentType,
    contributions,
  });

  const provider: AIProvider =
    process.env.AI_PROVIDER === "groq"
      ? new GroqProvider()
      : new ClaudeProvider();

  const extractor =
    new ClaudeConceptExtractor(provider);

  const extraction =
    await extractor.extract(document);

  const rawPath = await saveRawExtraction(
    extraction,
    `${document.id}.json`
  );

  console.log(`Raw extraction saved to: ${rawPath}`);

  // Assessment structure evidence (observed question-type counts)
  // is a separate LLM call from concept extraction above, and only
  // runs for document types that are themselves assessment
  // documents — never for textbooks/worksheets/assignments.
  if (shouldExtractAssessmentStructure(documentType)) {
    const structureExtractor = new ClaudeAssessmentStructureExtractor(
      provider
    );

    const evidence = await structureExtractor.extract(document);
    const evidencePath = await saveAssessmentStructureEvidence(evidence);

    console.log(`Assessment structure evidence saved to: ${evidencePath}`);
  }

  const concepts = normalizeConcepts(extraction, document.id);

  const existingGraph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

  const sourceContributions = new Map([[document.id, contributions]]);

  const canonicalization = canonicalizeConcepts(
    concepts,
    existingGraph,
    sourceContributions
  );

  await saveConceptSources(canonicalization.sources);
  await saveConceptCandidates(canonicalization.candidates);
  await saveQuestionPatterns(canonicalization.questionPatterns);

  const graph = buildKnowledgeGraph(canonicalization.concepts, existingGraph);

  const graphPath = await saveKnowledgeGraph(
    graph,
    CANONICAL_GRAPH_FILENAME
  );

  console.log(`Canonical knowledge graph saved to: ${graphPath}`);
  console.log(`Concepts: ${graph.concepts.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
  if (canonicalization.questionPatterns.length > 0) {
    console.log(`Question patterns: ${canonicalization.questionPatterns.length}`);
  }
  if (canonicalization.candidates.length > 0) {
    console.log(
      `Candidates needing review: ${canonicalization.candidates.length}`
    );
  }
}

main().catch(console.error);
