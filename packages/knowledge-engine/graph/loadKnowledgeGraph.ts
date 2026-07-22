import { promises as fs } from "fs";

import { KnowledgeGraph } from "../../shared-types";
import { getKnowledgeGraphPath } from "./saveKnowledgeGraph";

const EMPTY_GRAPH: KnowledgeGraph = { concepts: [], relationships: [] };

/**
 * Loads a previously-saved Knowledge Graph, or an empty graph if
 * none exists yet (e.g. the very first pipeline run). This is
 * what lets canonicalization seed from "whatever's already
 * canonical" instead of starting fresh every run.
 */
export async function loadKnowledgeGraph(
  filename: string
): Promise<KnowledgeGraph> {
  const inputPath = getKnowledgeGraphPath(filename);

  try {
    const raw = await fs.readFile(inputPath, "utf-8");
    return JSON.parse(raw) as KnowledgeGraph;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return EMPTY_GRAPH;
    }
    throw error;
  }
}
