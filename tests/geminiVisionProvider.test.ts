import assert from "node:assert/strict";
import { ZodError } from "zod";

import { GeminiVisionProvider, GeminiVisionClient } from "../packages/ai/providers/GeminiVisionProvider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function fakeClient(responseText: string): GeminiVisionClient & {
  calls: { model: string; contents: unknown; config?: { responseMimeType?: string } }[];
} {
  const calls: { model: string; contents: unknown; config?: { responseMimeType?: string } }[] = [];

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

const VALID_RESULT_JSON = JSON.stringify({
  visibleText: "Chapter 4 — Living and Non-living things",
  visualElements: [
    { type: "flowchart", description: "Natural things vs man-made things, branching into living/non-living" },
  ],
  educationalSignificance: "Introduces the core living/non-living classification for the chapter.",
});

async function main() {
  console.log("GeminiVisionProvider");

  await test("sends the image and default prompt, requests JSON, and returns a validated result", async () => {
    const client = fakeClient(VALID_RESULT_JSON);
    const provider = new GeminiVisionProvider(client);

    const result = await provider.analyzePage({ base64: "ZmFrZS1ieXRlcw==", mediaType: "image/png" });

    assert.equal(client.calls.length, 1);
    const { contents, config } = client.calls[0] as {
      contents: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }>;
      config?: { responseMimeType?: string };
    };

    assert.equal(contents.length, 2);
    assert.deepEqual(contents[0].inlineData, { data: "ZmFrZS1ieXRlcw==", mimeType: "image/png" });
    assert.ok(typeof contents[1].text === "string" && contents[1].text.length > 0);
    assert.equal(config?.responseMimeType, "application/json");

    assert.equal(result.visibleText, "Chapter 4 — Living and Non-living things");
    assert.equal(result.visualElements.length, 1);
    assert.equal(result.visualElements[0].type, "flowchart");
  });

  await test("an explicit prompt override replaces the default prompt", async () => {
    const client = fakeClient(VALID_RESULT_JSON);
    const provider = new GeminiVisionProvider(client);

    await provider.analyzePage({ base64: "YQ==", mediaType: "image/jpeg" }, "a custom override prompt");

    const { contents } = client.calls[0] as { contents: Array<{ text?: string }> };
    assert.equal(contents[1].text, "a custom override prompt");
  });

  await test("exposes the configured model, same resolution convention as GeminiProvider", async () => {
    const client = fakeClient(VALID_RESULT_JSON);
    const provider = new GeminiVisionProvider(client, "gemini-pro-latest");

    assert.equal(provider.model, "gemini-pro-latest");

    await provider.analyzePage({ base64: "YQ==", mediaType: "image/png" });

    assert.equal(client.calls[0].model, "gemini-pro-latest");
  });

  await test("defaults to gemini-flash-latest when no model is configured", async () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;

    try {
      const client = fakeClient(VALID_RESULT_JSON);
      const provider = new GeminiVisionProvider(client);

      assert.equal(provider.model, "gemini-flash-latest");
    } finally {
      if (original !== undefined) process.env.GEMINI_MODEL = original;
    }
  });

  await test("GEMINI_MODEL is honored when no explicit constructor model is given", async () => {
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "gemini-flash-lite-latest";

    try {
      const client = fakeClient(VALID_RESULT_JSON);
      const provider = new GeminiVisionProvider(client);

      assert.equal(provider.model, "gemini-flash-lite-latest");
    } finally {
      if (original === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = original;
    }
  });

  await test("a malformed JSON response throws a clear error, not a silent parse failure", async () => {
    const client = fakeClient("not valid json {{{");
    const provider = new GeminiVisionProvider(client);

    await assert.rejects(
      () => provider.analyzePage({ base64: "YQ==", mediaType: "image/png" }),
      /Gemini vision analysis returned invalid JSON/
    );
  });

  await test("a response that is valid JSON but doesn't match the schema is rejected, not silently coerced", async () => {
    const client = fakeClient(JSON.stringify({ visibleText: "some text" }));
    const provider = new GeminiVisionProvider(client);

    await assert.rejects(
      () => provider.analyzePage({ base64: "YQ==", mediaType: "image/png" }),
      ZodError
    );
  });

  await test("an empty visualElements array is accepted (a plain-text page with nothing visually notable)", async () => {
    const client = fakeClient(
      JSON.stringify({ visibleText: "plain text", visualElements: [], educationalSignificance: "text-only content" })
    );
    const provider = new GeminiVisionProvider(client);

    const result = await provider.analyzePage({ base64: "YQ==", mediaType: "image/png" });

    assert.deepEqual(result.visualElements, []);
  });

  await test("empty visibleText is accepted (a page that is genuinely all-diagram)", async () => {
    const client = fakeClient(
      JSON.stringify({
        visibleText: "",
        visualElements: [{ type: "diagram", description: "an unlabeled geometric figure" }],
        educationalSignificance: "Shows a shape without accompanying text.",
      })
    );
    const provider = new GeminiVisionProvider(client);

    const result = await provider.analyzePage({ base64: "YQ==", mediaType: "image/png" });

    assert.equal(result.visibleText, "");
  });

  await test("throws a clear error if the client returns no text, rather than returning undefined silently", async () => {
    const client = fakeClient("");
    client.models.generateContent = async () => ({ text: undefined });

    const provider = new GeminiVisionProvider(client);

    await assert.rejects(
      () => provider.analyzePage({ base64: "YQ==", mediaType: "image/png" }),
      /Gemini returned no text response/
    );
  });

  await test("throws a clear error when GEMINI_API_KEY is not configured (no key value ever appears in the message)", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      assert.throws(() => new GeminiVisionProvider(), /GEMINI_API_KEY is not configured/);
    } finally {
      if (original !== undefined) process.env.GEMINI_API_KEY = original;
    }
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
