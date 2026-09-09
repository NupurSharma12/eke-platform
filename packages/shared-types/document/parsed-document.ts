/**
 * Transient page-image evidence for a page that has no usable
 * extracted text (e.g. a scanned/photographed textbook page).
 * Produced by parseDocument() at parse time, never persisted —
 * DocumentStructureExtractorService attaches these directly to an
 * LLM request rather than writing them to disk.
 */
export interface ParsedDocumentPageImage {
  base64: string;

  mediaType: "image/jpeg" | "image/png";
}

export interface ParsedDocument {
  id: string;

  filename: string;

  kind: "pdf";

  text: string;

  pages: string[];

  /**
   * Optional, parallel to `pages` (same length, same 1-indexed page
   * order: `pageImages[i]` is the image for `pages[i]`, i.e. PAGE
   * i+1). An entry is non-null only for a page whose extracted text
   * was empty — a page with real text never carries an image, even
   * if one could be rendered. Omitted entirely when every page has
   * usable text, so existing text-only consumers see no shape
   * change.
   */
  pageImages?: Array<ParsedDocumentPageImage | null>;

  /**
   * OCR enrichment, added by enrichWithOcr() — never by
   * parseDocument() itself, and never by mutating an existing
   * ParsedDocument. All three arrays are optional and, when present,
   * parallel to `pages` (same length, same 1-indexed page order).
   * `pages[i]` itself is never overwritten with OCR text — it
   * remains exactly what parseDocument() extracted from the PDF's
   * own text layer, empty or not.
   */

  /** OCR-transcribed text for pages[i], or null if OCR was not run or produced nothing usable. */
  pageOcrText?: Array<string | null>;

  /**
   * Where pages[i]'s *usable* text came from: "pdf" (pages[i] itself
   * is real PDF-native text), "ocr" (pageOcrText[i] is usable), or
   * null (neither — no usable text is available for this page at
   * all, whether because no OCR was attempted or because it was
   * attempted and produced nothing usable).
   */
  pageTextSources?: Array<"pdf" | "ocr" | null>;

  /** The reason OCR could not produce a result for pages[i], or null if OCR wasn't attempted or succeeded. */
  pageOcrErrors?: Array<string | null>;
}