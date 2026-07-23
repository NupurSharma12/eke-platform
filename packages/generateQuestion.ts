import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import { randomUUID } from "crypto";

import {
  GeneratedQuestion,
  QuestionGenerationRequest,
  DifficultyLevel,
  QuestionType,
} from "./shared-types";
import {
  loadKnowledgeGraph,
  CANONICAL_GRAPH_FILENAME,
  loadQuestionPatterns,
  findQuestions,
  saveGeneratedQuestion,
  buildBlueprint,
  validateQuestionGenerationRequest,
  validateGeneratedQuestion,
} from "./knowledge-engine";
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  QuestionGenerator,
  ClaudeQuestionGenerator,
} from "./ai";

const MAX_GENERATION_ATTEMPTS = 2;

/**
 * The end-to-end question generation flow:
 *
 *   1. Offline-first: search the Question Bank. A suitable
 *      existing question is returned immediately — the LLM is
 *      never called on a cache hit.
 *   2. On a miss: load the canonical concept and its
 *      QuestionPatterns, build a blueprint (evidence-derived if a
 *      suitable pattern exists, llm-inferred otherwise), call the
 *      LLM through the injected QuestionGenerator, and validate
 *      the result.
 *   3. On validation failure, retry once; if it still fails, throw
 *      a clear error rather than returning something unusable. If
 *      the LLM call itself throws (provider unavailable), that
 *      propagates immediately and is never swallowed — the error
 *      message makes clear that no cached question existed
 *      either, so this is a real failure, not silent.
 *   4. A valid question is saved to the bank and returned.
 *
 * This function lives at the top level (not inside
 * knowledge-engine/) because it needs the AI-side QuestionGenerator
 * interface — the same layering already used by
 * runBatchPipeline.ts's processPdf/runBatch, which similarly needs
 * ConceptExtractor. knowledge-engine/ itself has no dependency on
 * ai/ anywhere in this codebase, and this preserves that.
 */
export async function generateQuestion(
  request: QuestionGenerationRequest,
  generator: QuestionGenerator
): Promise<GeneratedQuestion> {
  const requestValidation = validateQuestionGenerationRequest(request);
  if (!requestValidation.valid) {
    throw new Error(
      `Invalid QuestionGenerationRequest: ${requestValidation.errors.join(", ")}`
    );
  }

  const cached = await findQuestions({
    conceptId: request.conceptId,
    difficulty: request.difficulty,
    questionType: request.questionType,
    patternIds: request.patternIds,
  });

  if (cached.length > 0) {
    return cached[0];
  }

  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);
  const concept = graph.concepts.find((c) => c.id === request.conceptId);

  if (!concept) {
    throw new Error(`Unknown concept: "${request.conceptId}"`);
  }

  const patterns = await loadQuestionPatterns(request.conceptId);

  const blueprint = buildBlueprint(
    concept,
    request,
    patterns,
    new Date().toISOString()
  );

  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const draft = await generator.generate(blueprint);
    const validation = validateGeneratedQuestion(draft, request);

    if (validation.valid) {
      const question: GeneratedQuestion = {
        id: randomUUID(),
        conceptId: concept.id,
        questionType: draft.questionType,
        difficulty: blueprint.difficulty,
        questionText: draft.questionText,
        options: draft.options,
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation,
        sourcePatternIds: blueprint.sourcePatternIds,
        origin: blueprint.origin,
        generatedBy: "llm",
        createdAt: new Date().toISOString(),
      };

      await saveGeneratedQuestion(question);
      return question;
    }

    lastErrors = validation.errors;
  }

  throw new Error(
    `No cached question found for concept "${request.conceptId}", and generation failed validation after ${MAX_GENERATION_ATTEMPTS} attempt(s): ${lastErrors.join(", ")}`
  );
}

function parseArg(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

export function parseGenerationArgs(argv: string[]): QuestionGenerationRequest {
  const conceptId = parseArg(argv, "--concept");

  if (!conceptId) {
    throw new Error(
      "Usage: generateQuestion.ts --concept <conceptId> [--difficulty <level>] [--type <questionType>]"
    );
  }

  return {
    conceptId,
    difficulty: parseArg(argv, "--difficulty") as DifficultyLevel | undefined,
    questionType: parseArg(argv, "--type") as QuestionType | undefined,
  };
}

async function main() {
  const request = parseGenerationArgs(process.argv.slice(2));

  const provider: AIProvider =
    process.env.AI_PROVIDER === "groq"
      ? new GroqProvider()
      : new ClaudeProvider();

  const generator = new ClaudeQuestionGenerator(provider);

  const question = await generateQuestion(request, generator);

  console.log(JSON.stringify(question, null, 2));
  console.log(
    `\norigin=${question.origin} sourcePatterns=${question.sourcePatternIds.length}`
  );
}

const isMain = process.argv[1]?.endsWith("generateQuestion.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
