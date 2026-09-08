import { AIProvider } from "./AIProvider";
import { ClaudeProvider } from "./ClaudeProvider";
import { GroqProvider, GROQ_MODEL_GPT_OSS_120B, GROQ_MODEL_GPT_OSS_20B } from "./GroqProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OpenRouterProvider, OPENROUTER_DEFAULT_MODEL } from "./OpenRouterProvider";
import { resolveProviderName } from "./resolveProviderName";
import { withRetry } from "./withRetry";
import { withFallback, NamedProviderFactory } from "./FallbackAIProvider";

/**
 * Every fallback-chain-eligible provider name, and how to construct
 * it. Each factory is wrapped in withRetry() (rate-limit retry on
 * that one provider) before it's handed to the fallback chain — see
 * withFallback's own doc comment for why retry-then-fallback
 * composes this way rather than one mechanism reimplementing the
 * other: "provider A -> retry its rate-limit failure -> still fails
 * -> provider B -> retry -> provider C", exactly as this milestone's
 * own spec describes.
 *
 * A factory, not an eagerly-constructed instance, so a provider
 * whose API key is missing only throws — and is caught/skipped by
 * withFallback — the moment it's actually this entry's turn, never
 * at chain-build time. This is what makes "API keys are checked only
 * when a provider is actually used" true: buildProviderChain() never
 * touches process.env for any provider that never ends up needed.
 */
const PROVIDER_FACTORIES: Record<string, () => AIProvider> = {
  "groq-120b": () => withRetry(new GroqProvider(GROQ_MODEL_GPT_OSS_120B)),
  "groq-20b": () => withRetry(new GroqProvider(GROQ_MODEL_GPT_OSS_20B)),
  "openrouter-free": () => withRetry(new OpenRouterProvider(OPENROUTER_DEFAULT_MODEL)),
  claude: () => withRetry(new ClaudeProvider()),
  gemini: () => withRetry(new GeminiProvider()),
};

export const KNOWN_PROVIDER_CHAIN_NAMES = Object.keys(PROVIDER_FACTORIES);

function parseChainEnv(chainEnv: string): NamedProviderFactory[] {
  const names = chainEnv
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    throw new Error("AI_PROVIDER_CHAIN is set but contains no provider names");
  }

  return names.map((name) => {
    const factory = PROVIDER_FACTORIES[name];
    if (!factory) {
      throw new Error(
        `Unknown provider name "${name}" in AI_PROVIDER_CHAIN. ` +
        `Expected one of: ${KNOWN_PROVIDER_CHAIN_NAMES.join(", ")}`
      );
    }
    return { name, create: factory };
  });
}

/**
 * The single place every application/CLI entry point should get an
 * AIProvider from, replacing the identical construction ternary that
 * was previously duplicated across 6 call sites.
 *
 * - If AI_PROVIDER_CHAIN is set (e.g. "groq-120b,groq-20b,openrouter-free,claude"),
 *   returns a fallback-composed provider trying each named provider
 *   in order (see withFallback).
 * - Otherwise, falls back to the pre-existing single-provider
 *   behavior driven by AI_PROVIDER (resolveProviderName) — returned
 *   directly, NOT wrapped in withFallback, so behavior for anyone
 *   not opting into a chain is completely unchanged: no retry
 *   composition change, no new error type, same provider instance
 *   shape as before this milestone.
 *
 * `env` defaults to `process.env` but is overridable so callers
 * (and tests) never need to mutate real process.env to exercise
 * either path.
 */
export function buildProviderChain(env: NodeJS.ProcessEnv = process.env): AIProvider {
  const chainEnv = env.AI_PROVIDER_CHAIN;

  if (chainEnv && chainEnv.trim().length > 0) {
    return withFallback(parseChainEnv(chainEnv));
  }

  const providerName = resolveProviderName(env.AI_PROVIDER);

  if (providerName === "groq") return new GroqProvider();
  if (providerName === "gemini") return new GeminiProvider();
  return new ClaudeProvider();
}
