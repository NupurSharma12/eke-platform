import { AIProvider } from "./AIProvider";
import { ImageCapableProvider, isImageCapableProvider } from "./ImageCapableProvider";

export interface RetryOptions {
  /** Maximum number of retry attempts after the first failure. */
  maxRetries?: number;

  /** Used only when a rate-limit error doesn't specify its own retry delay. */
  fallbackDelayMs?: number;

  /** Injectable so tests never actually wait. Defaults to a real timer-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_FALLBACK_DELAY_MS = 5000;

type ResolvedRetryOptions = Required<RetryOptions>;

interface ErrorLike {
  status?: number;
  statusCode?: number;
  name?: string;
  message?: string;
  headers?: { get?: (name: string) => string | null };
}

/**
 * Detects a rate-limit failure across providers without depending
 * on any one SDK's error class. Anthropic and the Gemini SDK both
 * expose a numeric HTTP status (429 for rate limiting) — that's
 * the primary, reliable signal. The message-text check is a
 * fallback for SDKs that don't surface a clean status code.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as ErrorLike;

  if (err.status === 429 || err.statusCode === 429) {
    return true;
  }

  const text = `${err.name ?? ""} ${err.message ?? ""}`;
  return /RESOURCE_EXHAUSTED|rate.?limit|too many requests/i.test(text);
}

/**
 * Extracts a provider-specified retry delay in milliseconds, if
 * one is available — from a standard `Retry-After` response
 * header (Anthropic), or parsed out of the error message text
 * (Gemini's free-tier RESOURCE_EXHAUSTED errors embed
 * "retryDelay: 42 seconds" directly in the message rather than a
 * structured field). Returns null when no delay can be
 * determined, so the caller can fall back to a configured default.
 */
export function extractRetryDelayMs(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const err = error as ErrorLike;

  const retryAfterHeader = err.headers?.get?.("retry-after");
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }
  }

  const match = err.message?.match(
    /retry[-_ ]?delay["'\s:]*(\d+(?:\.\d+)?)\s*s/i
  );
  if (match) {
    return Number(match[1]) * 1000;
  }

  return null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry<T>(
  operation: () => Promise<T>,
  options: ResolvedRetryOptions
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= options.maxRetries) {
        throw error;
      }

      const delayMs = extractRetryDelayMs(error) ?? options.fallbackDelayMs;
      await options.sleep(delayMs);
    }
  }
}

/**
 * Wraps any AIProvider (and, if present, ImageCapableProvider)
 * with rate-limit retry behavior. Provider-agnostic — it only
 * relies on generic HTTP-429-style error shapes, never a specific
 * SDK's types, so the same wrapper works for Claude, Groq,
 * Gemini, or any future provider without modifying any of them.
 *
 * Adds no delay at all to the normal successful path: `operation()`
 * is always tried first, and only a caught rate-limit error
 * triggers a wait before retrying. Retries are capped by
 * `maxRetries` (default 3) to avoid an unbounded loop; once
 * exhausted, the original error propagates.
 */
export function withRetry<T extends AIProvider>(
  provider: T,
  options: RetryOptions = {}
): T {
  const resolved: ResolvedRetryOptions = {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    fallbackDelayMs: options.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS,
    sleep: options.sleep ?? defaultSleep,
  };

  const wrapped: AIProvider & Partial<ImageCapableProvider> = {
    generate: (prompt: string) =>
      callWithRetry(() => provider.generate(prompt), resolved),
  };

  if (isImageCapableProvider(provider)) {
    wrapped.generateFromImages = (images, prompt) =>
      callWithRetry(() => provider.generateFromImages(images, prompt), resolved);
  }

  return wrapped as T;
}
