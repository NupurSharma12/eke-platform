import { promises as fs } from "fs";
import path from "path";

import { ConceptExtractionResult } from "../../shared-types";

/**
 * Where a raw extraction checkpoint for `filename` lives.
 * Exported so callers (e.g. the batch pipeline) can check
 * whether a checkpoint already exists without re-deriving or
 * duplicating this path convention themselves.
 */
export function getRawExtractionPath(filename: string): string {
  return path.join(
    path.resolve("data/extractions/raw"),
    filename
  );
}

export async function saveRawExtraction(
  result: ConceptExtractionResult,
  filename: string
): Promise<string> {
  const outputPath = getRawExtractionPath(filename);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  return outputPath;
}