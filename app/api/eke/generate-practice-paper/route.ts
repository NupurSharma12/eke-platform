import { NextRequest, NextResponse } from "next/server";

import { loadKnowledgeGraph, CANONICAL_GRAPH_FILENAME } from "@/packages/knowledge-engine/graph";
import { loadChapterRegistry } from "@/packages/knowledge-engine/curriculum";
// Specific submodules, not the examPlanning barrel: that barrel also
// re-exports ./loadAllowedPatternIds, which pulls in ./ingestion
// (pdf-parse/pdfjs-dist) — the same webpack-bundling break already
// documented and worked around in packages/generateQuestion.ts and
// app/api/eke/generate-question/route.ts. This is a pure import-path
// change; none of the referenced logic moved or changed.
import { resolveExamScope } from "@/packages/knowledge-engine/examPlanning/resolveExamScope";
import { generatePracticePaper } from "@/packages/knowledge-engine/examPlanning/generatePracticePaper";
import { PendingChapterSelectedError } from "@/packages/knowledge-engine/examPlanning/PendingChapterSelectedError";
import { ExamBlueprint } from "@/packages/knowledge-engine/examPlanning/examBlueprint";
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  GeminiProvider,
  resolveProviderName,
  ClaudeQuestionGenerator,
  ClaudeQuestionReviewer,
} from "@/packages/ai";
import { findAttemptedQuestionIds } from "@/packages/knowledge-engine/studentAttempts";

interface GeneratePracticePaperRequestBody {
  gradeId?: number;
  subjectId?: string;
  chapterId?: string;
  studentId?: string;
}

/**
 * Explicit, deterministic MVP blueprint — not discoverExamBlueprint().
 * There is no integrated, real AssessmentStructureEvidence loading
 * path for this UI flow yet (see the Step 9 investigation report);
 * fabricating evidence just to exercise discoverExamBlueprint() was
 * explicitly ruled out. This constant is intentionally the only
 * thing standing in for that later capability, and is meant to be
 * replaced wholesale once real evidence loading exists — it carries
 * no marks-total logic, just a small, useful, demonstrable paper.
 */
const MVP_PRACTICE_BLUEPRINT: ExamBlueprint = {
  allocations: [
    {
      questionType: "mcq",
      difficulty: "grade",
      count: 5,
      marksEach: 1,
    },
  ],
};

/**
 * The web entry point into the existing exam-planning + generation
 * orchestration:
 *
 *   loadChapterRegistry (grade, subject)
 *     -> find the requested chapter, whatever its status
 *     -> resolveExamScope([chapter], concepts)   (authoritative
 *        confirmed/pending gate — this route never trusts a
 *        chapter's status as reported by the content-catalog
 *        /api/eke/chapters endpoint; it re-resolves scope itself)
 *     -> generatePracticePaper(scope, MVP_PRACTICE_BLUEPRINT, ...)
 *
 * Mirrors app/api/eke/generate-question/route.ts's structure
 * (validate -> construct provider/generator/reviewer -> call
 * orchestration -> map known errors to status codes). Generation
 * source policy is deliberately not exposed here: no sourcePolicy is
 * passed to generatePracticePaper, so Step 8's existing "no policy
 * supplied" behavior applies unchanged (no patternIds are passed to
 * generateQuestion, exactly as before Step 8).
 */
export async function POST(request: NextRequest) {
  let body: GeneratePracticePaperRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.gradeId !== "number" || !Number.isInteger(body.gradeId)) {
    return NextResponse.json(
      { error: "gradeId is required and must be an integer" },
      { status: 400 }
    );
  }

  if (!body.subjectId) {
    return NextResponse.json(
      { error: "subjectId is required" },
      { status: 400 }
    );
  }

  if (!body.chapterId) {
    return NextResponse.json(
      { error: "chapterId is required" },
      { status: 400 }
    );
  }

  let registry;
  try {
    registry = await loadChapterRegistry(body.gradeId, body.subjectId);
  } catch (error) {
    return NextResponse.json(
      {
        error: `No curriculum found for the requested grade/subject: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 400 }
    );
  }

  const chapter = registry.chapters.find((c) => c.id === body.chapterId);
  if (!chapter) {
    return NextResponse.json(
      { error: `Unknown chapterId "${body.chapterId}" for this grade/subject` },
      { status: 400 }
    );
  }

  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);

  let scope;
  try {
    scope = resolveExamScope([chapter], graph.concepts);
  } catch (error) {
    if (error instanceof PendingChapterSelectedError) {
      return NextResponse.json(
        {
          error:
            "The selected chapter is not yet confirmed and is not currently available for practice-paper generation.",
          pendingChapterIds: error.pendingChapterIds,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  if (scope.eligibleConceptIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "The selected chapter has no associated concepts in the Knowledge Graph yet.",
      },
      { status: 422 }
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

    const paper = await generatePracticePaper(
      scope,
      MVP_PRACTICE_BLUEPRINT,
      generator,
      reviewer,
      { excludeQuestionIds }
    );

    const totalQuestions = paper.allocations.reduce(
      (sum, allocation) => sum + allocation.questions.length,
      0
    );

    if (totalQuestions === 0) {
      return NextResponse.json(
        {
          error:
            "No questions could be generated for this chapter right now. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ paper });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
