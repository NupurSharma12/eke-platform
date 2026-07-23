import { QuestionBlueprint } from "../../shared-types";

/**
 * Builds a compact generation prompt from a QuestionBlueprint —
 * never from a raw source document or extraction checkpoint. The
 * only "content" involved is the canonical concept's own short
 * explanation (already a curated field, not a textbook chunk) and,
 * when evidence-derived, one real pattern description drawn from
 * an already-extracted QuestionPattern.
 */
export function buildQuestionGenerationPrompt(
  blueprint: QuestionBlueprint
): string {
  const patternGuidance =
    blueprint.origin === "evidence-derived"
      ? `Base the style and structure of the question on this real pattern from educational material: "${blueprint.description}"`
      : `No existing example pattern is available for this concept. Use the concept explanation below and your own judgement to write an appropriate ${blueprint.difficulty}-difficulty question.`;

  return `
You are generating one practice question for a Grade 5 student.

Concept: ${blueprint.conceptName}
Concept explanation: ${blueprint.origin === "llm-inferred" ? blueprint.description : ""}
Question type: ${blueprint.questionType}
Difficulty: ${blueprint.difficulty}
${blueprint.bloomLevel ? `Bloom level: ${blueprint.bloomLevel}` : ""}

${patternGuidance}

Return ONLY valid JSON in exactly this format:

{
  "questionText": "string",
  "questionType": "${blueprint.questionType}",
  "options": ["string", "string", "..."],
  "correctAnswer": "string",
  "explanation": "string"
}

Omit "options" entirely if the question type does not use discrete options.
If questionType is "mcq", correctAnswer must be one of the strings in "options".
`;
}
