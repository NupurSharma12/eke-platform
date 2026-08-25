import { GoogleGenAI } from "@google/genai";

import { AIProvider } from "./AIProvider";
import { ImageCapableProvider, ProviderImage } from "./ImageCapableProvider";

/**
 * "-latest" is a Google-managed alias, not a pinned dated model —
 * it always resolves to Google's current recommended flash-tier
 * model, so it doesn't go stale/deprecated the way a hardcoded
 * dated model (e.g. the previous "gemini-2.5-flash") eventually
 * does. Confirmed present in the installed @google/genai v2.13.0
 * SDK's own known-model list, alongside "gemini-pro-latest" and
 * "gemini-flash-lite-latest".
 */
const DEFAULT_MODEL = "gemini-flash-latest";

/**
 * The minimal shape GeminiProvider actually needs from the
 * Google GenAI client. A real `GoogleGenAI` instance satisfies
 * this structurally; tests inject a fake implementing just this,
 * so no real API key or network call is ever needed to test this
 * class.
 */
export interface GeminiClient {
  models: {
    generateContent(params: {
      model: string;
      contents: unknown;
    }): Promise<{ text?: string }>;
  };
}

function extractText(response: { text?: string }): string {
  if (!response.text) {
    throw new Error(
      "Gemini returned no text response"
    );
  }

  return response.text;
}

export class GeminiProvider implements AIProvider, ImageCapableProvider {
  private client: GeminiClient;
  private model: string;

  /**
   * `client` is optional and only meant for tests — omit it for
   * real usage and a real GoogleGenAI client is constructed from
   * GEMINI_API_KEY, exactly like ClaudeProvider/GroqProvider read
   * their own API keys.
   *
   * `model` is resolved once here and reused for both generate()
   * and generateFromImages(), so text and image extraction always
   * use the same model. Resolution order: explicit constructor
   * argument (tests), then GEMINI_MODEL, then DEFAULT_MODEL — the
   * same env-var-with-fallback convention already used elsewhere
   * in this project (e.g. AI_PROVIDER).
   */
  constructor(client?: GeminiClient, model?: string) {
    this.model = model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

    if (client) {
      this.client = client;
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured"
      );
    }

    this.client = new GoogleGenAI({
      apiKey,
    });
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,

      contents: prompt,
    });

    return extractText(response);
  }

  async generateFromImages(
    images: ProviderImage[],
    prompt: string
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,

      contents: [
        ...images.map((image) => ({
          inlineData: {
            data: image.base64,
            mimeType: image.mediaType,
          },
        })),
        {
          text: prompt,
        },
      ],
    });

    return extractText(response);
  }
}
