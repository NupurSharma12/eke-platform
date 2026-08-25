import { QuestionBlueprint } from "../../shared-types";

const VISUAL_SPEC_KINDS = `
{ "type": "fraction-bar", "totalParts": number, "shadedParts": number, "layout"?: "horizontal" | "circle" }
  - a bar or circle split into totalParts equal parts, shadedParts of them filled in. shadedParts must be <= totalParts.
{ "type": "shape", "shape": "triangle" | "square" | "rectangle" | "circle" | "pentagon" | "hexagon", "labels"?: { "sides"?: number[], "vertices"?: string[] } }
{ "type": "angle", "angleType": "acute" | "right" | "obtuse" | "straight" | "reflex", "degrees": number }
  - angleType must be the correct classification of degrees (acute < 90, right = 90, obtuse 90-180, straight = 180, reflex > 180).
{ "type": "bar-chart", "bars": [{ "label": string, "value": number }, ...] (2 to 8 bars), "yAxisLabel"?: string }
{ "type": "number-line", "min": number, "max": number, "step"?: number, "markers"?: number[] }
  - markers must fall within [min, max].
`.trim();

/**
 * Builds a compact generation prompt from a QuestionBlueprint —
 * never from a raw source document or extraction checkpoint. The
 * only "content" involved is the canonical concept's own short
 * explanation (already a curated field, not a textbook chunk) and,
 * when evidence-derived, one real pattern description drawn from
 * an already-extracted QuestionPattern.
 *
 * Asks for a whole pool of `poolSize` questions in a single request
 * (the question-pool model: one LLM call seeds many candidates for
 * a concept/difficulty/questionType combo, each still independently
 * validated and reviewed after the fact — see generateQuestion.ts)
 * rather than one question per call. Each pool member carries the
 * same per-question self-verification requirements a single-question
 * prompt would.
 */
export function buildQuestionGenerationPrompt(
  blueprint: QuestionBlueprint,
  poolSize: number
): string {
  const patternGuidance =
    blueprint.origin === "evidence-derived"
      ? `Base the style and structure of the questions on this real pattern from educational material: "${blueprint.description}". Note: this pattern's original diagram (if any) was never captured by this system — you are not reproducing it, only using its topic and structure as inspiration for brand-new questions.`
      : `No existing example pattern is available for this concept. Use the concept explanation below and your own judgement to write appropriate ${blueprint.difficulty}-difficulty questions.`;

  return `
You are generating a pool of ${poolSize} distinct practice questions for a Grade 5 student. All ${poolSize} questions must share the same concept, question type, and difficulty below, but each must be meaningfully different from every other one in the pool — vary the specific numbers, scenarios, and phrasing so no two are the same question in disguise.

Concept: ${blueprint.conceptName}
Concept explanation: ${blueprint.origin === "llm-inferred" ? blueprint.description : ""}
Question type: ${blueprint.questionType}
Difficulty: ${blueprint.difficulty}
${blueprint.bloomLevel ? `Bloom level: ${blueprint.bloomLevel}` : ""}

${patternGuidance}

For EACH question, before finalizing it, verify your own work:
- Recompute the correct answer yourself from the numbers you chose. Do not state an answer you have not independently checked.
- If the answer represents a count of discrete, indivisible objects (e.g. slices, people, coins), choose numbers so the answer is a whole number — never a fraction or decimal count of something indivisible.
- Use only numbers that are actually necessary to solve the question; do not add irrelevant information.
- Make sure the explanation's reasoning genuinely supports the stated correct answer.
- For "olympiad" difficulty, the question must require genuine multi-step reasoning, not a single trivial calculation.

About visuals (applies independently per question):
- If a question is naturally about a diagram, shape, angle, chart, or number line (including one described by the pattern above), include a "visualSpec" object matching exactly one of these shapes:
${VISUAL_SPEC_KINDS}
- There is no image-generation step — the visualSpec's numbers are rendered directly by fixed, deterministic components. Never describe a visual in prose (e.g. "see the shaded region below") without also including a matching visualSpec; if you can't express it as one of the shapes above, don't reference a visual at all and write a fully text-answerable question instead.
- The visualSpec's numbers must genuinely match that question's questionText, correctAnswer, and explanation. For example, a fraction-bar with totalParts 4 and shadedParts 2 means correctAnswer must be equivalent to 1/2 — not some other fraction.
- Most questions have no visual at all — omit "visualSpec" entirely for a question unless a supported visual genuinely fits it.

Return ONLY valid JSON: a single JSON object with exactly one top-level key, "questions", whose value is an array of exactly ${poolSize} objects, each in exactly this format:

{
  "questions": [
    {
      "questionText": "string",
      "questionType": "${blueprint.questionType}",
      "options": ["string", "string", "..."],
      "correctAnswer": "string",
      "explanation": "string",
      "visualSpec": { ... } (omit entirely if this question has no visual)
    },
    ...
  ]
}

Do not return a bare JSON array as the top-level response — it must be an object with a "questions" key as shown above.
Omit "options" entirely for a question if its type does not use discrete options.
If questionType is "mcq", each question's correctAnswer must be one of the strings in its own "options".
`;
}
