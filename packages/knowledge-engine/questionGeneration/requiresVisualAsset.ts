const VISUAL_ASSET_KEYWORDS = [
  "shaded region",
  "shaded area",
  "shaded part",
  "diagram",
  "graph",
  "chart",
  "figure",
  "image",
  "picture",
  "illustration",
  "angle figure",
];

const VISUAL_ASSET_PATTERN = new RegExp(
  `\\b(${VISUAL_ASSET_KEYWORDS.map((keyword) => keyword.replace(/ /g, "\\s+")).join("|")})\\b`,
  "i"
);

/**
 * Deterministic, narrow keyword check for text that depends on a
 * visual asset (a shaded-region diagram, a graph, a chart, an angle
 * figure, ...) the current data model has nowhere to attach. Not an
 * image/content classifier — just enough to keep an unrenderable
 * question from reaching a student, which is all this phase needs.
 */
export function requiresVisualAsset(text: string): boolean {
  return VISUAL_ASSET_PATTERN.test(text);
}
