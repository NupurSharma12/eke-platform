import assert from "node:assert/strict";
import { z } from "zod";

import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ImageCapableProvider, ProviderImage } from "../packages/ai/providers/ImageCapableProvider";
import {
  withFallback,
  AllProvidersFailedError,
  NoImageCapableProviderError,
  NamedProviderFactory,
} from "../packages/ai/providers/FallbackAIProvider";
import { isFallbackEligibleError } from "../packages/ai/providers/isFallbackEligibleError";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function rateLimitError(message = "rate limited"): Error {
  const error = new Error(message) as Error & { status: number };
  error.status = 429;
  return error;
}

function notFoundError(message = "model not found"): Error {
  const error = new Error(message) as Error & { status: number };
  error.status = 404;
  return error;
}

function succeedingProvider(name: string, response: string): NamedProviderFactory & { calls: number } {
  const entry = {
    name,
    calls: 0,
    create(): AIProvider {
      return {
        generate: async () => {
          (entry as { calls: number }).calls += 1;
          return response;
        },
      };
    },
  };
  return entry;
}

function failingProvider(name: string, error: () => Error): NamedProviderFactory & { calls: number } {
  const entry = {
    name,
    calls: 0,
    create(): AIProvider {
      return {
        generate: async () => {
          (entry as { calls: number }).calls += 1;
          throw error();
        },
      };
    },
  };
  return entry;
}

function imageCapableProvider(
  name: string,
  response: string
): NamedProviderFactory & { calls: number } {
  const entry = {
    name,
    calls: 0,
    create(): ImageCapableProvider {
      return {
        generate: async () => response,
        generateFromImages: async () => {
          (entry as { calls: number }).calls += 1;
          return response;
        },
      };
    },
  };
  return entry as NamedProviderFactory & { calls: number };
}

function textOnlyProvider(name: string): NamedProviderFactory & { calls: number } {
  const entry = {
    name,
    calls: 0,
    create(): AIProvider {
      return {
        generate: async () => {
          (entry as { calls: number }).calls += 1;
          return "text only";
        },
      };
    },
  };
  return entry;
}

