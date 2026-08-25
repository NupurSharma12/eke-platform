import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";

export interface QuestionGenerator {
  /** One LLM call, returning a pool of up to `poolSize` draft questions sharing the blueprint. */
  generateBatch(
    blueprint: QuestionBlueprint,
    poolSize: number
  ): Promise<GeneratedQuestionDraft[]>;
}
