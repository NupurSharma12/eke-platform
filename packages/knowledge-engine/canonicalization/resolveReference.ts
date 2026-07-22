import { Concept } from "../../shared-types";
import { slugify } from "../normalization/normalizeConcepts";
import { normalizeConceptName } from "./normalizeConceptName";
import { stripWrapperPhrase } from "./wrapperPhrasePatterns";

export interface ResolvedMatch {
  status: "matched";
  conceptId: string;
  tier: "exact" | "alias" | "wrapper-pattern";
}

export interface NewConcept {
  status: "new";
}

export interface AmbiguousMatch {
  status: "ambiguous";
  candidates: { conceptId: string; reason: string }[];
}

export type ReferenceResolution = ResolvedMatch | NewConcept | AmbiguousMatch;

function findByNormalizedName(
  normalized: string,
  knownConcepts: Concept[]
): Concept[] {
  return knownConcepts.filter(
    (concept) => normalizeConceptName(concept.name) === normalized
  );
}

/**
 * Resolves free text (a concept's own name, or a prerequisite /
 * leadsTo / relatedConcepts reference's name) against a set of
 * already-known canonical concepts, using only deterministic
 * rules — no LLM calls, no generic similarity scoring.
 *
 * Tiers, cheapest/most-certain first:
 *   1. Exact canonical id match (slugify(text) === concept.id)
 *      or exact normalized-name match.
 *   2. Confirmed alias match (concept.aliases).
 *   3. Curated wrapper-phrase stripping (see
 *      wrapperPhrasePatterns.ts), re-checked against tiers 1/2.
 *
 * If a tier finds more than one candidate, or a matched tier
 * would otherwise be skipped without a home for the concept, the
 * result is "ambiguous" rather than picking one — never merge
 * on a guess. If nothing matches at all, the result is "new".
 */
export function resolveReference(
  text: string,
  knownConcepts: Concept[]
): ReferenceResolution {
  const normalized = normalizeConceptName(text);
  const slug = slugify(text);

  const exactMatches = knownConcepts.filter(
    (concept) =>
      concept.id === slug || normalizeConceptName(concept.name) === normalized
  );

  if (exactMatches.length === 1) {
    return { status: "matched", conceptId: exactMatches[0].id, tier: "exact" };
  }
  if (exactMatches.length > 1) {
    return {
      status: "ambiguous",
      candidates: exactMatches.map((c) => ({
        conceptId: c.id,
        reason: "multiple existing concepts share this normalized name",
      })),
    };
  }

  const aliasMatches = knownConcepts.filter((concept) =>
    concept.aliases.some((alias) => normalizeConceptName(alias) === normalized)
  );

  if (aliasMatches.length === 1) {
    return { status: "matched", conceptId: aliasMatches[0].id, tier: "alias" };
  }
  if (aliasMatches.length > 1) {
    return {
      status: "ambiguous",
      candidates: aliasMatches.map((c) => ({
        conceptId: c.id,
        reason: "multiple existing concepts have this as a confirmed alias",
      })),
    };
  }

  const strippedCore = stripWrapperPhrase(text);

  if (strippedCore !== null) {
    const strippedNormalized = normalizeConceptName(strippedCore);
    const coreMatches = findByNormalizedName(strippedNormalized, knownConcepts);

    if (coreMatches.length === 1) {
      return {
        status: "matched",
        conceptId: coreMatches[0].id,
        tier: "wrapper-pattern",
      };
    }
    if (coreMatches.length > 1) {
      return {
        status: "ambiguous",
        candidates: coreMatches.map((c) => ({
          conceptId: c.id,
          reason: `wrapper-stripped name "${strippedCore}" matches multiple existing concepts`,
        })),
      };
    }
  }

  return { status: "new" };
}
