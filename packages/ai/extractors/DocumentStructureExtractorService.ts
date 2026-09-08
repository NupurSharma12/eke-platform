import { ParsedDocument, DocumentStructureCandidate } from "../../shared-types";
import { DocumentStructureExtractionResultSchema } from "../schemas/document-structure-extraction.schema";
import { DocumentStructureExtractor } from "./DocumentStructureExtractor";
import { AIProvider } from "../providers/AIProvider";
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
    const prompt = buildDocumentStructureExtractionPrompt(document.pages);

    const response = await this.provider.generate(prompt);

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
