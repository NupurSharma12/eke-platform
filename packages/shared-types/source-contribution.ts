/**
 * The internal role a document's content plays inside EKE. Never
 * chosen directly by a user — always derived deterministically
 * from DocumentType (see classifyDocument). A single document may
 * have more than one contribution at once (an Olympiad book is
 * both depth-challenge and question-pattern), so this is always
 * used as a set (SourceContribution[]), not a single value.
 */
export type SourceContribution =
  | "core-knowledge"
  | "depth-challenge"
  | "question-pattern"
  | "assessment-pattern"
  | "student-evidence";
