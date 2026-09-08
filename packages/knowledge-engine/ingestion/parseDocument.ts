import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

import { ParsedDocument, ParsedDocumentPageImage } from "../../shared-types";

export async function parseDocument(
  filePath: string
): Promise<ParsedDocument> {
  const pdfBuffer = await fs.readFile(filePath);

  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  const parser = new PDFParse({
    data: arrayBuffer,
  });

  const result = await parser.getText();

  const filename = path.basename(filePath);

  // result.pages is the parser's own authoritative per-page split
  // (each entry carries the page's real text and its 1-indexed
  // `num`), already returned in page order — sorted defensively
  // rather than assumed, since nothing about the library's contract
  // guarantees order. This replaces the previous
  // `result.text.split("\f")`, which silently collapsed to a single
  // "page" for any PDF whose flattened text contains no form-feed
  // characters (true of every real PDF checked so far) — result.text
  // itself is untouched, only how `pages` is derived changes.
  // Falls back to the whole flattened text as a single page only if
  // the parser genuinely returned no per-page data at all (should
  // not happen for a real PDF, but this keeps every document
  // representable by at least one page rather than an empty array).
  const pages =
    result.pages.length > 0
      ? [...result.pages].sort((a, b) => a.num - b.num).map((page) => page.text)
      : [result.text];

  // A page with an empty (post-trim) text layer is treated as
  // image-only for this milestone — no character-count heuristic,
  // exactly `page.text.trim().length === 0`. Only those pages are
  // rendered to an image; a page with any real text never is.
  const textlessPageNumbers = pages
    .map((pageText, index) => (pageText.trim().length === 0 ? index + 1 : null))
    .filter((pageNumber): pageNumber is number => pageNumber !== null);

  let pageImages: Array<ParsedDocumentPageImage | null> | undefined;

  if (textlessPageNumbers.length > 0) {
    const screenshots = await parser.getScreenshot({
      partial: textlessPageNumbers,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const screenshotByPageNumber = new Map(
      screenshots.pages.map((screenshot) => [screenshot.pageNumber, screenshot])
    );

    pageImages = pages.map((_pageText, index) => {
      const screenshot = screenshotByPageNumber.get(index + 1);
      if (!screenshot) {
        return null;
      }
      return {
        base64: Buffer.from(screenshot.data).toString("base64"),
        mediaType: "image/png",
      };
    });
  }

  return {
    id: filename,
    filename,
    kind: "pdf",
    text: result.text,
    pages,
    ...(pageImages ? { pageImages } : {}),
  };
}