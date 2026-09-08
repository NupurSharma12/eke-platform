import { AIProvider } from "./AIProvider";

/**
 * OpenRouter's own "free router" — automatically routes a request
 * to whichever free model OpenRouter currently has available, per
 * OpenRouter's own routing behavior, rather than this codebase
 * pinning one specific free model that could be discontinued at any
 * time. Configurable per instance (see buildProviderChain.ts) for
 * anyone who wants to target a specific OpenRouter model instead.
 */
export const OPENROUTER_DEFAULT_MODEL = "openrouter/free";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

/** The minimal fetch shape this provider needs — real `fetch` satisfies it; tests inject a fake. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

interface OpenRouterChatCompletion {
  choices?: { message?: { content?: string | null } }[];
}

/**
 * No OpenAI-compatible SDK is already present in this repository
 * (grepped package.json — only @anthropic-ai/sdk, groq-sdk,
 * @google/genai exist), and OpenRouter's chat/completions endpoint
 * is a plain OpenAI-compatible REST call — a minimal fetch-based
 * implementation avoids adding a dependency for this one endpoint,
 * per this milestone's own instruction to prefer that over a new
 * SDK.
 */
export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private fetchImpl: FetchLike;

  /**
   * `model` defaults to OPENROUTER_DEFAULT_MODEL ("openrouter/free").
   * `fetchImpl` is optional and only meant for tests, mirroring the
   * injectable-client pattern already used by GeminiProvider/
   * GroqProvider — omit it for real usage and the global `fetch` is
   * used.
   */
  constructor(model: string = OPENROUTER_DEFAULT_MODEL, fetchImpl: FetchLike = fetch) {
    this.model = model;
    this.fetchImpl = fetchImpl;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not configured"
      );
    }

    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.fetchImpl(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      // Never include request headers (which carry the API key) in
      // the thrown error — only the response's own status/body.
      const bodyText = await response.text().catch(() => "");
      const error = new Error(
        `OpenRouter request failed: ${response.status} ${response.statusText}${
          bodyText ? ` — ${bodyText}` : ""
        }`
      ) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    const data = (await response.json()) as OpenRouterChatCompletion;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(
        "OpenRouter returned no text response"
      );
    }

    return content;
  }
}
