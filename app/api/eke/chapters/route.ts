import { NextRequest, NextResponse } from "next/server";

import {
  getAvailableGrades,
  getAvailableSubjects,
  getAvailableChapters,
} from "@/lib/content/curriculum";

/**
 * Content-catalog read-through for the Practice UI's cascading
 * Grade -> Subject -> Chapter selector. Progressively deepens based
 * on which query params are supplied:
 *
 *   GET /api/eke/chapters                          -> { grades }
 *   GET /api/eke/chapters?gradeId=5                 -> { subjects }
 *   GET /api/eke/chapters?gradeId=5&subjectId=Math  -> { chapters }
 *
 * Chapters returned here include pending ones (with their `status`)
 * so the UI can show them as unavailable — this endpoint is a
 * catalog, not the authoritative curriculum-scope gate. The actual
 * generate-practice-paper route re-resolves the selected chapter
 * through resolveExamScope() itself; it never trusts that a chapter
 * returned here is confirmed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gradeIdParam = searchParams.get("gradeId");
  const subjectId = searchParams.get("subjectId");

  if (gradeIdParam === null) {
    const grades = await getAvailableGrades();
    return NextResponse.json({ grades });
  }

  const gradeId = Number(gradeIdParam);
  if (!Number.isInteger(gradeId)) {
    return NextResponse.json(
      { error: "gradeId must be an integer" },
      { status: 400 }
    );
  }

  if (subjectId === null) {
    const subjects = await getAvailableSubjects(gradeId);
    return NextResponse.json({ subjects });
  }

  const chapters = await getAvailableChapters(gradeId, subjectId);
  return NextResponse.json({ chapters });
}
