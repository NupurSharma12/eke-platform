// packages/ai/extractors/ConceptExtractor.ts

import {
  ParsedDocument,
  ConceptExtractionResult,
} from "../../shared-types";

export interface ConceptExtractor {
  extract(
    document: ParsedDocument
  ): Promise<ConceptExtractionResult>;
}