const FRACTION_PATTERN = /(-?\d+)\s*\/\s*(\d+)/;
const DECIMAL_PATTERN = /-?\d+(?:\.\d+)?/;

/**
 * Extracts a single numeric value from a free-text answer string,
 * recognizing a plain number ("15", "6.4") or a simple "a/b"
 * fraction ("1/2") anywhere in the text. Not an expression
 * evaluator — no arithmetic, no multi-token parsing — just enough
 * to compare a stated answer against a visual spec's own numbers
 * (e.g. a fraction-bar's shadedParts/totalParts). Returns null when
 * no such value is present or the fraction's denominator is zero.
 */
export function parseNumericAnswer(text: string): number | null {
  const fractionMatch = text.match(FRACTION_PATTERN);
  if (fractionMatch) {
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) return null;
    return Number(fractionMatch[1]) / denominator;
  }

  const decimalMatch = text.match(DECIMAL_PATTERN);
  if (decimalMatch) {
    return Number(decimalMatch[0]);
  }

  return null;
}
