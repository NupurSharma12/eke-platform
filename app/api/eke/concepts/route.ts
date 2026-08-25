import { NextResponse } from "next/server";

import {
  loadKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
} from "@/packages/knowledge-engine/graph";

/**
 * Thin read-through over the canonical Knowledge Graph, for the
 * UI's concept selector. No new logic — just the existing
 * loadKnowledgeGraph, trimmed to the fields the selector needs.
 */
export async function GET() {
  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

  const concepts = graph.concepts
    .map((concept) => ({ id: concept.id, name: concept.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ concepts });
}
