import { ParsedDocument } from "../../knowledge-engine";

import { ConceptExtractionResult }
from "../../shared-types";

export interface ConceptExtractor {

    extract(
        document: ParsedDocument
    ): Promise<ConceptExtractionResult>;

}