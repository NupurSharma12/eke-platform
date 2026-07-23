import {
  ConceptExtractionResult,
  ExtractionInput,
} from "../../shared-types";
import {
  ConceptExtractionResultSchema,
} from "../schemas/concept-extraction.schema";
import { ConceptExtractor } from "./ConceptExtractor";
import { AIProvider } from "../providers/AIProvider";
import { isImageCapableProvider } from "../providers/ImageCapableProvider";
import { buildConceptExtractionPrompt } from "../prompts/concept-extraction.prompt";
import { buildImageConceptExtractionPrompt } from "../prompts/image-concept-extraction.prompt";

export class ClaudeConceptExtractor
  implements ConceptExtractor
{
  constructor(
    private readonly provider: AIProvider
  ) {}

  async extract(
    input: ExtractionInput
  ): Promise<ConceptExtractionResult> {
    const response =
      input.kind === "image"
        ? await this.extractFromImage(input)
        : await this.extractFromText(input);

    const rawResult = JSON.parse(response);

    return ConceptExtractionResultSchema.parse(
      rawResult
    );
  }

  private async extractFromText(
    document: Extract<ExtractionInput, { kind: "pdf" }>
  ): Promise<string> {
    const prompt = buildConceptExtractionPrompt(document.text);

    return this.provider.generate(prompt);
  }

  private async extractFromImage(
    image: Extract<ExtractionInput, { kind: "image" }>
  ): Promise<string> {
    if (!isImageCapableProvider(this.provider)) {
      throw new Error(
        `The configured AI provider does not support image-based extraction ` +
        `(required for "${image.filename}"). Use an image-capable provider ` +
        `such as ClaudeProvider.`
      );
    }

    const prompt = buildImageConceptExtractionPrompt();

    return this.provider.generateFromImages(
      [{ base64: image.base64, mediaType: image.mediaType }],
      prompt
    );
  }
}
