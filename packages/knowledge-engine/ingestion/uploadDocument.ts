import { promises as fs } from "fs";
import path from "path";

import { classify } from "./findSupportedFiles";

/**
 * Where an uploaded document's persisted copy lives. One file per
 * sourceDocumentId, mirroring the same "one file per id" convention
 * already used by getSourceMetadataPath/getRawExtractionPath — a
 * dedicated area distinct from data/ncert/ (today's only real
 * source location, populated by hand) so uploads never collide with
 * or depend on that directory's contents.
 */
export function getUploadedDocumentPath(sourceDocumentId: string): string {
  return path.join(path.resolve("data/uploads"), sourceDocumentId);
}

/**
 * Persists a local file (e.g. a temp file written from an HTTP
 * multipart upload) into the application's dedicated upload area
 * and returns its stable sourceDocumentId.
 *
 * sourceDocumentId is the file's own basename — the same convention
 * parseDocument() already uses for every other ingested document
 * (see parseDocument.ts's `id: path.basename(filePath)`), so an
 * uploaded document's id stays consistent with how the rest of the
 * ingestion pipeline (parsing, extraction, metadata) already
 * identifies documents; nothing about that scheme is redesigned
 * here. This is deliberately just a filename, never chapter
 * identity — see ADR-006 (chapter identity comes from verified
 * content or human confirmation, never a resource identifier).
 *
 * Re-uploading a file with the same name overwrites the previous
 * copy at that id — the same "one file per id, always overwritten"
 * convention already used by saveSourceMetadata/saveRawExtraction,
 * not a new collision-handling mechanism. The original file at
 * `filePath` is only ever read/copied, never modified or moved.
 */
export async function uploadDocument(filePath: string): Promise<string> {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    throw new Error(`No file found at "${filePath}".`);
  }

  if (!stats.isFile()) {
    throw new Error(`"${filePath}" is not a file.`);
  }

  const filename = path.basename(filePath);
  const kind = classify(filename);

  if (!kind) {
    throw new Error(
      `Unsupported file type: "${filename}". Expected .pdf, .jpeg, .jpg, or .png.`
    );
  }

  const destinationPath = getUploadedDocumentPath(filename);

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(filePath, destinationPath);

  return filename;
}
