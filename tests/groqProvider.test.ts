import assert from "node:assert/strict";

import {
  GroqProvider,
  GroqClient,
  GROQ_MODEL_GPT_OSS_120B,
  GROQ_MODEL_GPT_OSS_20B,
} from "../packages/ai/providers/GroqProvider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeClient(responseContent: string | null): GroqClient & {
  calls: { model: string }[];
} {
  const calls: { model: string }[] = [];

  return {
    calls,
    chat: {
      completions: {
        async create(params) {
          calls.push({ model: params.model });
          return { choices: [{ message: { content: responseContent } }] };
        },
      },
    },
  };
}

async function main() {
  console.log("GroqProvider (configurable model)");

  await test("defaults to GPT-OSS 120B when no model is given", async () => {
    const client = fakeClient("response");
    const provider = new GroqProvider(undefined, client);

    await provider.generate("prompt");

    assert.equal(client.calls[0].model, GROQ_MODEL_GPT_OSS_120B);
  });

  await test("accepts GPT-OSS 120B explicitly", async () => {
    const client = fakeClient("response");
    const provider = new GroqProvider(GROQ_MODEL_GPT_OSS_120B, client);

    await provider.generate("prompt");

    assert.equal(client.calls[0].model, "openai/gpt-oss-120b");
  });

  await test("accepts GPT-OSS 20B explicitly", async () => {
    const client = fakeClient("response");
    const provider = new GroqProvider(GROQ_MODEL_GPT_OSS_20B, client);

    await provider.generate("prompt");

    assert.equal(client.calls[0].model, "openai/gpt-oss-20b");
  });

  await test("is not hardcoded to one model: two instances with different models make requests with different models", async () => {
    const clientA = fakeClient("a");
    const clientB = fakeClient("b");
    const providerA = new GroqProvider(GROQ_MODEL_GPT_OSS_120B, clientA);
    const providerB = new GroqProvider(GROQ_MODEL_GPT_OSS_20B, clientB);

    await providerA.generate("prompt");
    await providerB.generate("prompt");

    assert.notEqual(clientA.calls[0].model, clientB.calls[0].model);
  });

  await test("requests JSON-object structured output, same as before this milestone", async () => {
    let capturedParams: { response_format?: { type: string } } | undefined;
    const client: GroqClient = {
      chat: {
        completions: {
          async create(params) {
            capturedParams = params;
            return { choices: [{ message: { content: "{}" } }] };
          },
        },
      },
    };
    const provider = new GroqProvider(undefined, client);

    await provider.generate("prompt");

    assert.deepEqual(capturedParams?.response_format, { type: "json_object" });
  });

  await test("throws a clear error if the client returns no content, rather than returning undefined silently", async () => {
    const client = fakeClient(null);
    const provider = new GroqProvider(undefined, client);

    await assert.rejects(() => provider.generate("prompt"), /Groq returned no text response/);
  });

  await test("throws a clear error when GROQ_API_KEY is not configured (no key value ever appears in the message)", () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      assert.throws(() => new GroqProvider(), /GROQ_API_KEY is not configured/);
    } finally {
      if (original !== undefined) {
        process.env.GROQ_API_KEY = original;
      }
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
