import { promises as fs } from "fs";

import { NextRequest, NextResponse } from "next/server";

// Specific submodules, not the ingestion barrel — that barrel also
// re-exports ./parseDocument, which pulls in pdf-parse/pdfjs-dist and
// breaks Next's webpack bundling for route handlers. Same reasoning
// already applied to app/api/eke/upload-material/route.ts's and
// packages/generateQuestion.ts's own imports. This route is the
// first one that genuinely calls parseDocument() (see the doc
// comment below on why that was verified, not assumed).
import { getUploadedDocumentPath } from "@/packages/knowledge-engine/ingestion/uploadDocument";
import { parseDocument } from "@/packages/knowledge-engine/ingestion/parseDocument";
import { saveDocumentStructureCandidate } from "@/packages/knowledge-engine/ingestion/saveDocumentStructureCandidate";
// packages/ai's own barrel does not touch ingestion at all (verified
// by reading packages/ai/index.ts), so it's already safely imported
// directly elsewhere (see generate-practice-paper/route.ts) — no
// need for a specific-submodule import here.
import {
  AIProvider,
  ClaudeProvider,
  GroqProvider,
  GeminiProvider,
  resolveProviderName,
  ClaudeDocumentStructureExtractor,
} from "@/packages/ai";

interface AnalyzeMaterialRequestBody {
  sourceDocumentId?: string;
}

/**
 * The web entry point into Milestone 3A's document-structure
 * extraction: getUploadedDocumentPath -> parseDocument ->
 * ClaudeDocumentStructureExtractor.extract -> saveDocumentStructureCandidate.
 * Pure orchestration — no parsing, prompt-building, schema
 * validation, or persistence logic is duplicated here; every one of
 * those steps happens exactly where Milestone 1/2/3A already put it.
 *
 * The returned candidate is always status: "pending" (3A's own
 * DocumentStructureCandidate type cannot represent anything else) —
 * this route never creates/confirms a Chapter, never touches
 * ChapterRegistry, and never extracts Concepts/QuestionPatterns. See
 * DocumentStructureCandidate's own doc comment.
 */
export async function POST(request: NextRequest) {
  let body: AnalyzeMaterialRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceDocumentId = body.sourceDocumentId;
  if (typeof sourceDocumentId !== "string" || sourceDocumentId.trim().length === 0) {
    return NextResponse.json(
      { error: "sourceDocumentId is required" },
      { status: 400 }
    );
  }

  const uploadedPath = getUploadedDocumentPath(sourceDocumentId);

  try {
    await fs.access(uploadedPath);
  } catch {
    return NextResponse.json(
      { error: "No uploaded document found for this sourceDocumentId" },
      { status: 404 }
    );
  }

  try {
    const document = await parseDocument(uploadedPath);

    const providerName = resolveProviderName(process.env.AI_PROVIDER);
    const provider: AIProvider =
      providerName === "groq"
        ? new GroqProvider()
        : providerName === "gemini"
        ? new GeminiProvider()
        : new ClaudeProvider();

    const extractor = new ClaudeDocumentStructureExtractor(provider);
    const candidate = await extractor.extract(document);

    await saveDocumentStructureCandidate(candidate);

    return NextResponse.json({ candidate }, { status: 200 });
  } catch (error) {
    // Never relay the raw error (filesystem paths, provider details,
    // stack traces) to the client — a generic message covers both a
    // parse failure and an extraction/validation failure, matching
    // the other EKE routes' existing 502 convention.
    console.error("analyze-material failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze the uploaded document" },
      { status: 502 }
    );
  }
}
