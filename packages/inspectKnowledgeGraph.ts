import {
  Concept,
  ConceptReference,
  KnowledgeGraph,
} from "./shared-types";
import {
  loadKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "./knowledge-engine/graph";

/**
 * Parses the single required CLI argument: a concept id or name.
 */
export function parseArgs(argv: string[]): string {
  const query = argv[0];

  if (!query) {
    throw new Error(
      'Usage: inspectKnowledgeGraph.ts <concept-id-or-name> (e.g. "fractions" or "Equivalent Fractions")'
    );
  }

  return query;
}

/**
 * Finds a concept by, in order: exact id, exact case-insensitive
 * name, then case-insensitive alias. Read-only — never mutates
 * the graph.
 */
export function findConcept(
  graph: KnowledgeGraph,
  query: string
): Concept | undefined {
  const byId = graph.concepts.find((concept) => concept.id === query);
  if (byId) return byId;

  const lowerQuery = query.toLowerCase();

  const byName = graph.concepts.find(
    (concept) => concept.name.toLowerCase() === lowerQuery
  );
  if (byName) return byName;

  const byAlias = graph.concepts.find((concept) =>
    concept.aliases.some((alias) => alias.toLowerCase() === lowerQuery)
  );
  if (byAlias) return byAlias;

  return undefined;
}

/**
 * Resolves a ConceptReference against the current graph so the
 * displayed name always reflects the live canonical concept, not
 * just whatever name was stored on the reference at
 * canonicalization time. References that don't resolve to any
 * current node (dangling, per the graph's own design) are shown
 * as unresolved rather than hidden.
 */
function formatReference(
  ref: ConceptReference,
  concepts: Concept[]
): string {
  const target = concepts.find((concept) => concept.id === ref.id);

  if (target) {
    return `${target.name} (${target.id})`;
  }

  return `${ref.name} (${ref.id}) [unresolved]`;
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `  - ${item}`).join("\n") : "  (none)";
}

export function formatConcept(
  concept: Concept,
  graph: KnowledgeGraph
): string {
  const lines: string[] = [];

  lines.push(`Concept ID: ${concept.id}`);
  lines.push(`Name: ${concept.name}`);
  lines.push(
    `Aliases: ${concept.aliases.length > 0 ? concept.aliases.join(", ") : "(none)"}`
  );

  lines.push("Learning Objectives:");
  lines.push(formatList(concept.learningObjectives));

  lines.push("Prerequisites:");
  lines.push(
    formatList(
      concept.prerequisites.map((ref) => formatReference(ref, graph.concepts))
    )
  );

  lines.push("Leads To:");
  lines.push(
    formatList(concept.leadsTo.map((ref) => formatReference(ref, graph.concepts)))
  );

  lines.push("Related Concepts:");
  lines.push(
    formatList(
      concept.relatedConcepts.map((ref) => formatReference(ref, graph.concepts))
    )
  );

  lines.push(
    `Source Documents: ${
      concept.sourceDocuments.length > 0 ? concept.sourceDocuments.join(", ") : "(none)"
    }`
  );

  return lines.join("\n");
}

async function main() {
  const query = parseArgs(process.argv.slice(2));

  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

  const concept = findConcept(graph, query);

  if (!concept) {
    console.log(`No concept found matching: "${query}"`);
    process.exitCode = 1;
    return;
  }

  console.log(formatConcept(concept, graph));
}

const isMain = process.argv[1]?.endsWith("inspectKnowledgeGraph.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
