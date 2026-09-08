import Groq from "groq-sdk";

import { AIProvider } from "./AIProvider";

/**
 * Groq's currently-supported GPT-OSS models (verified against
 * current Groq model documentation as of this milestone) — the
 * previous hardcoded model ("llama-3.3-70b-versatile") had been
 * deprecated by Groq and returned a 404 model_not_found error for
 * every real request, confirmed live during Milestone 3B's own
 * manual verification. Exported so callers (in particular
 * buildProviderChain.ts) can reference them by name instead of
 * duplicating the literal strings.
 */
export const GROQ_MODEL_GPT_OSS_120B = "openai/gpt-oss-120b";
export const GROQ_MODEL_GPT_OSS_20B = "openai/gpt-oss-20b";

/** Preserves `new GroqProvider()` with no arguments as a valid call — now resolving to a working model instead of a deprecated one. */
const DEFAULT_MODEL = GROQ_MODEL_GPT_OSS_120B;

/**
 * The minimal shape GroqProvider actually needs from the Groq SDK
 * client — same pattern as GeminiProvider's own GeminiClient: a real
 * `Groq` instance satisfies this structurally, and tests can inject
 * a fake implementing just this, with no real API key or network
 * call needed.
 */
export interface GroqClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: { role: "user"; content: string }[];
        response_format: { type: "json_object" };
      }): Promise<{ choices: { message?: { content?: string | null } }[] }>;
    };
  };
}

export class GroqProvider implements AIProvider {
  private client: GroqClient;
  private model: string;

  /**
   * `model` defaults to GPT-OSS 120B, but is configurable per
   * instance so a fallback chain can hold both GPT-OSS 120B and
   * GPT-OSS 20B as two distinct GroqProvider instances (see
   * buildProviderChain.ts) — nothing about this class hardcodes one
   * specific model as the only possible choice.
   *
   * `client` is optional and only meant for tests, mirroring
   * GeminiProvider's identical constructor pattern — omit it for
   * real usage and a real Groq client is constructed from
   * GROQ_API_KEY.
   */
  constructor(model: string = DEFAULT_MODEL, client?: GroqClient) {
    this.model = model;

    if (client) {
      this.client = client;
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured"
      );
    }

    this.client = new Groq({
      apiKey,
    });
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      response_format: {
        type: "json_object",
      },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(
        "Groq returned no text response"
      );
    }

    return content;
  }
}
