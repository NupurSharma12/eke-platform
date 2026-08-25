import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";
import { QuestionReviewResultSchema } from "../schemas/question-review.schema";
import { QuestionReviewer, QuestionReviewResult } from "./QuestionReviewer";
import { AIProvider } from "../providers/AIProvider";
import { buildQuestionReviewPrompt } from "../prompts/question-review.prompt";

export class ClaudeQuestionReviewer implements QuestionReviewer {
  constructor(private readonly provider: AIProvider) {}

  async review(
    draft: GeneratedQuestionDraft,
    blueprint: QuestionBlueprint
  ): Promise<QuestionReviewResult> {
    const prompt = buildQuestionReviewPrompt(draft, blueprint);

    const response = await this.provider.generate(prompt);

    const rawResult = JSON.parse(response);

    return QuestionReviewResultSchema.parse(rawResult);
  }
}
