import { findSupportedFiles } from "./findSupportedFiles";

/**
 * Recursively discovers PDF files under `rootDir`, matching
 * `.pdf`/`.PDF`/any-case extension, sorted deterministically by
 * path relative to `rootDir`.
 *
 * Implemented as a thin filter over the shared findSupportedFiles
 * walker — behavior and signature are unchanged from before
 * image support existed (filtering a relative-path-sorted list to
 * one kind preserves that kind's relative order exactly).
 */
export async function findPdfFiles(rootDir: string): Promise<string[]> {
  const { files } = await findSupportedFiles(rootDir);

  return files
    .filter((file) => file.kind === "pdf")
    .map((file) => file.absolutePath);
}
