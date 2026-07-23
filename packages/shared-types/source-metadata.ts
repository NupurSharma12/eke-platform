import { DocumentType } from "./document-type";
import { SourceContribution } from "./source-contribution";

/**
 * Document-level information known at ingestion time, supplied
 * by the caller/ingestion layer — never inferred from LLM output.
 * `documentType` is the one thing a user actually chooses;
 * `contributions` is always derived from it deterministically
 * (see classifyDocument), not chosen directly.
 */
export interface SourceMetadata {
  sourceDocumentId: string;

  title: string;

  documentType: DocumentType;

  subject?: string;

  grade?: number;

  board?: string;

  provider?: string;

  contributions: SourceContribution[];
}
