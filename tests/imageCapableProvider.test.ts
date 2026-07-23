import assert from "node:assert/strict";

import { AIProvider } from "../packages/ai/providers/AIProvider";
import {
  isImageCapableProvider,
  ImageCapableProvider,
} from "../packages/ai/providers/ImageCapableProvider";
import { ClaudeConceptExtractor } from "../packages/ai/extractors/ConceptExtractorService";
import { ImageDocument } from "../packages/shared-types";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function textOnlyProvider(): AIProvider {
  return {
    async generate() {
      throw new Error("generate should not be called for image input");
    },
  };
}

function imageCapableFakeProvider(response: string): ImageCapableProvider & {
  imageCalls: number;
  lastImages: unknown;
} {
  return {
    imageCalls: 0,
    lastImages: undefined,
    async generate() {
      throw new Error("generate should not be called for image input");
    },
    async generateFromImages(images) {
      this.imageCalls += 1;
      this.lastImages = images;
      return response;
    },
  };
}

const sampleImage: ImageDocument = {
  id: "page-001.jpeg",
  filename: "page-001.jpeg",
  kind: "image",
  base64: "ZmFrZS1pbWFnZS1ieXRlcw==",
  mediaType: "image/jpeg",
};

const validExtractionJson = JSON.stringify({
  concepts: [],
  warnings: [],
  metadata: {
    documentId: "irrelevant",
    extractor: "test",
    extractedAt: "2026-01-01T00:00:00.000Z",
  },
});

async function main() {
  console.log("ImageCapableProvider capability boundary");

  await test("isImageCapableProvider is true for a provider implementing generateFromImages", () => {
    assert.equal(isImageCapableProvider(imageCapableFakeProvider("")), true);
  });

  await test("isImageCapableProvider is false for a plain text-only AIProvider", () => {
    assert.equal(isImageCapableProvider(textOnlyProvider()), false);
  });

  await test("an image-capable provider is used for image extraction and never fed raw bytes as a text prompt", async () => {
    const provider = imageCapableFakeProvider(validExtractionJson);
    const extractor = new ClaudeConceptExtractor(provider);

    const result = await extractor.extract(sampleImage);

    assert.equal(provider.imageCalls, 1);
    assert.deepEqual(result.concepts, []);
    assert.deepEqual(provider.lastImages, [
      { base64: sampleImage.base64, mediaType: sampleImage.mediaType },
    ]);
  });

  await test("a non-image-capable provider fails clearly rather than silently sending binary data as text", async () => {
    const provider = textOnlyProvider();
    const extractor = new ClaudeConceptExtractor(provider);

    await assert.rejects(
      () => extractor.extract(sampleImage),
      /does not support image-based extraction/
    );
  });

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
