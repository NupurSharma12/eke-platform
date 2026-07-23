// packages/ai/extractors/ConceptExtractor.ts

import {
  ExtractionInput,
  ConceptExtractionResult,
} from "../../shared-types";

export interface ConceptExtractor {
  extract(
    input: ExtractionInput
  ): Promise<ConceptExtractionResult>;
}
