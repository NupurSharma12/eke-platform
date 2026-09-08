import assert from "node:assert/strict";

import { buildProviderChain } from "../packages/ai/providers/buildProviderChain";
import { ClaudeProvider } from "../packages/ai/providers/ClaudeProvider";
import { GroqProvider } from "../packages/ai/providers/GroqProvider";
import { GeminiProvider } from "../packages/ai/providers/GeminiProvider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/** A minimal env object for AI_PROVIDER_CHAIN/AI_PROVIDER resolution only. */
function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

/**
 * Real provider constructors always read their own API key straight
 * from process.env (this project's established convention —
 * buildProviderChain's own `env` param only controls
 * AI_PROVIDER_CHAIN/AI_PROVIDER resolution, never the concrete
 * providers' own key lookups), so exercising real construction
 * deterministically requires temporarily setting/clearing real
 * process.env vars, restored afterward — same technique already used
 * throughout this test suite (e.g. tests/geminiProvider.test.ts).
 */
async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const originals = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    originals.set(key, process.env[key]);
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, original] of Array.from(originals)) {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  }
}

async function main() {
  console.log("buildProviderChain");

  await test(
    "AI_PROVIDER_CHAIN resolves providers in the given order, and only fails past the ones that fail",
    () =>
      // groq-120b/groq-20b deliberately have no key and fail at
      // construction, skipped by the fallback chain; claude (the
      // only one with a key) succeeds — proves both "explicit chain
      // resolves in the given order" and "an unused missing API key
      // does not break the whole request" in one pass.
      withEnv({ GROQ_API_KEY: undefined, ANTHROPIC_API_KEY: "test-key-not-a-real-secret" }, async () => {
        const provider = buildProviderChain(env({ AI_PROVIDER_CHAIN: "groq-120b,groq-20b,claude" }));

        // Patch ClaudeProvider's real network call for this one
        // assertion, exactly as tests/analyzeMaterialRoute.test.ts
        // already does — there is no other seam into a route-style
        // provider-chain construction that doesn't reach a real class.
        const originalGenerate = ClaudeProvider.prototype.generate;
        ClaudeProvider.prototype.generate = async () => "claude-response";
        try {
          const result = await provider.generate("prompt");
          assert.equal(result, "claude-response");
        } finally {
          ClaudeProvider.prototype.generate = originalGenerate;
        }
      })
  );

  await test("an unknown provider name in AI_PROVIDER_CHAIN throws a clear, immediate error", () => {
    assert.throws(
      () => buildProviderChain(env({ AI_PROVIDER_CHAIN: "not-a-real-provider" })),
      /Unknown provider name "not-a-real-provider"/
    );
  });

  await test("an AI_PROVIDER_CHAIN of only commas/whitespace throws a clear error rather than silently falling back", () => {
    assert.throws(
      () => buildProviderChain(env({ AI_PROVIDER_CHAIN: " , , " })),
      /AI_PROVIDER_CHAIN is set but contains no provider names/
    );
  });

  await test("backward compatibility: when AI_PROVIDER_CHAIN is absent, AI_PROVIDER=groq resolves to a plain GroqProvider", () =>
    withEnv({ GROQ_API_KEY: "test-key" }, () => {
      const provider = buildProviderChain(env({ AI_PROVIDER: "groq" }));
      assert.ok(provider instanceof GroqProvider);
    }));

  await test("backward compatibility: when AI_PROVIDER_CHAIN is absent, AI_PROVIDER=gemini resolves to a plain GeminiProvider", () =>
    withEnv({ GEMINI_API_KEY: "test-key" }, () => {
      const provider = buildProviderChain(env({ AI_PROVIDER: "gemini" }));
      assert.ok(provider instanceof GeminiProvider);
    }));

  await test("backward compatibility: when both AI_PROVIDER_CHAIN and AI_PROVIDER are absent, defaults to a plain ClaudeProvider", () =>
    withEnv({ ANTHROPIC_API_KEY: "test-key" }, () => {
      const provider = buildProviderChain(env({}));
      assert.ok(provider instanceof ClaudeProvider);
    }));

  await test(
    "backward compatibility: the single-provider path returns the provider directly, not wrapped in a fallback/retry layer",
    () =>
      withEnv({ ANTHROPIC_API_KEY: "test-key" }, () => {
        const provider = buildProviderChain(env({}));
        // A plain ClaudeProvider instance, not an object literal
        // wrapper — proves no additional layer (withFallback/
        // withRetry) was introduced for anyone not opting into
        // AI_PROVIDER_CHAIN.
        assert.ok(provider instanceof ClaudeProvider);
        assert.equal(Object.getPrototypeOf(provider), ClaudeProvider.prototype);
      })
  );

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
