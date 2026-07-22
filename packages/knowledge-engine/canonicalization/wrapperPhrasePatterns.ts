/**
 * A small, explicit, curated list of "framing" phrase patterns
 * that are safe to strip when trying to resolve a reference to
 * an existing canonical concept.
 *
 * This is deliberately NOT a generic similarity/substring rule.
 * Generic word-overlap would incorrectly treat "Equivalent
 * Fractions" as a near-match for "Fractions" (they share the
 * token "Fractions"), when in curriculum content an added
 * qualifier almost always signals a distinct child concept, not
 * a synonym. Each pattern here only strips a known-safe wrapper
 * ("Understanding of ___", "___ Concepts", ...); it never
 * matches on a shared word appearing anywhere in the phrase.
 *
 * Stripping is single-pass (not recursive), so compound wrapping
 * like "Basic Understanding of Fractions" is intentionally left
 * unresolved rather than guessed at — see canonicalizeConcepts's
 * docs for that tradeoff.
 */
const WRAPPER_PATTERNS: RegExp[] = [
  /^understanding of (.+)$/i,
  /^introduction to (.+)$/i,
  /^basics? of (.+)$/i,
  /^basic (.+)$/i,
  /^(.+) concepts?$/i,
];

/**
 * Returns the core phrase with a known wrapper stripped, or null
 * if no pattern applies.
 */
export function stripWrapperPhrase(text: string): string | null {
  const trimmed = text.trim();

  for (const pattern of WRAPPER_PATTERNS) {
    const match = trimmed.match(pattern);

    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }

  return null;
}
