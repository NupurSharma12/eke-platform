export function buildAssessmentStructureExtractionPrompt(
  documentText: string
): string {
  return `
You are analyzing an assessment document (an exam paper or Olympiad
sample paper) to record its observed question structure.

Read through the document and count how many questions of each type
actually appear. Do not evaluate the questions, do not solve them, and
do not summarize their content.

Report ONLY what is directly observable in the document:

- questionType: one of "mcq", "visual", "word-problem", "reasoning",
  "fill-blanks", "olympiad" — whichever best matches how each question
  is actually posed
- count: how many questions of that type you counted

Do NOT report, infer, or invent any of the following, even if the
document seems to imply them:

- difficulty level
- marks or scoring
- sections or section names
- curriculum scope, grade, subject, or board
- concept names or concept mappings

If the document does not look like an assessment/question paper at
all, return the question types and counts you can still observe rather
than fabricating a section that isn't there.

Return ONLY valid JSON in exactly this format:

{
  "allocations": [
    { "questionType": "mcq", "count": 0 }
  ]
}

Document:
"""
${documentText}
"""
`;
}
