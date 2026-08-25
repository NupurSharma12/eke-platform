import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";
import {
  GeneratedQuestionDraftPoolSchema,
} from "../schemas/question-generation.schema";
import { QuestionGenerator } from "./QuestionGenerator";
import { AIProvider } from "../providers/AIProvider";
import { buildQuestionGenerationPrompt } from "../prompts/question-generation.prompt";

export class ClaudeQuestionGenerator implements QuestionGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generateBatch(
    blueprint: QuestionBlueprint,
    poolSize: number
  ): Promise<GeneratedQuestionDraft[]> {
    const prompt = buildQuestionGenerationPrompt(blueprint, poolSize);

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    // The wire shape is { questions: [...] } (see the schema's own
    // doc comment for why); callers of QuestionGenerator only care
    // about the draft array itself, so the wrapper is unwrapped here
    // and never leaks past this class.
    return GeneratedQuestionDraftPoolSchema.parse(rawResult).questions;
  }
}
