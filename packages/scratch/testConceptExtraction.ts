import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { parseDocument } from "../knowledge-engine/ingestion/parseDocument";
import { AIProvider } from "../ai/providers/AIProvider";
import { ClaudeProvider } from "../ai/providers/ClaudeProvider";
import { GroqProvider } from "../ai/providers/GroqProvider";
import { ClaudeConceptExtractor } from "../ai/extractors/ConceptExtractorService";
import {
  saveRawExtraction,
} from "../knowledge-engine/ingestion";

async function main() {
  const document = await parseDocument(
    "data/ncert/eemm103.pdf"
  );

  const provider: AIProvider =
    process.env.AI_PROVIDER === "groq"
      ? new GroqProvider()
      : new ClaudeProvider();

  const extractor =
    new ClaudeConceptExtractor(provider);

  const result =
    await extractor.extract(document);

    const outputPath =
  await saveRawExtraction(
    result,
    `${document.id}.json`
  );

console.log(
  `Raw extraction saved to: ${outputPath}`
);

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main().catch(console.error);