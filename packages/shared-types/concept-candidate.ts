export interface ConceptCandidateMatch {
  conceptId: string;

  /** Short, deterministic explanation of why this concept was a possible match. */
  reason: string;
}

/**
 * A concept reference that canonicalization could not safely
 * resolve with certainty — either it matched more than one
 * existing canonical concept, or it was close enough to be worth
 * a human look without meeting any of the safe deterministic
 * match tiers.
 *
 * Ambiguous references are never silently merged and never
 * silently dropped: canonicalization still creates a real
 * canonical Concept for them (see canonicalizeConcepts), and
 * this record exists so that decision is visible and reviewable
 * rather than implicit.
 */
export interface ConceptCandidate {
  id: string;

  extractedName: string;

  sourceDocumentId: string;

  /** The canonical concept id that was provisionally created for this candidate. */
  createdConceptId: string;

  possibleMatches: ConceptCandidateMatch[];

  status: "pending";

  createdAt: string;
}
