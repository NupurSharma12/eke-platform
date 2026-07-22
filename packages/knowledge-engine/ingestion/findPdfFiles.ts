import { promises as fs } from "fs";
import path from "path";

interface DiscoveredPdf {
  absolutePath: string;
  relativePath: string;
}

async function walk(
  currentDir: string,
  rootDir: string,
  results: DiscoveredPdf[]
): Promise<void> {
  const dirEntries = await fs.readdir(currentDir, {
    withFileTypes: true,
  });

  for (const entry of dirEntries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, rootDir, results);
    } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
      results.push({
        absolutePath,
        relativePath: path.relative(rootDir, absolutePath),
      });
    }
  }
}

/**
 * Recursively discovers PDF files under `rootDir`, matching
 * `.pdf`/`.PDF`/any-case extension. Returned paths are sorted by
 * their location relative to `rootDir` (not by absolute path),
 * so ordering only depends on the directory's own structure —
 * not on an unrelated prefix such as a randomly-named temp
 * extraction directory.
 */
export async function findPdfFiles(rootDir: string): Promise<string[]> {
  const results: DiscoveredPdf[] = [];

  await walk(rootDir, rootDir, results);

  results.sort((a, b) =>
    a.relativePath < b.relativePath
      ? -1
      : a.relativePath > b.relativePath
      ? 1
      : 0
  );

  return results.map((entry) => entry.absolutePath);
}
