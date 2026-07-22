import {
  ConceptExtractionResult,
  ParsedDocument,
} from "../../shared-types";
import {
  ConceptExtractionResultSchema,
} from "../schemas/concept-extraction.schema";
import { ConceptExtractor } from "./ConceptExtractor";
import { AIProvider } from "../providers/AIProvider";
import { buildConceptExtractionPrompt } from "../prompts/concept-extraction.prompt";

export class ClaudeConceptExtractor
  implements ConceptExtractor
{
  constructor(
    private readonly provider: AIProvider
  ) {}

  async extract(
    document: ParsedDocument
  ): Promise<ConceptExtractionResult> {
    const prompt =
      buildConceptExtractionPrompt(document.text);

    const response =
      await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    return ConceptExtractionResultSchema.parse(
  rawResult
);  
  }
}