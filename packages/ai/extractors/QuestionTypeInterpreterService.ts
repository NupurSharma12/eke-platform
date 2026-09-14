import { ObservedQuestionEvidence, InterpretedQuestionEvidence } from "../../shared-types";
import { QuestionTypeInterpretationResultSchema } from "../schemas/question-type-interpretation.schema";
import { QuestionTypeInterpreter } from "./QuestionTypeInterpreter";
import { AIProvider } from "../providers/AIProvider";
import { buildQuestionTypeInterpretationPrompt } from "../prompts/question-type-interpretation.prompt";

/**
 * Validates the supplied evidence before any provider call is made —
 * invalid evidence must never reach the LLM. Throws a plain Error,
 * matching this codebase's existing convention for a request that
 * has no valid result to compute (see e.g.
 * discoverExamBlueprint/DocumentStructureExtractorService's own
 * page-count check).
 */
function validateEvidence(evidence: ObservedQuestionEvidence): void {
  if (!evidence.id || evidence.id.trim().length === 0) {
    throw new Error(
      "QuestionTypeInterpreter requires evidence.id to be a non-empty string."
    );
  }

  if (!evidence.sourceDocumentId || evidence.sourceDocumentId.trim().length === 0) {
    throw new Error(
      "QuestionTypeInterpreter requires evidence.sourceDocumentId to be a non-empty string."
    );
  }

  if (!evidence.observedText || evidence.observedText.trim().length === 0) {
    throw new Error(
      "QuestionTypeInterpreter requires evidence.observedText to be non-empty."
    );
  }

  const { start, end } = evidence.page;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start <= 0 ||
    end <= 0 ||
    start > end
  ) {
    throw new Error(
      `QuestionTypeInterpreter requires a valid page range (positive integers, start <= end); ` +
      `received start=${start}, end=${end}.`
    );
  }
}

/**
 * Turns one ObservedQuestionEvidence record into one
 * InterpretedQuestionEvidence via one LLM call, validated through
 * QuestionTypeInterpretationResultSchema before anything else
 * touches it.
 *
 * Every application-owned field (observedEvidenceId, interpretedAt,
 * status) is assigned here, by this code, never trusted from the LLM
 * response — same discipline every other extractor in this codebase
 * already applies to provenance/identity facts. `observedEvidenceId`
 * in particular is always `evidence.id`, never anything the LLM
 * response might contain (the schema doesn't even define a field for
 * it, so any LLM-supplied value is silently dropped by Zod's default
 * parsing before it could ever be used).
 */
export class ClaudeQuestionTypeInterpreter implements QuestionTypeInterpreter {
  constructor(private readonly provider: AIProvider) {}

  async interpret(evidence: ObservedQuestionEvidence): Promise<InterpretedQuestionEvidence> {
    validateEvidence(evidence);

    const prompt = buildQuestionTypeInterpretationPrompt(
      evidence.observedText,
      evidence.sectionLabel
    );

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    const validated = QuestionTypeInterpretationResultSchema.parse(rawResult);

    return {
      observedEvidenceId: evidence.id,
      questionType: validated.questionType,
      answerStyle: validated.answerStyle,
      interpretedAt: new Date().toISOString(),
      status: "pending",
    };
  }
}
