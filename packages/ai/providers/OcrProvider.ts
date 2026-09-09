import { ProviderImage } from "./ImageCapableProvider";

/**
 * A mechanical text-transcription capability, deliberately separate
 * from AIProvider/ImageCapableProvider: OCR does not generate or
 * interpret content the way an LLM call does, so it does not
 * participate in the provider fallback chain, retry composition, or
 * any of the LLM-specific machinery in this package — it's a plain,
 * standalone contract. Reuses ProviderImage (the same {base64,
 * mediaType} shape ImageCapableProvider already uses) rather than
 * introducing another image representation.
 */
export interface OcrProvider {
  extractText(image: ProviderImage): Promise<string>;
}
