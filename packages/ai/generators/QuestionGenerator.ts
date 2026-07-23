import { GeneratedQuestionDraft, QuestionBlueprint } from "../../shared-types";

export interface QuestionGenerator {
  generate(blueprint: QuestionBlueprint): Promise<GeneratedQuestionDraft>;
}
