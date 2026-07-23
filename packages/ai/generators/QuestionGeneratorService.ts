import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";
import {
  GeneratedQuestionDraftSchema,
} from "../schemas/question-generation.schema";
import { QuestionGenerator } from "./QuestionGenerator";
import { AIProvider } from "../providers/AIProvider";
import { buildQuestionGenerationPrompt } from "../prompts/question-generation.prompt";

export class ClaudeQuestionGenerator implements QuestionGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generate(
    blueprint: QuestionBlueprint
  ): Promise<GeneratedQuestionDraft> {
    const prompt = buildQuestionGenerationPrompt(blueprint);

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    return GeneratedQuestionDraftSchema.parse(rawResult);
  }
}
