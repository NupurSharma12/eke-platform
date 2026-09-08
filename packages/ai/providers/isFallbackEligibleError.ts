import { isRateLimitError } from "./withRetry";

interface ErrorLike {
  status?: number;
  statusCode?: number;
  code?: string;
  name?: string;
  message?: string;
}

/**
 * Provider-independent classification of whether a failure is worth
 * retrying against a *different* provider. Deliberately fail-closed:
 * only failures that recognizably look like a provider-request
 * problem (rate limit, missing/invalid model, provider outage,
 * network/timeout, or that specific provider's own auth/config
 * error) are eligible. Anything unrecognized — most importantly a
 * Zod validation error or any other application-level error raised
 * *after* provider.generate() returns — is NOT eligible, matching
 * this milestone's explicit requirement: a different provider cannot
 * fix a caller's own malformed request or a downstream schema
 * mismatch, so silently trying one is more likely to hide a real bug
 * than to help.
 *
 * Reuses isRateLimitError (withRetry.ts) rather than duplicating its
 * detection — same reasoning: don't invent a second way to recognize
 * the same failure shape.
 */
export function isFallbackEligibleError(error: unknown): boolean {
  if (isRateLimitError(error)) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as ErrorLike;
  const status = err.status ?? err.statusCode;

  // Model unavailable/not found (e.g. a deprecated or mistyped
  // model id) or an authentication/authorization failure specific
  // to the provider that was just attempted.
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }

  // Transient server-side failure.
  if (typeof status === "number" && status >= 500 && status < 600) {
    return true;
  }

  const text = `${err.name ?? ""} ${err.message ?? ""}`;

  // This project's own providers throw a plain Error with this exact
  // message when their API key env var is unset (see
  // ClaudeProvider/GroqProvider/GeminiProvider/OpenRouterProvider) —
  // a configuration failure for *that* provider, not a reason to
  // fail the whole request when another configured provider might
  // still work.
  if (/API_KEY is not configured/i.test(text)) {
    return true;
  }

  if (/model.*(not found|does not exist|unavailable|decommissioned)/i.test(text)) {
    return true;
  }

  if (/\b(timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network)\b/i.test(text)) {
    return true;
  }

  if (err.code === "ETIMEDOUT" || err.code === "ECONNRESET" || err.code === "ENOTFOUND") {
    return true;
  }

  return false;
}
