import { ConceptExtractionResult } from "../../shared-types";

export interface ExtractConceptsRequest {

  documentId: string;

  title: string;

  content: string;

  board?: string;

  grade?: number;

  subject?: string;
}

export async function extractConcepts(
  request: ExtractConceptsRequest
): Promise<ConceptExtractionResult> {

  throw new Error("Not implemented");

}