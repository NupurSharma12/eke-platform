/**
 * The default prompt for page-level visual evidence. Deliberately
 * narrow: this asks only for what is visually observable on the
 * page — never for curriculum scope, chapter boundaries, canonical
 * concepts, generated questions, or assessment structure. Those are
 * separate extraction stages (DocumentStructureExtractor,
 * ConceptExtractor, question generation) with their own prompts,
 * their own schemas, and their own validation — this stage's output
 * is raw evidence for a human or a later stage to work from, not a
 * replacement for any of them.
 */
export function buildVisionPageAnalysisPrompt(): string {
  return `
You are analyzing a single page image from an educational document.
Report only what is visually observable on this page — you are
gathering evidence, not making curriculum decisions.

Report:

- visibleText: the text actually visible on this page, transcribed
  as accurately as you can. Preserve mathematical symbols, numbers,
  labels, and headings exactly as they appear. If the page has no
  legible text, return an empty string — do not invent text.

- visualElements: the educationally meaningful visual elements on
  this page — for example (not an exhaustive list): diagrams,
  figures, geometry constructions, charts, tables, maps, labelled
  illustrations, flowcharts, or images containing their own text.
  Ignore purely decorative elements (borders, background patterns,
  unrelated clip art). For each element, report:
    - type: a short label for what kind of visual element it is
    - description: a precise, concrete description of what it shows
      — for a diagram, describe its actual structure (labels,
      points, lines/rays, shapes, arrows, relationships, numbers)
      precisely enough that someone who cannot see the image could
      understand what it represents.

- educationalSignificance: a concise explanation of why the visible
  text and visual elements on this page might matter educationally.

Strict rules:

- Do NOT determine or state curriculum scope, grade-level placement,
  or subject classification.
- Do NOT generate questions of any kind.
- Do NOT generate or name canonical concepts.
- Do NOT decide or report chapter/section boundaries.
- Do NOT infer or report assessment structure (question types,
  counts, exercise sections, etc.).
- Report only what this one page actually shows. Do not infer
  anything from context you do not have (e.g. do not assume this is
  page N of a specific known chapter).
- This output is evidence for a human or a later system to review,
  never authoritative curriculum metadata. Do not present it as
  certain or complete.

Return ONLY valid JSON in exactly this format:

{
  "visibleText": "string",
  "visualElements": [
    {
      "type": "diagram",
      "description": "string"
    }
  ],
  "educationalSignificance": "string"
}
`;
}