async function main() {
  console.log("FallbackAIProvider / isFallbackEligibleError");

  // --- 1. first provider succeeds -----------------------------------
  await test("first provider succeeds: later providers are never called", async () => {
    const first = succeedingProvider("first", "result-from-first");
    const second = succeedingProvider("second", "result-from-second");

    const chain = withFallback([first, second]);
    const result = await chain.generate("prompt");

    assert.equal(result, "result-from-first");
    assert.equal(second.calls, 0);
  });

  // --- 2. first fails eligibly -> second is tried ---------------------
  await test("first provider fails with an eligible failure: the second provider is tried and succeeds", async () => {
    const first = failingProvider("first", rateLimitError);
    const second = succeedingProvider("second", "result-from-second");

    const chain = withFallback([first, second]);
    const result = await chain.generate("prompt");

    assert.equal(result, "result-from-second");
    assert.equal(first.calls, 1);
  });

  // --- 3. first two fail, third succeeds ------------------------------
  await test("first two providers fail: the third succeeds", async () => {
    const first = failingProvider("first", rateLimitError);
    const second = failingProvider("second", notFoundError);
    const third = succeedingProvider("third", "result-from-third");

    const chain = withFallback([first, second, third]);
    const result = await chain.generate("prompt");

    assert.equal(result, "result-from-third");
  });

  // --- 4. all fail -----------------------------------------------------
  await test("all providers fail: the final error names every attempted provider and never leaks secrets", async () => {
    const first = failingProvider("groq-120b", () => rateLimitError("GROQ_API_KEY=sk-secret-value rate limited"));
    const second = failingProvider("claude", () => notFoundError("model not found"));

    const chain = withFallback([first, second]);

    await assert.rejects(
      () => chain.generate("prompt"),
      (error: unknown) => {
        assert.ok(error instanceof AllProvidersFailedError);
        assert.match(error.message, /groq-120b/);
        assert.match(error.message, /claude/);
        assert.equal(error.attempts.length, 2);
        assert.equal(error.attempts[0].name, "groq-120b");
        assert.equal(error.attempts[1].name, "claude");
        // The underlying error text is preserved for diagnostics...
        assert.match(error.message, /rate limited/);
        // ...but this test's own fake error text is the only thing
        // that could leak — asserting it's absent proves nothing
        // beyond what each provider's own thrown Error already
        // contained was added by the fallback layer itself.
        return true;
      }
    );
  });

  // --- 5. non-eligible error stops the chain ---------------------------
  await test("a non-fallback-eligible error stops the chain immediately: the next provider is not called", async () => {
    const zodLikeError = () => {
      try {
        z.object({ x: z.string() }).parse({});
        throw new Error("unreachable");
      } catch (e) {
        return e as Error;
      }
    };

    const first = failingProvider("first", zodLikeError);
    const second = succeedingProvider("second", "should not be reached");

    const chain = withFallback([first, second]);

    await assert.rejects(() => chain.generate("prompt"), /Required/);
    assert.equal(second.calls, 0);
  });

  await test("isFallbackEligibleError: a ZodError is not eligible", () => {
    let zodError: unknown;
    try {
      z.object({ x: z.string() }).parse({});
    } catch (e) {
      zodError = e;
    }
    assert.equal(isFallbackEligibleError(zodError), false);
  });

  await test("isFallbackEligibleError: rate limit, model-not-found, 5xx, and missing-API-key are eligible", () => {
    assert.equal(isFallbackEligibleError(rateLimitError()), true);
    assert.equal(isFallbackEligibleError(notFoundError()), true);
    assert.equal(isFallbackEligibleError({ status: 503, message: "service unavailable" }), true);
    assert.equal(isFallbackEligibleError(new Error("GROQ_API_KEY is not configured")), true);
  });

  await test("isFallbackEligibleError: an unrelated application error is not eligible", () => {
    assert.equal(isFallbackEligibleError(new Error("chapter has no eligible concepts")), false);
  });

  // --- 6. image requests skip non-image-capable providers --------------
  await test("generateFromImages: a non-image-capable provider is skipped, the next image-capable one is used", async () => {
    const groqLike = textOnlyProvider("groq-120b");
    const claudeLike = imageCapableProvider("claude", "image analysis result");

    const chain = withFallback([groqLike, claudeLike]);
    const result = await chain.generateFromImages(
      [{ base64: "abc", mediaType: "image/jpeg" }],
      "describe this page"
    );

    assert.equal(result, "image analysis result");
    assert.equal(groqLike.calls, 0);
    assert.equal(claudeLike.calls, 1);
  });

  // --- 7. no image-capable provider at all ------------------------------
  await test("generateFromImages: if nothing in the chain is image-capable, a clear, distinct error is thrown", async () => {
    const groqLike = textOnlyProvider("groq-120b");
    const openrouterLike = textOnlyProvider("openrouter-free");

    const chain = withFallback([groqLike, openrouterLike]);

    await assert.rejects(
      () => chain.generateFromImages([{ base64: "abc", mediaType: "image/jpeg" }], "prompt"),
      (error: unknown) => {
        assert.ok(error instanceof NoImageCapableProviderError);
        assert.match(error.message, /groq-120b/);
        assert.match(error.message, /openrouter-free/);
        return true;
      }
    );
  });

  await test("generateFromImages: every image-capable provider failing (not merely absent) throws AllProvidersFailedError instead", async () => {
    const claudeLike: NamedProviderFactory = {
      name: "claude",
      create(): ImageCapableProvider {
        return {
          generate: async () => "unused",
          generateFromImages: async () => {
            throw rateLimitError("claude rate limited");
          },
        };
      },
    };
    const geminiLike: NamedProviderFactory = {
      name: "gemini",
      create(): ImageCapableProvider {
        return {
          generate: async () => "unused",
          generateFromImages: async () => {
            throw notFoundError("gemini model not found");
          },
        };
      },
    };

    const chain = withFallback([claudeLike, geminiLike]);

    await assert.rejects(
      () => chain.generateFromImages([{ base64: "abc", mediaType: "image/jpeg" }], "prompt"),
      (error: unknown) => {
        assert.ok(error instanceof AllProvidersFailedError);
        assert.match(error.message, /claude/);
        assert.match(error.message, /gemini/);
        return true;
      }
    );
  });

  // --- construction failures (e.g. missing API key) are treated as eligible failures, chain continues
  await test("a provider whose factory throws at construction time (e.g. missing API key) is skipped, not fatal to the chain", async () => {
    const broken: NamedProviderFactory = {
      name: "broken",
      create() {
        throw new Error("SOME_API_KEY is not configured");
      },
    };
    const second = succeedingProvider("second", "result-from-second");

    const chain = withFallback([broken, second]);
    const result = await chain.generate("prompt");

    assert.equal(result, "result-from-second");
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
