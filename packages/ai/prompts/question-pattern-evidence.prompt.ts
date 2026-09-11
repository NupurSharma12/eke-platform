/**
 * Builds the prompt for observed-question-evidence extraction. The
 * input is `documentEvidence` — the same page-labelled
 * TEXT:/OCR:/VISUAL EVIDENCE: text buildDocumentEvidenceText()
 * already produces for concept extraction and assessment-structure
 * extraction (see packages/ai/prompts/documentEvidence.ts). This
 * function only builds the instructions around that evidence; it
 * never re-derives or reformats the evidence itself.
 */
export function buildQuestionPatternEvidencePrompt(
  documentEvidence: string
): string {
  return `
You are analyzing educational source material (a textbook, worksheet,
exam paper, or Olympiad material) to identify ACTUAL QUESTIONS that
appear in the supplied document.

Look for things such as: textbook exercise questions, "Let's
Practise"-style questions, worksheet questions, previous exam
questions, Olympiad questions, fill-in-the-blank questions, matching
questions, true/false questions, multiple-choice questions,
short-answer questions, diagram-based questions, and
sequencing/order questions. This is not an exhaustive list — identify
any actual question or exercise item genuinely present in the
document.

For each observed question, report:

- startPage / endPage: the PAGE N labels bounding where this question
  appears, inclusive. Most questions are on a single page
  (startPage === endPage); use a wider span only when the same
  question genuinely continues across pages (e.g. the question stem
  on one page, its options or diagram on the next). Do not treat
  every page boundary as a new question.
- sectionLabel: a visible exercise/section heading this question
  appears under (for example "Let's Practise", "Exercise 3B",
  "Practice Questions"), ONLY when that heading is actually present
  in the supplied evidence. Omit it (or return null) if no such
  label is visible — never invent one.
- observedText: the question's own wording, transcribed as it
  actually appears.

Strict rules:

- Do not invent questions. Report only ones genuinely present in the
  supplied evidence.
- Do not complete missing text. If a question is cut off, incomplete,
  or continues onto another page, represent that with the page span
  and transcribe only what is actually there — do not fill in a
  plausible ending.
- Do not paraphrase when transcription is possible. Transcribe the
  actual wording, not a summary of it.
- Do not generate or infer answers to any question.
- Do not infer difficulty.
- Do not infer marks or scoring.
- Do not infer concepts or concept names.
- Do not infer curriculum scope, grade, subject, or board.
- Do not generate new practice questions of your own.
- Do not turn an observed question into a generalized template or
  pattern description — report the specific question as it appears,
  not an abstraction of it.
- Do not classify the question into any type category — that
  classification is not part of this task.
- This is a plain transcription/identification task. If the document
  (or the portion you were given) contains no observable questions at
  all, that is a valid outcome — return an empty list rather than
  fabricating one.

Return ONLY valid JSON in exactly this format:

{
  "questions": [
    {
      "startPage": 5,
      "endPage": 5,
      "sectionLabel": "Let's Practise",
      "observedText": "1. Name two living things and two non-living things you can see around you."
    }
  ]
}

Document evidence:
"""
${documentEvidence}
"""
`;
}
