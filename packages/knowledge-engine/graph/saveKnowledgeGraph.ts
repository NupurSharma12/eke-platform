import { promises as fs } from "fs";
import path from "path";

import { KnowledgeGraph } from "../../shared-types";

/**
 * The single, shared, growing canonical Knowledge Graph.
 * Every pipeline run loads this, merges in new content via
 * canonicalization, and saves back to the same file — there is
 * deliberately no per-book/per-batch graph file, since the
 * product direction is one accumulating graph, not an isolated
 * graph per source.
 */
export const CANONICAL_GRAPH_FILENAME = "canonical.json";

export function getKnowledgeGraphPath(filename: string): string {
  return path.join(
    path.resolve("data/graphs"),
    filename
  );
}

export async function saveKnowledgeGraph(
  graph: KnowledgeGraph,
  filename: string
): Promise<string> {
  const outputPath = getKnowledgeGraphPath(filename);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(graph, null, 2),
    "utf-8"
  );

  return outputPath;
}
