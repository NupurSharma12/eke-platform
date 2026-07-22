import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

import { ParsedDocument } from "../../shared-types";

export async function parseDocument(
  filePath: string
): Promise<ParsedDocument> {
  const pdfBuffer = await fs.readFile(filePath);

  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  const parser = new PDFParse({
    data: arrayBuffer,
  });

  const result = await parser.getText();

  const filename = path.basename(filePath);

  return {
    id: filename,
    filename,
    text: result.text,
    pages: result.text.split("\f"),
  };
}