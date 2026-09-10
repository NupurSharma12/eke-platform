import { ParsedDocument } from "../../shared-types";

/**
 * Formats a ParsedDocument's per-page evidence — native PDF text,
 * OCR text (only where it's actually the page's usable source), and
 * vision-derived visual elements — into one page-labelled text block
 * suitable for a text-only extraction prompt (see
 * buildConceptExtractionPrompt). This is a pure formatting step, not
 * a new extraction stage: it changes what text an extractor sends to
 * the model, never how the model's response is parsed/validated.
 *
 * Rules, matching this milestone's explicit evidence-representation
 * requirements:
 *
 * - Native text (`pages[i]`) is always the primary textual source
 *   for a page and is included whenever non-empty.
 * - OCR text is included only when `pageTextSources[i] === "ocr"`
 *   (i.e. it's actually this page's *usable* text source, which
 *   under enrichWithOcr's own rule only happens when the native
 *   text was empty) — never duplicated alongside native text.
 * - Vision evidence contributes only `visualElements` (type +
 *   description), never `visibleText` — VisionAnalysisResult.visibleText
 *   is deliberately never treated as a text source here, per this
 *   milestone's explicit instruction not to let it replace native
 *   PDF text or OCR.
 *
 * Pages are always emitted in order (index 0 = PAGE 1), so calling
 * this twice on the same document is deterministic.
 */
export function buildDocumentEvidenceText(document: ParsedDocument): string {
  const sections = document.pages.map((pageText, index) => {
    const pageNumber = index + 1;
    const textSource = document.pageTextSources?.[index] ?? null;
    const ocrText = document.pageOcrText?.[index] ?? null;
    const vision = document.pageVisionAnalysis?.[index] ?? null;

    const lines: string[] = [`PAGE ${pageNumber}`];

    if (pageText.trim().length > 0) {
      lines.push("", "TEXT:", pageText);
    }

    if (textSource === "ocr" && ocrText && ocrText.trim().length > 0) {
      lines.push("", "OCR:", ocrText);
    }

    if (vision && vision.visualElements.length > 0) {
      lines.push("", "VISUAL EVIDENCE:");
      for (const element of vision.visualElements) {
        lines.push(`- ${element.type}: ${element.description}`);
      }
    }

    if (lines.length === 1) {
      lines.push("", "(no extracted text or visual evidence for this page)");
    }

    return lines.join("\n");
  });

  return sections.join("\n\n");
}
