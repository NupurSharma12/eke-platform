import { NextRequest, NextResponse } from "next/server";

import { generateQuestion } from "@/packages/generateQuestion";
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  GeminiProvider,
  resolveProviderName,
  ClaudeQuestionGenerator,
  ClaudeQuestionReviewer,
} from "@/packages/ai";
import { DifficultyLevel, QuestionType } from "@/packages/shared-types";
// Specific submodule, not the top-level knowledge-engine barrel —
// that barrel also re-exports ./ingestion (pdf-parse/pdfjs-dist),
// which breaks Next's webpack bundling for route handlers. Same
// reasoning already applied to generateQuestion.ts's own imports.
import { validateQuestionGenerationRequest } from "@/packages/knowledge-engine/questionGeneration";
import {
  findAttemptedQuestionIds,
  QuestionPoolExhaustedError,
} from "@/packages/knowledge-engine/studentAttempts";

interface GenerateQuestionRequestBody {
  conceptId?: string;
  difficulty?: DifficultyLevel;
  questionType?: QuestionType;
  /** Optional — when provided, cached questions this student has already attempted are excluded. */
  studentId?: string;
  /** Optional — how many questions to seed the pool with on a first-time miss. Defaults to DEFAULT_POOL_SIZE. */
  poolSize?: number;
}

const DEFAULT_QUESTION_TYPE: QuestionType = "mcq";

/**
 * The web entry point into the existing generateQuestion
 * orchestration (offline-first bank lookup -> blueprint ->
 * pool generation -> structural/consistency/review validation per
 * draft -> persistence), the same flow packages/generateQuestion.ts's
 * CLI already runs. A first-time (conceptId, difficulty, questionType)
 * miss seeds a shared pool of ~poolSize questions from a single LLM
 * call; this and every subsequent request against that combo (this
 * student's Next click, or any other student's) serves one question
 * from that pool until this student has attempted all of it.
 * questionType defaults to "mcq" when omitted (the
 * only type the current UI asks for) but an explicitly-provided
 * type is honored and validated — never silently coerced to mcq.
 * Reuses validateQuestionGenerationRequest (the same check
 * generateQuestion() runs internally) so an unsupported type is
 * rejected here, as a clear 400, before any provider is even
 * constructed. Provider selection mirrors the existing AI_PROVIDER
 * convention used by the other entry scripts.
 */
export async function POST(request: NextRequest) {
  let body: GenerateQuestionRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.conceptId) {
    return NextResponse.json(
      { error: "conceptId is required" },
      { status: 400 }
    );
  }

  const generationRequest = {
    conceptId: body.conceptId,
    difficulty: body.difficulty,
    questionType: body.questionType ?? DEFAULT_QUESTION_TYPE,
  };

  const requestValidation = validateQuestionGenerationRequest(generationRequest);
  if (!requestValidation.valid) {
    return NextResponse.json(
      { error: requestValidation.errors.join(", ") },
      { status: 400 }
    );
  }

  try {
    const providerName = resolveProviderName(process.env.AI_PROVIDER);
    const provider: AIProvider =
      providerName === "groq"
        ? new GroqProvider()
        : providerName === "gemini"
        ? new GeminiProvider()
        : new ClaudeProvider();

    const generator = new ClaudeQuestionGenerator(provider);
    const reviewer = new ClaudeQuestionReviewer(provider);

    const excludeQuestionIds = body.studentId
      ? await findAttemptedQuestionIds(body.studentId)
      : undefined;

    const question = await generateQuestion(generationRequest, generator, reviewer, {
      excludeQuestionIds,
      poolSize: body.poolSize,
    });

    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof QuestionPoolExhaustedError) {
      return NextResponse.json(
        { error: error.message, poolExhausted: true },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
