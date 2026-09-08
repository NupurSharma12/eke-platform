import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

// Specific submodules, not the ingestion barrel — that barrel also
// re-exports ./parseDocument, which pulls in pdf-parse/pdfjs-dist and
// breaks Next's webpack bundling for any route that imports it. Same
// reasoning already applied to packages/generateQuestion.ts and the
// other app/api/eke/* routes' imports.
import { uploadDocument } from "@/packages/knowledge-engine/ingestion/uploadDocument";
import { classify } from "@/packages/knowledge-engine/ingestion/findSupportedFiles";
import { saveSourceMetadata } from "@/packages/knowledge-engine/ingestion/saveSourceMetadata";
import { classifyDocument } from "@/packages/knowledge-engine/classification/classifyDocument";
import { DocumentType, DOCUMENT_TYPES, SourceMetadata } from "@/packages/shared-types";

/**
 * Registers an uploaded learning-material file as a source document:
 *
 *   multipart file -> temp file -> uploadDocument() (persists a copy
 *   under data/uploads/, returns sourceDocumentId) -> classifyDocument
 *   (deterministic, from the caller-supplied documentType) ->
 *   saveSourceMetadata()
 *
 * This is registration only — no parsing, no concept extraction, no
 * chapter detection. `grade`/`subject` are stored on SourceMetadata
 * purely as contextual metadata (both already-optional fields on
 * that type); they are never treated as, or used to infer, chapter
 * identity. See ADR-006.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "file is empty" }, { status: 400 });
  }

  if (!classify(file.name)) {
    return NextResponse.json(
      { error: `Unsupported file type: "${file.name}". Expected .pdf, .jpeg, .jpg, or .png.` },
      { status: 400 }
    );
  }

  const documentTypeValue = formData.get("documentType");
  if (typeof documentTypeValue !== "string" || documentTypeValue.length === 0) {
    return NextResponse.json({ error: "documentType is required" }, { status: 400 });
  }
  if (!(DOCUMENT_TYPES as string[]).includes(documentTypeValue)) {
    return NextResponse.json(
      {
        error: `Unknown documentType "${documentTypeValue}". Expected one of: ${DOCUMENT_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const documentType = documentTypeValue as DocumentType;

  const gradeIdRaw = formData.get("gradeId");
  let grade: number | undefined;
  if (typeof gradeIdRaw === "string" && gradeIdRaw.length > 0) {
    grade = Number(gradeIdRaw);
    if (!Number.isInteger(grade)) {
      return NextResponse.json({ error: "gradeId must be an integer" }, { status: 400 });
    }
  }

  const subjectIdRaw = formData.get("subjectId");
  const subject =
    typeof subjectIdRaw === "string" && subjectIdRaw.length > 0 ? subjectIdRaw : undefined;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eke-upload-"));

  try {
    const tempFilePath = path.join(tempDir, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, bytes);

    let sourceDocumentId: string;
    try {
      sourceDocumentId = await uploadDocument(tempFilePath);
    } catch (error) {
      // uploadDocument's own errors reference the temp file path —
      // never relayed to the client. The extension/existence checks
      // above already cover every case this route can legitimately
      // trigger, so anything reaching here is unexpected.
      console.error("uploadDocument failed:", error);
      return NextResponse.json({ error: "Failed to persist the uploaded file" }, { status: 502 });
    }

    const contributions = classifyDocument(documentType);

    const sourceMetadata: SourceMetadata = {
      sourceDocumentId,
      title: file.name,
      documentType,
      contributions,
      ...(grade !== undefined ? { grade } : {}),
      ...(subject !== undefined ? { subject } : {}),
    };

    await saveSourceMetadata(sourceMetadata);

    return NextResponse.json({ sourceDocumentId, sourceMetadata }, { status: 201 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
