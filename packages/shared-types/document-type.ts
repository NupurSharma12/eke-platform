/**
 * What kind of document a parent/user uploaded, in plain terms.
 * This is the only thing a user is ever asked to choose — the
 * internal SourceContribution is derived from it deterministically
 * (see classifyDocument), never selected directly by the user.
 */
export type DocumentType =
  | "textbook"
  | "olympiad"
  | "worksheet"
  | "assignment"
  | "exam"
  | "answer-key"
  | "student-work"
  | "other";

export const DOCUMENT_TYPES: DocumentType[] = [
  "textbook",
  "olympiad",
  "worksheet",
  "assignment",
  "exam",
  "answer-key",
  "student-work",
  "other",
];
