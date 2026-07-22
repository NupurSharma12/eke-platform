import {
  Concept,
  ConceptCandidate,
  ConceptReference,
  ConceptSource,
  KnowledgeGraph,
} from "../../shared-types";
import { slugify } from "../normalization/normalizeConcepts";
import { normalizeConceptName } from "./normalizeConceptName";
import { resolveReference } from "./resolveReference";

export interface CanonicalizationResult {
  /**
   * The (possibly merged) canonical Concepts touched by this
   * call — feed these into buildKnowledgeGraph alongside the
   * same existingGraph passed in here.
   */
  concepts: Concept[];
  sources: ConceptSource[];
  candidates: ConceptCandidate[];
}

function unionStrings(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

function unionReferences(
  a: ConceptReference[],
  b: ConceptReference[]
): ConceptReference[] {
  const seen = new Set(a.map((ref) => ref.id));
  const merged = [...a];

  for (const ref of b) {
    if (!seen.has(ref.id)) {
      seen.add(ref.id);
      merged.push(ref);
    }
  }

  return merged;
}

/**
 * Resolves every reference in a list against the currently-known
 * canonical concepts. A resolved reference is rewritten to the
 * canonical id/name; an unresolved one is preserved exactly as
 * given (never dropped, never fabricated). Ambiguous references
 * are also left unresolved — for an edge, guessing between
 * several candidates risks pointing at the wrong concept, so
 * "leave dangling" is the safer default than for a top-level
 * concept (which always gets a home, see canonicalizeConcepts).
 */
function resolveReferenceArray(
  refs: ConceptReference[],
  knownConcepts: Concept[]
): ConceptReference[] {
  return refs.map((ref) => {
    const resolution = resolveReference(ref.name, knownConcepts);

    if (resolution.status === "matched") {
      const target = knownConcepts.find((c) => c.id === resolution.conceptId);
      if (target) {
        return { id: target.id, name: target.name };
      }
    }

    return ref;
  });
}

function generateCanonicalId(name: string): string {
  return slugify(name);
}

function buildConceptSource(
  concept: Concept,
  canonicalConceptId: string,
  sourceDocumentId: string
): ConceptSource {
  return {
    id: `${canonicalConceptId}::${sourceDocumentId}`,
    canonicalConceptId,
    sourceDocumentId,
    name: concept.name,
    domains: concept.domains,
    learningObjectives: concept.learningObjectives,
    bloomLevel: concept.bloomLevel,
    difficulty: concept.difficulty,
    explanation: concept.explanation,
    realLifeExamples: concept.realLifeExamples,
    stories: concept.stories,
    analogies: concept.analogies,
    misconceptions: concept.misconceptions,
    teaching: concept.teaching,
    questionTemplates: concept.questionTemplates,
    estimatedMinutes: concept.estimatedMinutes,
    keywords: concept.keywords,
    extractedAt: concept.metadata.createdAt,
  };
}

/**
 * Resolves normalized Concepts into canonical identity, merging
 * with an existing Knowledge Graph if one is supplied.
 *
 * Pure and deterministic: no AI provider calls, no
 * similarity/fuzzy scoring, no wall-clock reads. Concepts are
 * processed in input order, and each is resolved against the
 * existing graph's concepts plus every concept already processed
 * earlier in this same call — so this one function naturally
 * handles both within-batch canonicalization (existingGraph
 * empty or omitted) and against-existing-graph canonicalization
 * (existingGraph loaded from a prior run), per the same
 * accumulation pattern buildKnowledgeGraph already uses.
 *
 * For a matched concept, the existing canonical concept's
 * display fields (explanation, misconceptions, teaching, etc.)
 * are left untouched — "first source wins" for display content,
 * since blending two sources' explanations is a content-
 * synthesis problem explicitly out of scope here. Every source's
 * full content is preserved losslessly in a ConceptSource record
 * regardless. Relational fields (prerequisites/leadsTo/
 * relatedConcepts) are unioned rather than first-wins, since
 * those become graph edges and dropping a later source's
 * distinct prerequisite claim would make the graph less
 * connected, not just less detailed.
 *
 * Ambiguous concept names still get a real canonical concept
 * created (never blocked, never silently merged) plus a
 * ConceptCandidate record — a false negative (an avoidable
 * duplicate) is preferred over a false positive (an incorrect
 * merge), per the explicit architectural principle this was
 * designed against.
 */
export function canonicalizeConcepts(
  concepts: Concept[],
  existingGraph: KnowledgeGraph = { concepts: [], relationships: [] }
): CanonicalizationResult {
  const known: Concept[] = [...existingGraph.concepts];

  const touched: Concept[] = [];
  const sources: ConceptSource[] = [];
  const candidates: ConceptCandidate[] = [];

  for (const concept of concepts) {
    const sourceDocumentId = concept.sourceDocuments[0];

    const resolution = resolveReference(concept.name, known);

    let canonical: Concept;

    if (resolution.status === "matched") {
      const existing = known.find((c) => c.id === resolution.conceptId);

      // Should not happen (resolution only returns ids drawn
      // from `known`), but keeps this function total rather than
      // relying on a non-null assertion.
      if (!existing) {
        throw new Error(
          `resolveReference returned unknown concept id: ${resolution.conceptId}`
        );
      }

      const isNewAlias =
        normalizeConceptName(concept.name) !== normalizeConceptName(existing.name) &&
        !existing.aliases.some(
          (alias) => normalizeConceptName(alias) === normalizeConceptName(concept.name)
        );

      canonical = {
        ...existing,
        prerequisites: unionReferences(
          existing.prerequisites,
          resolveReferenceArray(concept.prerequisites, known)
        ),
        leadsTo: unionReferences(
          existing.leadsTo,
          resolveReferenceArray(concept.leadsTo, known)
        ),
        relatedConcepts: unionReferences(
          existing.relatedConcepts,
          resolveReferenceArray(concept.relatedConcepts, known)
        ),
        sourceDocuments: unionStrings(existing.sourceDocuments, concept.sourceDocuments),
        aliases: isNewAlias
          ? unionStrings(existing.aliases, [concept.name])
          : existing.aliases,
        metadata: {
          ...existing.metadata,
          sourceDocuments: unionStrings(
            existing.metadata.sourceDocuments,
            concept.sourceDocuments
          ),
          updatedAt: concept.metadata.updatedAt,
        },
      };
    } else {
      const canonicalId = generateCanonicalId(concept.name);

      canonical = {
        ...concept,
        id: canonicalId,
        aliases: [],
        prerequisites: resolveReferenceArray(concept.prerequisites, known),
        leadsTo: resolveReferenceArray(concept.leadsTo, known),
        relatedConcepts: resolveReferenceArray(concept.relatedConcepts, known),
      };

      if (resolution.status === "ambiguous") {
        candidates.push({
          id: `${slugify(concept.name)}__${sourceDocumentId}`,
          extractedName: concept.name,
          sourceDocumentId,
          createdConceptId: canonicalId,
          possibleMatches: resolution.candidates,
          status: "pending",
          createdAt: concept.metadata.createdAt,
        });
      }
    }

    const existingIndex = known.findIndex((c) => c.id === canonical.id);
    if (existingIndex === -1) {
      known.push(canonical);
    } else {
      known[existingIndex] = canonical;
    }

    touched.push(canonical);
    sources.push(buildConceptSource(concept, canonical.id, sourceDocumentId));
  }

  // Keep only the final (most-merged) entry per canonical id —
  // each successive entry for the same id already subsumes the
  // previous one, since `known` accumulates monotonically above.
  const finalById = new Map<string, Concept>();
  for (const concept of touched) {
    finalById.set(concept.id, concept);
  }

  return {
    concepts: Array.from(finalById.values()),
    sources,
    candidates,
  };
}
