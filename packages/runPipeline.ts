import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { parseDocument } from "./knowledge-engine/ingestion/parseDocument";
import { saveRawExtraction } from "./knowledge-engine/ingestion";
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
import { AIProvider } from "./ai/providers/AIProvider";
import { ClaudeProvider } from "./ai/providers/ClaudeProvider";
import { GroqProvider } from "./ai/providers/GroqProvider";
import { ClaudeConceptExtractor } from "./ai/extractors/ConceptExtractorService";

async function main() {
  const document = await parseDocument(
    "data/ncert/eemm103.pdf"
  );

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

  const concepts = normalizeConcepts(extraction, document.id);

  const existingGraph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

  const canonicalization = canonicalizeConcepts(concepts, existingGraph);

  await saveConceptSources(canonicalization.sources);
  await saveConceptCandidates(canonicalization.candidates);

  const graph = buildKnowledgeGraph(canonicalization.concepts, existingGraph);

  const graphPath = await saveKnowledgeGraph(
    graph,
    CANONICAL_GRAPH_FILENAME
  );

  console.log(`Canonical knowledge graph saved to: ${graphPath}`);
  console.log(`Concepts: ${graph.concepts.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
  if (canonicalization.candidates.length > 0) {
    console.log(
      `Candidates needing review: ${canonicalization.candidates.length}`
    );
  }
}

main().catch(console.error);
