import { z } from "zod";

export const VisualElementSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
});

/**
 * `visibleText` is intentionally not min(1) — a page that is
 * genuinely all-diagram with no legible text is a valid result, not
 * a malformed one. `visualElements` may legitimately be an empty
 * array (a plain text page with nothing visually notable).
 */
export const VisionAnalysisResultSchema = z.object({
  visibleText: z.string(),
  visualElements: z.array(VisualElementSchema),
  educationalSignificance: z.string().min(1),
});
