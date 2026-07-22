import {
  Concept,
  ConceptRelationship,
  KnowledgeGraph,
  RelationshipType,
} from "../../shared-types";

function edgeKey(edge: ConceptRelationship): string {
  return `${edge.type}::${edge.from}::${edge.to}`;
}

function addEdge(
  edges: ConceptRelationship[],
  seen: Set<string>,
  from: string,
  to: string,
  type: RelationshipType
): void {
  // A concept cannot be its own prerequisite/relation.
  if (from === to) return;

  const edge: ConceptRelationship = { from, to, type };
  const key = edgeKey(edge);

  if (seen.has(key)) return;

  seen.add(key);
  edges.push(edge);
}

function upsertConcept(concepts: Concept[], concept: Concept): void {
  const index = concepts.findIndex((existing) => existing.id === concept.id);

  if (index === -1) {
    concepts.push(concept);
  } else {
    concepts[index] = concept;
  }
}

/**
 * Builds (or extends) a Knowledge Graph from normalized Concepts.
 *
 * Pure, deterministic, and idempotent:
 * - Concepts are upserted by id (re-processing the same concept
 *   replaces its node in place rather than duplicating it).
 * - Edges are deduplicated by exact `type::from::to` identity.
 * - Neither `concepts` nor `existingGraph` is mutated.
 * - Calling this again with the same inputs produces a
 *   deep-equal result.
 *
 * Dangling references (a prerequisite/leadsTo/relatedConcepts id
 * that does not match any node in `concepts` or `existingGraph`)
 * are preserved as edges without a corresponding node. No fake
 * Concept is fabricated to satisfy the reference — it resolves
 * naturally if/when a real concept with that id is added in a
 * later call.
 *
 * Traversal, cycle detection, persistence, and Learning Graph
 * (per-student mastery/progress) concerns are explicitly out of
 * scope for this stage.
 */
export function buildKnowledgeGraph(
  concepts: Concept[],
  existingGraph: KnowledgeGraph = { concepts: [], relationships: [] }
): KnowledgeGraph {
  const nextConcepts = [...existingGraph.concepts];
  const nextRelationships = [...existingGraph.relationships];
  const seenEdges = new Set(nextRelationships.map(edgeKey));

  for (const concept of concepts) {
    upsertConcept(nextConcepts, concept);

    for (const prerequisite of concept.prerequisites) {
      // Foundational concept flows into the dependent concept.
      addEdge(
        nextRelationships,
        seenEdges,
        prerequisite.id,
        concept.id,
        "prerequisite"
      );
    }

    for (const next of concept.leadsTo) {
      // Same edge shape as "prerequisite" — leadsTo is that
      // relationship asserted from the other side.
      addEdge(
        nextRelationships,
        seenEdges,
        concept.id,
        next.id,
        "prerequisite"
      );
    }

    for (const related of concept.relatedConcepts) {
      addEdge(
        nextRelationships,
        seenEdges,
        concept.id,
        related.id,
        "related"
      );
    }
  }

  return {
    concepts: nextConcepts,
    relationships: nextRelationships,
  };
}
