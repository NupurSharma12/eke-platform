/**
 * Builds the prompt for classifying one already-observed question.
 * `observedText` and `sectionLabel` come directly from an
 * ObservedQuestionEvidence record — this function never re-derives
 * or alters them.
 */
export function buildQuestionTypeInterpretationPrompt(
  observedText: string,
  sectionLabel: string | null
): string {
  return `
You are classifying ONE question that was already observed in real
educational source material (a textbook, worksheet, exam paper, or
Olympiad material). You are NOT generating a new question, NOT
rewriting this one, and NOT solving it — you are only classifying the
question exactly as given below.

Observed question:
"""
${observedText}
"""
${
  sectionLabel
    ? `\nThis question appeared under the visible section heading "${sectionLabel}". You may use this as supporting context, but the observed question text above remains the primary evidence — never let the section heading override or contradict what the question itself actually asks.\n`
    : ""
}
Determine only two things:

- questionType: the observed form of this question. Choose exactly
  one of: "mcq" (options are given to choose from), "true-false",
  "fill-blanks" (a blank/missing word to complete), "matching"
  (matching one list of items to another), "sequencing" (ordering or
  arranging items), "short-answer" (a brief written response, no
  options given), "diagram-based" (the question depends on a diagram,
  image, or figure to answer), or "other" if none of these genuinely
  fit. Do not force it into one of the named categories if it
  genuinely doesn't fit — use "other" instead.
- answerStyle: a short, concrete description of how a learner is
  expected to answer this specific question (for example: "select one
  option", "write one word", "write a short sentence", "draw a line
  connecting each pair", "put the steps in the correct order").

Strict rules:

- Do not invent or assume anything not actually present in the
  observed question text above.
- Do not generate a new question of any kind.
- Do not rewrite or paraphrase the observed question.
- Do not solve the question or state its correct answer.
- Do not infer or report a difficulty level.
- Do not infer or report marks or scoring.
- Do not infer or assign a concept, concept name, or concept id.
- Do not infer or report curriculum scope, grade, subject, or board.
- Do not decide whether this question belongs to any particular
  chapter, section, or exam boundary.
- Do not group, compare, or cluster this question with any other
  question.
- Do not produce a generalized question pattern or template — classify
  only this specific observed question.

Return ONLY valid JSON in exactly this format:

{
  "questionType": "mcq",
  "answerStyle": "select one option"
}
`;
}
