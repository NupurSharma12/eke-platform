import { promises as fs } from "fs";
import path from "path";

interface StoredAttempt {
  questionId: string;
  attemptedAt: string;
}

/**
 * DEV-ONLY LOCAL PERSISTENCE — a file-based stand-in for a real
 * student-attempt repository (e.g. a Supabase `question_attempts`
 * table), needed because Supabase auth/data access is currently
 * bypassed in dev (see DEV_BYPASS_AUTH in lib/app-context.tsx).
 * One JSON file per student holds every question they've ever
 * submitted an answer to, so the history survives page refreshes
 * and full app restarts — unlike a React-state or session-only
 * tracker. Swapping this for a real backend later only means
 * reimplementing the two functions in this module; every caller
 * (the record-attempt route, generateQuestion's cache-exclusion
 * check) keeps working unchanged.
 */
export function getStudentAttemptsPath(studentId: string): string {
  return path.join(path.resolve("data/students"), studentId, "question-attempts.json");
}

export async function loadAttempts(studentId: string): Promise<StoredAttempt[]> {
  try {
    const raw = await fs.readFile(getStudentAttemptsPath(studentId), "utf-8");
    return JSON.parse(raw) as StoredAttempt[];
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Idempotent: recording the same (studentId, questionId) more than
 * once — a duplicate Submit click, a retried request — never
 * creates a second entry or bumps attemptedAt.
 */
export async function recordQuestionAttempt(
  studentId: string,
  questionId: string
): Promise<void> {
  const attempts = await loadAttempts(studentId);

  if (attempts.some((a) => a.questionId === questionId)) {
    return;
  }

  attempts.push({ questionId, attemptedAt: new Date().toISOString() });

  const filePath = getStudentAttemptsPath(studentId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(attempts, null, 2), "utf-8");
}
