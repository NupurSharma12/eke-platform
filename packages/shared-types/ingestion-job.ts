export type IngestionStatus =
  | "pending"
  | "parsing"
  | "extracting"
  | "normalizing"
  | "completed"
  | "failed";

export interface IngestionJob {

  id: string;

  documentId: string;

  status: IngestionStatus;

  progress: number;

  createdAt: string;

  updatedAt: string;

}