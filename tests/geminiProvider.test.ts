import assert from "node:assert/strict";

import { GeminiProvider, GeminiClient } from "../packages/ai/providers/GeminiProvider";
import { isImageCapableProvider } from "../packages/ai/providers/ImageCapableProvider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeClient(responseText: string): GeminiClient & {
  calls: { model: string; contents: unknown }[];
} {
  const calls: { model: string; contents: unknown }[] = [];

  return {
    calls,
    models: {
      async generateContent(params) {
        calls.push(params);
        return { text: responseText };
      },
    },
  };
}

async function main() {
  console.log("GeminiProvider");

  await test("implements AIProvider: generate() returns the client's text response", async () => {
    const client = fakeClient("hello from gemini");
    const provider = new GeminiProvider(client);

    const result = await provider.generate("some prompt");

    assert.equal(result, "hello from gemini");
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].contents, "some prompt");
  });

  await test("implements ImageCapableProvider structurally", () => {
    const provider = new GeminiProvider(fakeClient(""));
    assert.equal(isImageCapableProvider(provider), true);
  });

  await test("generateFromImages passes image bytes and MIME type correctly, alongside the prompt", async () => {
    const client = fakeClient(
      JSON.stringify({ concepts: [], warnings: [], metadata: {} })
    );
    const provider = new GeminiProvider(client);

    const result = await provider.generateFromImages(
      [
        { base64: "ZmFrZS1ieXRlcw==", mediaType: "image/jpeg" },
        { base64: "bW9yZS1ieXRlcw==", mediaType: "image/png" },
      ],
      "extract concepts from these pages"
    );

    assert.equal(client.calls.length, 1);

    const { contents } = client.calls[0] as {
      contents: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }>;
    };

    assert.equal(contents.length, 3);
    assert.deepEqual(contents[0].inlineData, {
      data: "ZmFrZS1ieXRlcw==",
      mimeType: "image/jpeg",
    });
    assert.deepEqual(contents[1].inlineData, {
      data: "bW9yZS1ieXRlcw==",
      mimeType: "image/png",
    });
    assert.equal(contents[2].text, "extract concepts from these pages");

    assert.equal(result, JSON.stringify({ concepts: [], warnings: [], metadata: {} }));
  });

  await test("uses the same model for both text and image generation", async () => {
    const client = fakeClient("text response");
    const provider = new GeminiProvider(client, "some-custom-model");

    await provider.generate("prompt");
    await provider.generateFromImages(
      [{ base64: "YQ==", mediaType: "image/jpeg" }],
      "prompt"
    );

    assert.equal(client.calls[0].model, client.calls[1].model);
    assert.equal(client.calls[0].model, "some-custom-model");
  });

  await test("defaults to gemini-flash-latest when no model is configured", async () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;

    try {
      const client = fakeClient("response");
      const provider = new GeminiProvider(client);

      await provider.generate("prompt");

      assert.equal(client.calls[0].model, "gemini-flash-latest");
    } finally {
      if (original !== undefined) {
        process.env.GEMINI_MODEL = original;
      }
    }
  });

  await test("an explicit constructor model overrides the default", async () => {
    const client = fakeClient("response");
    const provider = new GeminiProvider(client, "gemini-pro-latest");

    await provider.generate("prompt");

    assert.equal(client.calls[0].model, "gemini-pro-latest");
  });

  await test("GEMINI_MODEL is honored when no explicit constructor model is given", async () => {
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-flash-lite-latest";

    try {
      const client = fakeClient("response");
      const provider = new GeminiProvider(client);

      await provider.generate("prompt");
      await provider.generateFromImages(
        [{ base64: "YQ==", mediaType: "image/jpeg" }],
        "prompt"
      );

      assert.equal(client.calls[0].model, "gemini-flash-lite-latest");
      assert.equal(client.calls[1].model, "gemini-flash-lite-latest");
    } finally {
      if (original === undefined) {
        delete process.env.GEMINI_MODEL;
      } else {
        process.env.GEMINI_MODEL = original;
      }
    }
  });

  await test("an explicit constructor model takes precedence over GEMINI_MODEL", async () => {
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-flash-lite-latest";

    try {
      const client = fakeClient("response");
      const provider = new GeminiProvider(client, "explicit-override-model");

      await provider.generate("prompt");

      assert.equal(client.calls[0].model, "explicit-override-model");
    } finally {
      if (original === undefined) {
        delete process.env.GEMINI_MODEL;
      } else {
        process.env.GEMINI_MODEL = original;
      }
    }
  });

  await test("throws a clear error if the client returns no text, rather than returning undefined silently", async () => {
    const client = fakeClient("");
    client.models.generateContent = async () => ({ text: undefined });

    const provider = new GeminiProvider(client);

    await assert.rejects(
      () => provider.generate("prompt"),
      /Gemini returned no text response/
    );
  });

  await test("throws a clear error when GEMINI_API_KEY is not configured (no key value ever appears in the message)", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      assert.throws(() => new GeminiProvider(), /GEMINI_API_KEY is not configured/);
    } finally {
      if (original !== undefined) {
        process.env.GEMINI_API_KEY = original;
      }
    }
  });

  await test("reads the API key from GEMINI_API_KEY without a real network call when no client is injected", () => {
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key-not-a-real-secret";

    try {
      // Constructing the real GoogleGenAI client only stores
      // config — it never makes a network call — so this proves
      // the key is read successfully without hitting the API.
      assert.doesNotThrow(() => new GeminiProvider());
    } finally {
      if (original === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = original;
      }
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
