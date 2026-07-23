import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { findSupportedFiles } from "../packages/knowledge-engine/ingestion/findSupportedFiles";

let passed = 0;

async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

async function writeFile(filePath: string, content = ""): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

async function main() {
  console.log("findSupportedFiles");

  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-find-supported-test-")
  );

  try {
    await writeFile(path.join(rootDir, "chapter1.pdf"));
    await writeFile(path.join(rootDir, "page-001.jpeg"));
    await writeFile(path.join(rootDir, "page-002.JPG"));
    await writeFile(path.join(rootDir, "page-003.png"));
    await writeFile(path.join(rootDir, "page-004.PNG"));
    await writeFile(path.join(rootDir, "notes.txt"));
    await writeFile(path.join(rootDir, "cover.heic"));
    await writeFile(
      path.join(rootDir, "nested", "chapter2.PDF")
    );
    await writeFile(
      path.join(rootDir, "nested", "deeper", "page-005.jpg")
    );

    const { files, skipped } = await findSupportedFiles(rootDir);
    const relative = files.map((f) => ({
      path: path.relative(rootDir, f.absolutePath),
      kind: f.kind,
    }));

    await test("discovers PDF files", async () => {
      assert.ok(relative.some((f) => f.path === "chapter1.pdf" && f.kind === "pdf"));
      assert.ok(
        relative.some(
          (f) => f.path === path.join("nested", "chapter2.PDF") && f.kind === "pdf"
        )
      );
    });

    await test("discovers .jpeg files", async () => {
      assert.ok(relative.some((f) => f.path === "page-001.jpeg" && f.kind === "image"));
    });

    await test("discovers .jpg files", async () => {
      assert.ok(relative.some((f) => f.path === "page-002.JPG" && f.kind === "image"));
      assert.ok(
        relative.some(
          (f) => f.path === path.join("nested", "deeper", "page-005.jpg") && f.kind === "image"
        )
      );
    });

    await test("discovers .png files", async () => {
      assert.ok(relative.some((f) => f.path === "page-003.png" && f.kind === "image"));
      assert.ok(relative.some((f) => f.path === "page-004.PNG" && f.kind === "image"));
    });

    await test("matches extensions case-insensitively across all supported kinds", async () => {
      // .JPG, .PNG, .PDF already covered above by mixed-case fixtures.
      const kinds = new Set(relative.map((f) => f.path.toLowerCase().split(".").pop()));
      assert.deepEqual(kinds, new Set(["pdf", "jpeg", "jpg", "png"]));
    });

    await test("recursively discovers files in nested directories", async () => {
      assert.ok(relative.some((f) => f.path === path.join("nested", "chapter2.PDF")));
      assert.ok(
        relative.some((f) => f.path === path.join("nested", "deeper", "page-005.jpg"))
      );
    });

    await test("excludes and reports unsupported file types instead of silently processing them", async () => {
      assert.ok(!relative.some((f) => f.path === "notes.txt"));
      assert.ok(!relative.some((f) => f.path === "cover.heic"));

      const skippedNames = skipped.map((p) => path.basename(p));
      assert.ok(skippedNames.includes("notes.txt"));
      assert.ok(skippedNames.includes("cover.heic"));
    });

    await test("sorts mixed PDF/image results deterministically by path relative to root", async () => {
      const paths = relative.map((f) => f.path);
      const sorted = [...paths].sort();
      assert.deepEqual(paths, sorted);

      const again = (await findSupportedFiles(rootDir)).files.map((f) =>
        path.relative(rootDir, f.absolutePath)
      );
      assert.deepEqual(paths, again);
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
