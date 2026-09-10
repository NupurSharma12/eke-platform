import { ParsedDocument } from "./shared-types";
import { OcrProvider } from "./ai/providers/OcrProvider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Adds OCR text as a separate enrichment layer on top of an already
 * parsed document — never inside parseDocument() itself, and never
 * by mutating the document passed in. `pages[i]` and `pageImages[i]`
 * are carried through to the returned document exactly as they were;
 * this only ever adds/replaces the pageOcrText/pageTextSources/
 * pageOcrErrors arrays.
 *
 * A page is only ever sent to OCR when it has no usable PDF-native
 * text (pages[i].trim() is empty) AND a rendered image exists for it
 * (pageImages[i] is non-null) — a page with real PDF text is never
 * OCR'd, and a textless page with no image (should not normally
 * happen given parseDocument()'s own invariant, but not assumed
 * here) is left alone rather than fabricating a result.
 *
 * One page's OCR failure never fails the whole document: the error
 * is captured in pageOcrErrors[i] and every other page is still
 * processed.
 */
export async function enrichWithOcr(
  document: ParsedDocument,
  ocrProvider: OcrProvider
): Promise<ParsedDocument> {
  const pageCount = document.pages.length;

  const pageOcrText: Array<string | null> = new Array(pageCount).fill(null);
  const pageTextSources: Array<"pdf" | "ocr" | null> = new Array(pageCount).fill(null);
  const pageOcrErrors: Array<string | null> = new Array(pageCount).fill(null);

  for (let i = 0; i < pageCount; i++) {
    const pageText = document.pages[i];

    if (pageText.trim().length > 0) {
      pageTextSources[i] = "pdf";
      continue;
    }

    const image = document.pageImages?.[i] ?? null;

    if (!image) {
      continue;
    }

    try {
      const ocrText = await ocrProvider.extractText(image);
      pageOcrText[i] = ocrText;
      pageTextSources[i] = ocrText.trim().length > 0 ? "ocr" : null;
    } catch (error) {
      pageOcrErrors[i] = errorMessage(error);
    }
  }

  return {
    id: document.id,
    filename: document.filename,
    kind: document.kind,
    text: document.text,
    pages: document.pages,
    pageImages: document.pageImages,
    pageOcrText,
    pageTextSources,
    pageOcrErrors,
  };
}
