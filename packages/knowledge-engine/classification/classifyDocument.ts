import { DocumentType, SourceContribution } from "../../shared-types";
import { DOCUMENT_TYPE_CONTRIBUTIONS } from "./documentTypeContributionMap";

/**
 * Deterministically derives what a document contributes to EKE
 * from what kind of document it is. Pure — no LLM call, no
 * network access, no filename/content heuristics. This is the
 * only place SourceContribution is ever decided.
 */
export function classifyDocument(
  documentType: DocumentType
): SourceContribution[] {
  return DOCUMENT_TYPE_CONTRIBUTIONS[documentType];
}
