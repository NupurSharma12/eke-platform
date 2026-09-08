/**
 * Builds a page-labelled prompt from ParsedDocument.pages — never
 * pass a flattened ParsedDocument.text into this, the page labels
 * ARE the mechanism that lets the model report a real, checkable
 * page range instead of an unlocatable guess.
 *
 * `imagePageNumbers` (1-indexed, matching the "PAGE N" labels) marks
 * pages that have no extractable text and are instead being sent as
 * attached images alongside this prompt, in the same relative order
 * as they appear here — DocumentStructureExtractorService is
 * responsible for actually attaching them in that order via
 * ImageCapableProvider.generateFromImages. Omitting this parameter
 * (or passing an empty array) reproduces the original text-only
 * prompt exactly.
 */
export function buildDocumentStructureExtractionPrompt(
  pages: string[],
  imagePageNumbers: number[] = []
): string {
  const imagePageSet = new Set(imagePageNumbers);
  let imageOrdinal = 0;

  const labelledPages = pages
    .map((pageText, index) => {
      const pageNumber = index + 1;
      if (imagePageSet.has(pageNumber)) {
        imageOrdinal += 1;
        return (
          `PAGE ${pageNumber}\n` +
          `[No extractable text on this page. This page is attached as ` +
          `image ${imageOrdinal} of ${imagePageNumbers.length}, in the same ` +
          `order as the "PAGE N" labels appear here.]`
        );
      }
      return `PAGE ${pageNumber}\n${pageText}`;
    })
    .join("\n\n");

  const imageInstructions =
    imagePageNumbers.length > 0
      ? `\nSome pages above have no extractable text and are instead provided ` +
        `as attached images, in the same order their "PAGE N" label appears ` +
        `above. Read those images directly — the same way you would read ` +
        `page text — to identify chapter titles, boundaries, and ` +
        `exercise/practice sections on those pages.\n`
      : "";

  return `
You are analyzing an educational document to identify candidate
structural ranges: where chapter/unit content is, and where
exercise/practice sections are.

The document has been split into pages and labelled "PAGE 1", "PAGE
2", and so on. These PAGE numbers are the ONLY page indexes you may
report — they refer to the document's own page order as supplied
below, not any printed page number that may appear inside the page
text itself (a page's own body text might read "33" or "Page 33" —
that is the textbook's own printed page number, not the index you
must use; always use the "PAGE N" label instead).

For each candidate range you identify, report:

- kind: "content" (chapter/unit explanatory material) or "exercise"
  (practice/exercise/question material)
- startPage / endPage: the PAGE N labels bounding this range,
  inclusive
- chapterTitle (only for kind "content", only if genuinely
  observable): the chapter/unit title as it actually appears in the
  text
- chapterNumber (only for kind "content", only if genuinely
  observable): the chapter/unit number as it actually appears
- evidence: a short, human-checkable quote or concise description of
  the actual text that supports this range (e.g. a heading you saw,
  or the change in content style you observed)

Exercise/practice sections may be labelled informally — for example
(not an exhaustive list): "Exercises", "Exercise", "Practice", "Let's
Practice", "Let Us Do", "Questions", "Review", "Activities", "Think
and Answer". Identify an exercise/practice range by what the text
actually does (a shift from explanatory prose to questions/prompts,
or an explicit heading like the examples above), not by matching
against this exact list.

Strict rules:

- Use ONLY evidence actually present in the supplied page text. Do
  not invent chapter names or numbers.
- Do not infer any structure from a filename — none is given to you,
  and none should be assumed.
- Do not treat a printed page number found inside the text as a page
  index — only the "PAGE N" labels are valid page indexes.
- If a boundary cannot be established reliably from the text, do not
  report it. It is better to omit a range than to fabricate one.
- Do not report a numeric confidence score of any kind — none is
  wanted and none will be used.
- This output is a candidate interpretation for a human to review,
  never verified curriculum truth. Do not present it as certain.
${imageInstructions}
Return ONLY valid JSON in exactly this format:

{
  "ranges": [
    {
      "kind": "content",
      "startPage": 1,
      "endPage": 3,
      "chapterTitle": "Angles as Turns",
      "chapterNumber": 3,
      "evidence": "Page 1 heading reads \\"Chapter 3 — Angles as Turns\\""
    },
    {
      "kind": "exercise",
      "startPage": 4,
      "endPage": 5,
      "evidence": "Page 4 begins with the heading \\"Let Us Do\\" followed by numbered questions"
    }
  ]
}

Document pages:
"""
${labelledPages}
"""
`;
}
