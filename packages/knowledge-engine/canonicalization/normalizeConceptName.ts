/**
 * Normalizes a concept name/reference for comparison purposes
 * only (never used to generate a canonical id — that's
 * slugify's job).
 *
 * Lowercases, strips punctuation, collapses whitespace, and
 * folds a simple trailing plural ("Tessellations" ->
 * "tessellations" -> "tessellation") so that near-identical
 * surface forms compare equal. This is deliberately narrow: it
 * only strips a single trailing "s" on the whole normalized
 * phrase, and only when that's unlikely to be a false fold
 * (skips very short strings and words already ending "ss").
 */
export function normalizeConceptName(name: string): string {
  const collapsed = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const isFoldablePlural =
    collapsed.length > 3 &&
    collapsed.endsWith("s") &&
    !collapsed.endsWith("ss");

  return isFoldablePlural ? collapsed.slice(0, -1) : collapsed;
}
