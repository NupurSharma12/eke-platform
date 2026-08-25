import { NextRequest, NextResponse } from "next/server";

import { recordQuestionAttempt } from "@/packages/knowledge-engine/studentAttempts";

interface RecordAttemptRequestBody {
  studentId?: string;
  questionId?: string;
}

/**
 * Called on Submit, not on generate/display — a question only
 * becomes "attempted" once the student has actually answered it.
 * Idempotent by construction (recordQuestionAttempt no-ops on a
 * repeat questionId), so a duplicate Submit click or a retried
 * request is safe.
 */
export async function POST(request: NextRequest) {
  let body: RecordAttemptRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.studentId || !body.questionId) {
    return NextResponse.json(
      { error: "studentId and questionId are required" },
      { status: 400 }
    );
  }

  try {
    await recordQuestionAttempt(body.studentId, body.questionId);
    return NextResponse.json({ recorded: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
