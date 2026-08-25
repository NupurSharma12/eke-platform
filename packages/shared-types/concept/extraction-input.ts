import { ParsedDocument } from "../document/parsed-document";

export type ImageMediaType = "image/jpeg" | "image/png";

/**
 * One photographed/scanned page prepared for image-based
 * extraction. Sibling of ParsedDocument: same identity shape
 * (id/filename), same role in the pipeline (the thing
 * ConceptExtractor.extract() consumes), different content.
 */
export interface ImageDocument {
  id: string;

  filename: string;

  kind: "image";

  base64: string;

  mediaType: ImageMediaType;
}

/**
 * Everything ConceptExtractor.extract() can accept. Both variants
 * produce the same ConceptExtractionResult — the extraction
 * output format never depends on which of these was used, which
 * is what lets normalization/canonicalization/graph-building stay
 * completely unaware that images exist at all.
 */
export type ExtractionInput = ParsedDocument | ImageDocument;
