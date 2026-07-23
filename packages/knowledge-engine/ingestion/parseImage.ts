import { promises as fs } from "fs";
import path from "path";

import { ImageDocument, ImageMediaType } from "../../shared-types";

function detectMediaType(filePath: string): ImageMediaType {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".png" ? "image/png" : "image/jpeg";
}

/**
 * Reads an image file and prepares it as an ExtractionInput,
 * mirroring parseDocument's role for PDFs: same identity
 * convention (id = filename), same "one file in, one document
 * out" shape. No image manipulation (resize/compress/OCR) —
 * this only reads bytes and base64-encodes them for the vision
 * API.
 */
export async function parseImage(filePath: string): Promise<ImageDocument> {
  const buffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);

  return {
    id: filename,
    filename,
    kind: "image",
    base64: buffer.toString("base64"),
    mediaType: detectMediaType(filePath),
  };
}
