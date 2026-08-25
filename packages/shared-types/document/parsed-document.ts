export interface ParsedDocument {
  id: string;

  filename: string;

  kind: "pdf";

  text: string;

  pages: string[];
}