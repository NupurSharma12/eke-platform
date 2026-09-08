import { AIProvider } from "./AIProvider";
import { ImageCapableProvider, ProviderImage, isImageCapableProvider } from "./ImageCapableProvider";
import { isFallbackEligibleError } from "./isFallbackEligibleError";

/**
 * One entry in a provider chain: a name (for diagnostics/tests only,
 * never exposed to an LLM) and a factory that constructs the actual
 * AIProvider. A factory, not an already-built instance, so that a
 * provider whose API key is missing only fails — and is skipped —
 * at the moment it's actually this entry's turn, rather than at
 * chain-construction time (see buildProviderChain.ts's own doc
 * comment: "an unused missing API key must not break the whole
 * application").
 */
export interface NamedProviderFactory {
  name: string;
  create: () => AIProvider;
}

interface AttemptRecord {
  name: string;
  reason: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thrown only once every configured provider has been tried (or
 * skipped) and none produced a usable result. Carries which
 * providers were attempted and why, without ever including request
 * headers/API keys — every message that reaches here already came
 * from a provider's own thrown Error (never a raw request object),
 * and this class only ever stores `.message` strings.
 */
export class AllProvidersFailedError extends Error {
  readonly attempts: AttemptRecord[];

  constructor(attempts: AttemptRecord[]) {
    super(
      `All configured providers failed: ${attempts
        .map((a) => `${a.name} (${a.reason})`)
        .join("; ")}`
    );
    this.name = "AllProvidersFailedError";
    this.attempts = attempts;
  }
}

/** Distinct message so a caller can tell "nothing supports images" apart from "everyone failed." */
export class NoImageCapableProviderError extends Error {
  constructor(attemptedNames: string[]) {
    super(
      `None of the configured providers support image-based extraction ` +
      `(attempted: ${attemptedNames.join(", ") || "none"}). ` +
      `Configure an image-capable provider such as Claude or Gemini.`
    );
    this.name = "NoImageCapableProviderError";
  }
}

const SKIP = Symbol("skip");
type SkipResult = typeof SKIP;

/**
 * Composes a chain of provider factories into a single AIProvider
 * (and ImageCapableProvider): each `generate`/`generateFromImages`
 * call tries the chain in order, moving to the next entry only on a
 * failure isFallbackEligibleError() recognizes as provider-shaped —
 * anything else (a Zod error, an unrelated application error)
 * propagates immediately, exactly as it would from a single
 * unwrapped provider. This is the only place fallback decisions are
 * made; every existing extractor/generator consumer still just calls
 * `provider.generate(prompt)` and has no idea a chain exists.
 *
 * `generateFromImages` skips (not fails) any entry whose constructed
 * provider isn't image-capable — Groq is never asked to pretend it
 * supports images. If every entry is skipped this way (none are
 * image-capable) rather than failed, a distinct NoImageCapableProviderError
 * is thrown instead of the generic AllProvidersFailedError, so a
 * caller can tell "nothing here can do this at all" apart from
 * "every image-capable provider tried and failed."
 */
export function withFallback(
  chain: NamedProviderFactory[]
): AIProvider & ImageCapableProvider {
  async function tryChain<T>(
    attempt: (provider: AIProvider) => Promise<T | SkipResult>
  ): Promise<T> {
    const failures: AttemptRecord[] = [];
    const skipped: string[] = [];

    for (const entry of chain) {
      let provider: AIProvider;
      try {
        provider = entry.create();
      } catch (error) {
        failures.push({ name: entry.name, reason: errorMessage(error) });
        continue;
      }

      let result: T | SkipResult;
      try {
        result = await attempt(provider);
      } catch (error) {
        if (!isFallbackEligibleError(error)) {
          throw error;
        }
        failures.push({ name: entry.name, reason: errorMessage(error) });
        continue;
      }

      if (result === SKIP) {
        skipped.push(entry.name);
        continue;
      }

      return result;
    }

    if (failures.length === 0 && skipped.length > 0 && skipped.length === chain.length) {
      throw new NoImageCapableProviderError(skipped);
    }

    throw new AllProvidersFailedError(failures);
  }

  return {
    generate: (prompt: string) => tryChain((provider) => provider.generate(prompt)),

    generateFromImages: (images: ProviderImage[], prompt: string) =>
      tryChain((provider) => {
        if (!isImageCapableProvider(provider)) {
          return Promise.resolve(SKIP);
        }
        return provider.generateFromImages(images, prompt);
      }),
  };
}
