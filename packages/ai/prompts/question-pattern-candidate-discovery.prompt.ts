import { ObservedQuestionType } from "../../shared-types";

export interface QuestionPatternCandidateDiscoveryObservation {
  /** 1-indexed, local to this prompt only — never ObservedQuestionEvidence.id. */
  index: number;
  observedText: string;
  questionType: ObservedQuestionType;
  answerStyle: string;
  sectionLabel: string | null;
}

/**
 * Builds the prompt for partitioning ONE deterministic pre-group
 * (observations already known to share the same sourceDocumentId and
 * the same ObservedQuestionType) into zero or more groups of
 * genuinely reusable question forms. This is the ONLY LLM call made
 * per pre-group, regardless of how many groups the model ultimately
 * returns — the model itself performs the partitioning, not the
 * application, and not one call per resulting group.
 *
 * Local `index` values (never the real observedEvidenceId) are the
 * only way this prompt lets the model refer back to an observation —
 * see QuestionPatternCandidateDiscoveryService for why.
 */
export function buildQuestionPatternCandidateDiscoveryPrompt(
  observations: QuestionPatternCandidateDiscoveryObservation[]
): string {
  const observationsText = observations
    .map((observation) => {
      const sectionLine = observation.sectionLabel
        ? `\n   Section heading: "${observation.sectionLabel}"`
        : "";
      return (
        `Observation ${observation.index}:\n` +
        `   Question type (already classified): ${observation.questionType}\n` +
        `   Answer style: ${observation.answerStyle}${sectionLine}\n` +
        `   Text: "${observation.observedText}"`
      );
    })
    .join("\n\n");

  return `
You are analyzing a small set of already-observed, already-classified
questions from real educational source material. Every observation
below was already independently classified as the SAME observed
question type — that alone does NOT mean they represent the same
reusable question form. Your job is to decide which of these
observations genuinely share a reusable structural form, and which do
not.

You are NOT generating any new question. You are NOT rewriting or
solving any observed question. You are NOT assigning a concept,
chapter, difficulty, Bloom level, marks, or a generation question
type. You are NOT deciding curriculum scope. You are only grouping
these specific observations by their structural form and describing
each resulting group.

A shared reusable form means the observations ask the learner to do
the same KIND of thing in the same KIND of way — not that they use
the same words, and not merely that they were classified with the
same question type. For example, "Which animal gives us milk?" and
"Which animal lives in water?" can share a reusable form (a
multiple-choice question asking the learner to identify the correct
item from options based on a simple factual property). But "Match the
animals with their homes" must NOT be grouped with multiple-choice
questions just because it appears nearby or was loosely classified
alongside them.

You may use the section heading (when present) as supporting context
only — never let it by itself force observations into the same group
or into different groups.

Observations to partition:

${observationsText}

Strict rules:

- Every observation index above must appear in exactly one group in
  your output. Do not omit any observation, and do not place the same
  observation in more than one group.
- An observation that does not genuinely share a reusable form with
  any other observation must be returned as its own group of one.
- Do not invent an observation index that was not supplied above.
- Do not generate a new question, rewrite an observed question, or
  solve any question.
- Do not assign a concept, chapter, difficulty, Bloom level, marks, or
  generation question type to any group.
- patternDescription must describe the shared structural form of the
  group (what kind of question it is, and how a learner is expected
  to answer it) — not the exact wording of any single observation.

Return ONLY valid JSON in exactly this format:

{
  "groups": [
    {
      "observationIndexes": [1, 3],
      "patternDescription": "A multiple-choice question asking the learner to identify the correct item from several options based on a simple factual property."
    },
    {
      "observationIndexes": [2],
      "patternDescription": "A short-answer question asking the learner to name an example in their own words."
    }
  ]
}
`;
}
