import { promises as fs } from "fs";
import path from "path";

import { ConceptExtractionResult } from "../../shared-types";

export async function saveRawExtraction(
  result: ConceptExtractionResult,
  filename: string
): Promise<string> {
  const outputDirectory = path.resolve(
    "data/extractions/raw"
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const outputPath = path.join(
    outputDirectory,
    filename
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  return outputPath;
}