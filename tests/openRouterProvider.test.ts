import assert from "node:assert/strict";

import {
  OpenRouterProvider,
  OPENROUTER_DEFAULT_MODEL,
  FetchLike,
} from "../packages/ai/providers/OpenRouterProvider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: { model: string; messages: { role: string; content: string }[] };
}

function fakeFetch(
  responseBody: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): { fetchImpl: FetchLike; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: JSON.parse(init.body),
    });

    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      statusText: options.statusText ?? "OK",
      async json() {
        return responseBody;
      },
      async text() {
        return JSON.stringify(responseBody);
      },
    };
  };

  return { fetchImpl, calls };
}

async function withApiKey<T>(fn: () => Promise<T> | T): Promise<T> {
  const original = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key-not-a-real-secret";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = original;
  }
}

async function main() {
  console.log("OpenRouterProvider");

  await test("defaults to the openrouter/free router when no model is given", () =>
    withApiKey(async () => {
      const { fetchImpl, calls } = fakeFetch({ choices: [{ message: { content: "hi" } }] });
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      await provider.generate("prompt");

      assert.equal(calls[0].body.model, OPENROUTER_DEFAULT_MODEL);
      assert.equal(OPENROUTER_DEFAULT_MODEL, "openrouter/free");
    }));

  await test("an explicit model overrides the default", () =>
    withApiKey(async () => {
      const { fetchImpl, calls } = fakeFetch({ choices: [{ message: { content: "hi" } }] });
      const provider = new OpenRouterProvider("some/other-model", fetchImpl);

      await provider.generate("prompt");

      assert.equal(calls[0].body.model, "some/other-model");
    }));

  await test("sends the OpenAI-compatible chat/completions request shape", () =>
    withApiKey(async () => {
      const { fetchImpl, calls } = fakeFetch({ choices: [{ message: { content: "hi" } }] });
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      await provider.generate("explain fractions");

      assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(calls[0].method, "POST");
      assert.deepEqual(calls[0].body.messages, [{ role: "user", content: "explain fractions" }]);
    }));

  await test("authenticates with a Bearer token from OPENROUTER_API_KEY", () =>
    withApiKey(async () => {
      const { fetchImpl, calls } = fakeFetch({ choices: [{ message: { content: "hi" } }] });
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      await provider.generate("prompt");

      assert.equal(calls[0].headers.Authorization, "Bearer test-key-not-a-real-secret");
    }));

  await test("returns the response's text content", () =>
    withApiKey(async () => {
      const { fetchImpl } = fakeFetch({ choices: [{ message: { content: "the actual answer" } }] });
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      const result = await provider.generate("prompt");

      assert.equal(result, "the actual answer");
    }));

  await test("a non-ok HTTP response throws with the status, and never includes the API key", () =>
    withApiKey(async () => {
      const { fetchImpl } = fakeFetch(
        { error: "rate limited" },
        { ok: false, status: 429, statusText: "Too Many Requests" }
      );
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      await assert.rejects(
        () => provider.generate("prompt"),
        (error: Error & { status?: number }) => {
          assert.match(error.message, /429/);
          assert.doesNotMatch(error.message, /test-key-not-a-real-secret/);
          assert.equal(error.status, 429);
          return true;
        }
      );
    }));

  await test("no content in the response throws a clear error rather than returning undefined silently", () =>
    withApiKey(async () => {
      const { fetchImpl } = fakeFetch({ choices: [] });
      const provider = new OpenRouterProvider(undefined, fetchImpl);

      await assert.rejects(() => provider.generate("prompt"), /OpenRouter returned no text response/);
    }));

  await test("throws a clear error when OPENROUTER_API_KEY is not configured (no key value ever appears in the message)", () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      assert.throws(
        () => new OpenRouterProvider(undefined, fakeFetch({}).fetchImpl),
        /OPENROUTER_API_KEY is not configured/
      );
    } finally {
      if (original !== undefined) process.env.OPENROUTER_API_KEY = original;
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
