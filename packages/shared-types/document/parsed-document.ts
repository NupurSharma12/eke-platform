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
}