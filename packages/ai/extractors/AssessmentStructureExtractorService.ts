import { ParsedDocument, AssessmentStructureEvidence } from "../../shared-types";
import { AssessmentStructureExtractionResultSchema } from "../schemas/assessment-structure-extraction.schema";
import { AssessmentStructureExtractor } from "./AssessmentStructureExtractor";
import { AIProvider } from "../providers/AIProvider";
import { buildAssessmentStructureExtractionPrompt } from "../prompts/assessment-structure-extraction.prompt";
import { buildDocumentEvidenceText } from "../prompts/documentEvidence";

/**
 * Turns a ParsedDocument into AssessmentStructureEvidence via one
 * LLM call, validated through AssessmentStructureExtractionResultSchema
 * before anything else touches it.
 *
 * Provenance (sourceDocumentId, extractedAt) is attached here, by
 * this code, never trusted from the LLM response — same reasoning
 * normalizeConcepts already applies to sourceDocumentId ("the LLM
 * is never trusted to report identity/routing facts"). extractedAt
 * in particular is a wall-clock stamp from this call, not part of
 * what the LLM is asked to produce.
 */
export class ClaudeAssessmentStructureExtractor
  implements AssessmentStructureExtractor
{
  constructor(private readonly provider: AIProvider) {}

  async extract(
    document: ParsedDocument
  ): Promise<AssessmentStructureEvidence> {
    // Same unified evidence (native text, OCR where it's the page's
    // usable source, vision-derived visual elements) already used by
    // ConceptExtractorService — see buildDocumentEvidenceText's own
    // doc comment for the exact per-page rules. Reused as-is, not
    // reimplemented: this is a call-site change only.
    const documentText = buildDocumentEvidenceText(document);
    const prompt = buildAssessmentStructureExtractionPrompt(documentText);

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    const validated =
      AssessmentStructureExtractionResultSchema.parse(rawResult);

    return {
      sourceDocumentId: document.id,
      allocations: validated.allocations,
      extractedAt: new Date().toISOString(),
    };
  }
}
