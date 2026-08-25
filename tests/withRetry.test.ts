import assert from "node:assert/strict";

import { AIProvider } from "../packages/ai/providers/AIProvider";
import { ImageCapableProvider } from "../packages/ai/providers/ImageCapableProvider";
import {
  withRetry,
  isRateLimitError,
  extractRetryDelayMs,
} from "../packages/ai/providers/withRetry";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function rateLimitError(message: string, status = 429): Error {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

/** Records requested delays instead of actually waiting. */
function recordingSleep(): { sleep: (ms: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
  };
}

function flakyThenSucceedsProvider(
  failuresBeforeSuccess: number,
  error: () => Error
): AIProvider & { calls: number } {
  return {
    calls: 0,
    async generate() {
      this.calls += 1;
      if (this.calls <= failuresBeforeSuccess) {
        throw error();
      }
      return "success";
    },
  };
}

function alwaysFailingProvider(error: () => Error): AIProvider & { calls: number } {
  return {
    calls: 0,
    async generate() {
      this.calls += 1;
      throw error();
    },
  };
}

async function main() {
  console.log("withRetry");

  await test("isRateLimitError detects HTTP 429 status", () => {
    assert.equal(isRateLimitError(rateLimitError("anything")), true);
  });

  await test("isRateLimitError detects RESOURCE_EXHAUSTED in the message even without a status", () => {
    const error = new Error(
      "RESOURCE_EXHAUSTED\nGenerateRequestsPerMinutePerProject-FreeTier\nlimit: 5\nretryDelay: 42 seconds"
    );
    assert.equal(isRateLimitError(error), true);
  });

  await test("isRateLimitError returns false for unrelated errors", () => {
    assert.equal(isRateLimitError(new Error("file not found")), false);
    assert.equal(isRateLimitError(null), false);
    assert.equal(isRateLimitError("a string, not an error object"), false);
  });

  await test("extractRetryDelayMs parses Gemini's embedded 'retryDelay: N seconds' text", () => {
    const error = new Error(
      "RESOURCE_EXHAUSTED\nGenerateRequestsPerMinutePerProject-FreeTier\nlimit: 5\nretryDelay: 42 seconds"
    );
    assert.equal(extractRetryDelayMs(error), 42000);
  });

  await test("extractRetryDelayMs reads a retry-after header when present", () => {
    const error = rateLimitError("rate limited");
    (error as unknown as { headers: { get: (name: string) => string | null } }).headers = {
      get: (name: string) => (name === "retry-after" ? "7" : null),
    };
    assert.equal(extractRetryDelayMs(error), 7000);
  });

  await test("extractRetryDelayMs returns null when no delay is available anywhere", () => {
    assert.equal(extractRetryDelayMs(rateLimitError("rate limited, no delay given")), null);
  });

  await test("retries once after a rate-limit error and then succeeds, waiting the provider-specified delay", async () => {
    const provider = flakyThenSucceedsProvider(1, () =>
      rateLimitError("RESOURCE_EXHAUSTED retryDelay: 3 seconds")
    );
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep });

    const result = await wrapped.generate("prompt");

    assert.equal(result, "success");
    assert.equal(provider.calls, 2);
    assert.deepEqual(delays, [3000]);
  });

  await test("does not add any delay to a normal successful call", async () => {
    const provider = flakyThenSucceedsProvider(0, () => rateLimitError("unused"));
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep });
    await wrapped.generate("prompt");

    assert.equal(provider.calls, 1);
    assert.deepEqual(delays, []);
  });

  await test("uses the configurable fallback delay when the error specifies none", async () => {
    const provider = flakyThenSucceedsProvider(1, () => rateLimitError("rate limited"));
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep, fallbackDelayMs: 1234 });
    await wrapped.generate("prompt");

    assert.deepEqual(delays, [1234]);
  });

  await test("a non-rate-limit error propagates immediately without retrying", async () => {
    const provider = alwaysFailingProvider(() => new Error("totally unrelated failure"));
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep });

    await assert.rejects(() => wrapped.generate("prompt"), /totally unrelated failure/);
    assert.equal(provider.calls, 1);
    assert.deepEqual(delays, []);
  });

  await test("the retry cap prevents infinite retries: gives up after maxRetries and rethrows", async () => {
    const provider = alwaysFailingProvider(() => rateLimitError("always rate limited"));
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep, maxRetries: 2, fallbackDelayMs: 10 });

    await assert.rejects(() => wrapped.generate("prompt"), /always rate limited/);

    // 1 initial attempt + 2 retries = 3 calls total, never more.
    assert.equal(provider.calls, 3);
    assert.equal(delays.length, 2);
  });

  await test("preserves ImageCapableProvider: generateFromImages is retried the same way", async () => {
    let calls = 0;
    const provider: ImageCapableProvider = {
      async generate() {
        throw new Error("should not be called");
      },
      async generateFromImages() {
        calls += 1;
        if (calls === 1) {
          throw rateLimitError("RESOURCE_EXHAUSTED retryDelay: 1 seconds");
        }
        return "image-result";
      },
    };
    const { sleep, delays } = recordingSleep();

    const wrapped = withRetry(provider, { sleep });

    assert.equal(typeof wrapped.generateFromImages, "function");

    const result = await wrapped.generateFromImages(
      [{ base64: "abc", mediaType: "image/jpeg" }],
      "prompt"
    );

    assert.equal(result, "image-result");
    assert.equal(calls, 2);
    assert.deepEqual(delays, [1000]);
  });

  await test("a plain AIProvider without image support is not given generateFromImages", () => {
    const provider: AIProvider = {
      async generate() {
        return "text only";
      },
    };

    const wrapped = withRetry(provider);

    assert.equal((wrapped as Partial<ImageCapableProvider>).generateFromImages, undefined);
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
