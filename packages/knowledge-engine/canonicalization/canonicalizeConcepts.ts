import {
  Concept,
  ConceptCandidate,
  ConceptReference,
  ConceptSource,
  KnowledgeGraph,
  QuestionPattern,
  SourceContribution,
} from "../../shared-types";
import { slugify } from "../normalization/normalizeConcepts";
import { normalizeConceptName } from "./normalizeConceptName";
import { resolveReference } from "./resolveReference";
import { buildQuestionPattern } from "./buildQuestionPattern";

export interface CanonicalizationResult {
  /**
   * The (possibly merged) canonical Concepts touched by this
   * call — feed these into buildKnowledgeGraph alongside the
   * same existingGraph passed in here.
   */
  concepts: Concept[];
  sources: ConceptSource[];
  questionPatterns: QuestionPattern[];
  candidates: ConceptCandidate[];
}

const QUESTION_PATTERN_CONTRIBUTIONS: SourceContribution[] = [
  "depth-challenge",
  "question-pattern",
  "assessment-pattern",
];

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
 * Looks up what a source document contributes. Sources not
 * present in `sourceContributions` (including when the map itself
 * is omitted entirely) default to `["core-knowledge"]` — this is
 * what makes existing/legacy processing (no document-type
 * classification supplied at all) behave exactly as it did before
 * role-awareness existed, and what makes a concept that
 * originated in a prior run (whose source isn't in *this* run's
 * map) treated as already knowledge-foundation-backed rather than
 * fair game to overwrite.
 */
function getContributions(
  sourceDocumentId: string,
  sourceContributions?: Map<string, SourceContribution[]>
): SourceContribution[] {
  return sourceContributions?.get(sourceDocumentId) ?? ["core-knowledge"];
}

function isCoreKnowledgeSource(
  sourceDocumentId: string,
  sourceContributions?: Map<string, SourceContribution[]>
): boolean {
  return getContributions(sourceDocumentId, sourceContributions).includes(
    "core-knowledge"
  );
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
 * `sourceContributions` (optional) maps sourceDocumentId ->
 * SourceContribution[], as derived by classifyDocument. It makes
 * the merge role-aware:
 *
 * - A concept's display fields (explanation, misconceptions,
 *   teaching, etc.) may only be established/adopted by a
 *   core-knowledge source. Once a concept has ever had a
 *   core-knowledge contribution, no other source can overwrite
 *   those fields on a later match, regardless of processing
 *   order. Between two core-knowledge sources, the first one
 *   processed still wins — that part of the original "first
 *   source wins" behavior is unchanged.
 * - Relational fields (prerequisites/leadsTo/relatedConcepts) are
 *   still unioned regardless of role, same as before — those
 *   become graph edges, and dropping a later source's distinct
 *   claim would make the graph less connected, not just less
 *   detailed.
 * - Only core-knowledge and depth-challenge sources may create a
 *   genuinely new canonical concept. A source without that
 *   authorization whose concept doesn't match anything existing
 *   becomes a ConceptCandidate instead (the same mechanism
 *   already used for ambiguous matches — no new mechanism
 *   introduced), and no Concept/ConceptSource/QuestionPattern is
 *   produced for it.
 * - student-evidence sources are excluded entirely, before any
 *   resolution is attempted: they never appear in `concepts`,
 *   `sources`, `questionPatterns`, or `candidates`, and never
 *   touch the accumulator. This is a hard boundary, not a
 *   preference.
 *
 * Every source's full content is preserved losslessly regardless
 * of role: core-knowledge contributions become a ConceptSource;
 * depth-challenge/question-pattern/assessment-pattern
 * contributions each become their own QuestionPattern record (a
 * single source may produce more than one, e.g. an Olympiad
 * source is both depth-challenge and question-pattern).
 *
 * Ambiguous concept names (from an authorized source) still get a
 * real canonical concept created (never blocked, never silently
 * merged) plus a ConceptCandidate record — a false negative (an
 * avoidable duplicate) is preferred over a false positive (an
 * incorrect merge), per the explicit architectural principle this
 * was designed against.
 */
export function canonicalizeConcepts(
  concepts: Concept[],
  existingGraph: KnowledgeGraph = { concepts: [], relationships: [] },
  sourceContributions?: Map<string, SourceContribution[]>
): CanonicalizationResult {
  const known: Concept[] = [...existingGraph.concepts];

  const touched: Concept[] = [];
  const sources: ConceptSource[] = [];
  const questionPatterns: QuestionPattern[] = [];
  const candidates: ConceptCandidate[] = [];

  for (const concept of concepts) {
    const sourceDocumentId = concept.sourceDocuments[0];
    const contributions = getContributions(sourceDocumentId, sourceContributions);

    // Hard boundary: student-specific evidence never touches any
    // shared store, not even as a candidate. Recognized upstream
    // (raw checkpoint already preserved), stops here.
    if (contributions.includes("student-evidence")) {
      continue;
    }

    const canCreateConcepts =
      contributions.includes("core-knowledge") ||
      contributions.includes("depth-challenge");

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

      const existingHasCoreKnowledge = existing.sourceDocuments.some((id) =>
        isCoreKnowledgeSource(id, sourceContributions)
      );
      const incomingIsCoreKnowledge = contributions.includes("core-knowledge");

      // Only a core-knowledge source may establish/adopt display
      // fields, and only if the existing concept doesn't already
      // have core-knowledge backing — this preserves "first
      // source wins" among core-knowledge sources while letting a
      // core-knowledge source upgrade a concept that a non-core
      // source created first (e.g. Olympiad processed before
      // NCERT).
      const shouldAdoptDisplayFields =
        incomingIsCoreKnowledge && !existingHasCoreKnowledge;
      const displayBase = shouldAdoptDisplayFields ? concept : existing;

      const isNewAlias =
        normalizeConceptName(concept.name) !== normalizeConceptName(existing.name) &&
        !existing.aliases.some(
          (alias) => normalizeConceptName(alias) === normalizeConceptName(concept.name)
        );

      canonical = {
        ...displayBase,
        id: existing.id,
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
          ...displayBase.metadata,
          sourceDocuments: unionStrings(
            existing.metadata.sourceDocuments,
            concept.sourceDocuments
          ),
          updatedAt: concept.metadata.updatedAt,
        },
      };
    } else if (!canCreateConcepts) {
      // "new" or "ambiguous", but this source isn't authorized to
      // create a canonical concept on its own (e.g. a worksheet,
      // exam, or answer-key whose concept doesn't match anything
      // existing). Reuse the existing candidate mechanism rather
      // than inventing a new one — no Concept, ConceptSource, or
      // QuestionPattern is produced for it.
      candidates.push({
        id: `${slugify(concept.name)}__${sourceDocumentId}`,
        extractedName: concept.name,
        sourceDocumentId,
        reason:
          resolution.status === "ambiguous"
            ? "matches more than one existing canonical concept"
            : "source type is not authorized to create new canonical concepts",
        possibleMatches:
          resolution.status === "ambiguous" ? resolution.candidates : [],
        status: "pending",
        createdAt: concept.metadata.createdAt,
      });

      continue;
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
          reason: "matches more than one existing canonical concept",
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

    if (contributions.includes("core-knowledge")) {
      sources.push(buildConceptSource(concept, canonical.id, sourceDocumentId));
    }

    for (const contribution of QUESTION_PATTERN_CONTRIBUTIONS) {
      if (contributions.includes(contribution)) {
        questionPatterns.push(
          buildQuestionPattern(concept, canonical.id, sourceDocumentId, contribution)
        );
      }
    }
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
    questionPatterns,
    candidates,
  };
}
