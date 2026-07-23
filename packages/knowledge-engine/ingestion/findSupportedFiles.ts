import { promises as fs } from "fs";
import path from "path";

export type SupportedFileKind = "pdf" | "image";

export interface DiscoveredFile {
  absolutePath: string;
  kind: SupportedFileKind;
}

export interface DiscoveryResult {
  /** Supported files (PDF/JPEG/JPG/PNG), sorted deterministically by path relative to rootDir. */
  files: DiscoveredFile[];
  /** Absolute paths of files found but not supported — reported, never silently processed. */
  skipped: string[];
}

interface WalkEntry {
  absolutePath: string;
  relativePath: string;
  kind: SupportedFileKind | null;
}

function classify(filename: string): SupportedFileKind | null {
  if (/\.pdf$/i.test(filename)) return "pdf";
  if (/\.(jpe?g|png)$/i.test(filename)) return "image";
  return null;
}

async function walk(
  currentDir: string,
  rootDir: string,
  results: WalkEntry[]
): Promise<void> {
  const dirEntries = await fs.readdir(currentDir, {
    withFileTypes: true,
  });

  for (const entry of dirEntries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, rootDir, results);
    } else if (entry.isFile()) {
      results.push({
        absolutePath,
        relativePath: path.relative(rootDir, absolutePath),
        kind: classify(entry.name),
      });
    }
  }
}

/**
 * Recursively discovers every PDF/JPEG/JPG/PNG file under
 * `rootDir` (case-insensitive extension matching), sorted by path
 * relative to `rootDir` so ordering only depends on the
 * directory's own structure — not on an unrelated prefix such as
 * a randomly-named temp extraction directory. Files that don't
 * match a supported extension are reported in `skipped` rather
 * than silently dropped or silently processed.
 *
 * This is the shared walker behind both findPdfFiles (PDF-only,
 * preserved for backward compatibility) and mixed-format batch
 * processing.
 */
export async function findSupportedFiles(
  rootDir: string
): Promise<DiscoveryResult> {
  const entries: WalkEntry[] = [];

  await walk(rootDir, rootDir, entries);

  entries.sort((a, b) =>
    a.relativePath < b.relativePath
      ? -1
      : a.relativePath > b.relativePath
      ? 1
      : 0
  );

  const files: DiscoveredFile[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (entry.kind) {
      files.push({ absolutePath: entry.absolutePath, kind: entry.kind });
    } else {
      skipped.push(entry.absolutePath);
    }
  }

  return { files, skipped };
}
