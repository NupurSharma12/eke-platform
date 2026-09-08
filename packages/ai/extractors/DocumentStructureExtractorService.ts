import { ParsedDocument, ParsedDocumentPageImage, DocumentStructureCandidate } from "../../shared-types";
import { DocumentStructureExtractionResultSchema } from "../schemas/document-structure-extraction.schema";
import { DocumentStructureExtractor } from "./DocumentStructureExtractor";
import { AIProvider } from "../providers/AIProvider";
import { ProviderImage, isImageCapableProvider } from "../providers/ImageCapableProvider";
import { buildDocumentStructureExtractionPrompt } from "../prompts/document-structure-extraction.prompt";

/**
 * Turns a ParsedDocument into a DocumentStructureCandidate via one
 * LLM call, built from document.pages (never document.text — see
 * DocumentStructureExtractor's own doc comment for why), validated
 * through DocumentStructureExtractionResultSchema, then further
 * checked against this specific document's actual page count before
 * anything is returned.
 *
 * Provenance (sourceDocumentId, extractedAt) and status are attached
 * here, by this code, never trusted from the LLM response — same
 * reasoning AssessmentStructureExtractorService and normalizeConcepts
 * already apply to sourceDocumentId ("the LLM is never trusted to
 * report identity/routing facts"). status is always "pending": this
 * extractor never produces, and this type cannot represent, anything
 * else — promoting a range to a confirmed Chapter is a separate,
 * human-confirmed step this class does not perform.
 */
export class ClaudeDocumentStructureExtractor
  implements DocumentStructureExtractor
{
  constructor(private readonly provider: AIProvider) {}

  async extract(document: ParsedDocument): Promise<DocumentStructureCandidate> {
    // Pages with no extractable text carry transient image evidence
    // instead (see ParsedDocumentPageImage) — collected here in page
    // order so both the prompt's "PAGE N ... attached image K of N"
    // labelling and the actual images sent to the provider agree on
    // ordering.
    const imagePages: Array<{ pageNumber: number; image: ParsedDocumentPageImage }> = [];
    (document.pageImages ?? []).forEach((image, index) => {
      if (image) {
        imagePages.push({ pageNumber: index + 1, image });
      }
    });
    const imagePageNumbers = imagePages.map((entry) => entry.pageNumber);

    const prompt = buildDocumentStructureExtractionPrompt(document.pages, imagePageNumbers);

    let response: string;

    if (imagePageNumbers.length > 0) {
      if (!isImageCapableProvider(this.provider)) {
        throw new Error(
          `Document structure extraction for "${document.id}" requires an ` +
          `image-capable AI provider: ${imagePageNumbers.length} page(s) ` +
          `(${imagePageNumbers.join(", ")}) have no extractable text and ` +
          `must be read as images, but the configured provider does not ` +
          `support image input.`
        );
      }

      const images: ProviderImage[] = imagePages.map(({ image }) => ({
        base64: image.base64,
        mediaType: image.mediaType,
      }));

      response = await this.provider.generateFromImages(images, prompt);
    } else {
      response = await this.provider.generate(prompt);
    }

    const rawResult = JSON.parse(response);

    const validated = DocumentStructureExtractionResultSchema.parse(rawResult);

    // The schema validates shape in isolation (positive integers,
    // startPage <= endPage) but has no access to this document's
    // actual page count. A range the model reports against a page
    // that doesn't exist in this document is not a shape problem —
    // it's a fabricated boundary, and must not become a persisted
    // candidate.
    const pageCount = document.pages.length;
    for (const range of validated.ranges) {
      if (range.endPage > pageCount) {
        throw new Error(
          `Document structure extraction returned a range ending at page ${range.endPage}, ` +
          `but "${document.id}" only has ${pageCount} page(s).`
        );
      }
    }

    return {
      sourceDocumentId: document.id,
      ranges: validated.ranges,
      status: "pending",
      extractedAt: new Date().toISOString(),
    };
  }
}
