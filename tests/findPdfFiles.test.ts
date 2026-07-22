import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { findPdfFiles } from "../packages/knowledge-engine/ingestion/findPdfFiles";

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
  console.log("findPdfFiles");

  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "eke-find-pdf-test-")
  );

  try {
    // Root-level and nested, mixed case extensions, and a
    // non-PDF file that must be excluded.
    await writeFile(path.join(rootDir, "chapter1.pdf"));
    await writeFile(path.join(rootDir, "chapter2.PDF"));
    await writeFile(path.join(rootDir, "notes.txt"));
    await writeFile(path.join(rootDir, "nested", "chapter3.Pdf"));
    await writeFile(
      path.join(rootDir, "nested", "deeper", "chapter4.pdf")
    );

    const found = await findPdfFiles(rootDir);
    const relative = found.map((p) => path.relative(rootDir, p));

    await test("discovers PDFs recursively through nested directories", async () => {
      assert.deepEqual(
        new Set(relative),
        new Set([
          "chapter1.pdf",
          "chapter2.PDF",
          path.join("nested", "chapter3.Pdf"),
          path.join("nested", "deeper", "chapter4.pdf"),
        ])
      );
    });

    await test("matches .pdf case-insensitively and excludes non-PDF files", async () => {
      assert.ok(!relative.includes("notes.txt"));
      assert.ok(relative.includes("chapter1.pdf"));
      assert.ok(relative.includes("chapter2.PDF"));
      assert.ok(relative.includes(path.join("nested", "chapter3.Pdf")));
    });

    await test("sorts discovered PDFs deterministically by path relative to root", async () => {
      const sorted = [...relative].sort();
      assert.deepEqual(relative, sorted);

      // Re-running discovery on the same tree yields the same order.
      const again = (await findPdfFiles(rootDir)).map((p) =>
        path.relative(rootDir, p)
      );
      assert.deepEqual(relative, again);
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
