import {
  ParsedDocument,
  ObservedQuestionEvidence,
  ObservedQuestionEvidenceType,
} from "../../shared-types";
import { QuestionPatternEvidenceExtractionResultSchema } from "../schemas/question-pattern-evidence.schema";
import { QuestionPatternEvidenceExtractor } from "./QuestionPatternEvidenceExtractor";
import { AIProvider } from "../providers/AIProvider";
import { buildDocumentEvidenceText } from "../prompts/documentEvidence";
import { buildQuestionPatternEvidencePrompt } from "../prompts/question-pattern-evidence.prompt";

/** Fixed, deterministic order — independent of the order pages happen to contribute each tier while scanning a range. */
const EVIDENCE_TYPE_ORDER: ObservedQuestionEvidenceType[] = ["text", "ocr", "vision"];

/**
 * Derives which evidence tier(s) actually back pages [start, end]
 * (1-indexed, inclusive) of `document` — never trusted from the LLM.
 * Mirrors exactly the conditions buildDocumentEvidenceText() itself
 * uses to decide what reaches the prompt for a given page, so
 * evidenceTypes always reflects what evidence the model could
 * actually have seen, never a claim broader than that.
 */
function deriveEvidenceTypes(
  document: ParsedDocument,
  start: number,
  end: number
): ObservedQuestionEvidenceType[] {
  const present = new Set<ObservedQuestionEvidenceType>();

  for (let pageNumber = start; pageNumber <= end; pageNumber++) {
    const index = pageNumber - 1;

    const pageText = document.pages[index];
    if (pageText && pageText.trim().length > 0) {
      present.add("text");
    }

    const ocrText = document.pageOcrText?.[index];
    if (
      document.pageTextSources?.[index] === "ocr" &&
      ocrText &&
      ocrText.trim().length > 0
    ) {
      present.add("ocr");
    }

    const vision = document.pageVisionAnalysis?.[index];
    if (vision && vision.visualElements.length > 0) {
      present.add("vision");
    }
  }

  return EVIDENCE_TYPE_ORDER.filter((type) => present.has(type));
}

/**
 * Turns a ParsedDocument into ObservedQuestionEvidence[] via one LLM
 * call, validated through QuestionPatternEvidenceExtractionResultSchema,
 * then further checked against this document's actual page count —
 * same two-stage validation DocumentStructureExtractorService already
 * applies to ranges (shape validated by the schema in isolation, page
 * bounds validated here against the real document).
 *
 * Every application-owned field (id, sourceDocumentId, status,
 * extractedAt, evidenceTypes) is assigned here, by this code, never
 * trusted from the LLM response — same discipline every other
 * extractor in this codebase already applies to provenance/identity
 * facts.
 */
export class ClaudeQuestionPatternEvidenceExtractor
  implements QuestionPatternEvidenceExtractor
{
  constructor(private readonly provider: AIProvider) {}

  async extract(document: ParsedDocument): Promise<ObservedQuestionEvidence[]> {
    const documentEvidence = buildDocumentEvidenceText(document);
    const prompt = buildQuestionPatternEvidencePrompt(documentEvidence);

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    const validated = QuestionPatternEvidenceExtractionResultSchema.parse(rawResult);

    const pageCount = document.pages.length;
    const extractedAt = new Date().toISOString();

    return validated.questions.map((question, arrayIndex) => {
      if (question.startPage > pageCount || question.endPage > pageCount) {
        throw new Error(
          `Question-pattern evidence extraction returned a question spanning pages ` +
          `${question.startPage}-${question.endPage}, but "${document.id}" only has ` +
          `${pageCount} page(s).`
        );
      }

      const evidenceTypes = deriveEvidenceTypes(
        document,
        question.startPage,
        question.endPage
      );

      if (evidenceTypes.length === 0) {
        throw new Error(
          `Question-pattern evidence extraction returned a question on pages ` +
          `${question.startPage}-${question.endPage} of "${document.id}", but no ` +
          `underlying evidence (native text, OCR, or vision) could be found for ` +
          `those pages.`
        );
      }

      const questionIndex = arrayIndex + 1;

      return {
        id: `${document.id}::p${question.startPage}-${question.endPage}::q${questionIndex}`,
        sourceDocumentId: document.id,
        page: {
          start: question.startPage,
          end: question.endPage,
        },
        evidenceTypes,
        sectionLabel: question.sectionLabel ?? null,
        observedText: question.observedText,
        status: "pending",
        extractedAt,
      };
    });
  }
}
