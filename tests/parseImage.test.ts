import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseImage } from "../packages/knowledge-engine/ingestion/parseImage";

let passed = 0;

async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function main() {
  console.log("parseImage");

  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-parse-image-test-")
  );

  try {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]);
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    const jpegPath = path.join(rootDir, "page-001.jpeg");
    const jpgPath = path.join(rootDir, "page-002.JPG");
    const pngPath = path.join(rootDir, "page-003.PNG");

    await fs.writeFile(jpegPath, jpegBytes);
    await fs.writeFile(jpgPath, jpegBytes);
    await fs.writeFile(pngPath, pngBytes);

    await test("id and filename are the image's own filename, deterministic", async () => {
      const doc = await parseImage(jpegPath);
      assert.equal(doc.id, "page-001.jpeg");
      assert.equal(doc.filename, "page-001.jpeg");
      assert.equal(doc.kind, "image");
    });

    await test(".jpeg and .jpg are detected as image/jpeg", async () => {
      const jpeg = await parseImage(jpegPath);
      const jpg = await parseImage(jpgPath);
      assert.equal(jpeg.mediaType, "image/jpeg");
      assert.equal(jpg.mediaType, "image/jpeg");
    });

    await test(".PNG (any case) is detected as image/png", async () => {
      const png = await parseImage(pngPath);
      assert.equal(png.mediaType, "image/png");
    });

    await test("base64-encodes the raw file bytes without altering them", async () => {
      const doc = await parseImage(jpegPath);
      assert.equal(doc.base64, jpegBytes.toString("base64"));
      assert.deepEqual(Buffer.from(doc.base64, "base64"), jpegBytes);
    });

    await test("parsing the same file twice is deterministic", async () => {
      const first = await parseImage(jpegPath);
      const second = await parseImage(jpegPath);
      assert.deepEqual(first, second);
    });
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
