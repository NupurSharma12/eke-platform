import { GoogleGenAI } from "@google/genai";

import { ProviderImage } from "./ImageCapableProvider";
import { VisionProvider, VisionAnalysisResult } from "./VisionProvider";
import { VisionAnalysisResultSchema } from "../schemas/vision-page-analysis.schema";
import { buildVisionPageAnalysisPrompt } from "../prompts/vision-page-analysis.prompt";

/** Same default/resolution convention as GeminiProvider's own DEFAULT_MODEL — see that file's doc comment. */
const DEFAULT_MODEL = "gemini-flash-latest";

/**
 * The minimal shape GeminiVisionProvider actually needs from the
 * Google GenAI client — same pattern as GeminiProvider's own
 * GeminiClient, extended with the `config` param this class needs
 * (GeminiProvider's own client interface doesn't expose it, since
 * text/image extraction there returns a raw string parsed
 * downstream, not JSON requested directly from the model). A real
 * `GoogleGenAI` instance satisfies this structurally; tests inject a
 * fake implementing just this.
 */
export interface GeminiVisionClient {
  models: {
    generateContent(params: {
      model: string;
      contents: unknown;
      config?: { responseMimeType?: string };
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

/**
 * First VisionProvider implementation — Gemini, via the same
 * @google/genai SDK GeminiProvider already depends on (no new
 * dependency). Requests JSON output directly (config.responseMimeType,
 * the same structured-output mechanism GeminiProvider itself doesn't
 * need but this class does, since its contract is a specific typed
 * result rather than a raw string), then validates the response
 * through VisionAnalysisResultSchema before returning it — the model
 * is never trusted to have actually produced valid JSON matching the
 * contract.
 */
export class GeminiVisionProvider implements VisionProvider {
  private client: GeminiVisionClient;
  readonly model: string;

  /**
   * `client` is optional and only meant for tests, mirroring
   * GeminiProvider's identical constructor pattern — omit it for
   * real usage and a real GoogleGenAI client is constructed from
   * GEMINI_API_KEY.
   *
   * `model` resolution mirrors GeminiProvider: explicit constructor
   * argument, then GEMINI_MODEL, then DEFAULT_MODEL — so both
   * classes pick up the same environment configuration without
   * sharing code that would otherwise couple them together.
   */
  constructor(client?: GeminiVisionClient, model?: string) {
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

  async analyzePage(
    image: ProviderImage,
    prompt?: string
  ): Promise<VisionAnalysisResult> {
    const effectivePrompt = prompt ?? buildVisionPageAnalysisPrompt();

    const response = await this.client.models.generateContent({
      model: this.model,

      contents: [
        {
          inlineData: {
            data: image.base64,
            mimeType: image.mediaType,
          },
        },
        {
          text: effectivePrompt,
        },
      ],

      config: {
        responseMimeType: "application/json",
      },
    });

    const text = extractText(response);

    let rawResult: unknown;
    try {
      rawResult = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Gemini vision analysis returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return VisionAnalysisResultSchema.parse(rawResult);
  }
}
