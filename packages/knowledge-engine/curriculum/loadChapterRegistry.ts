import { promises as fs } from "fs";
import path from "path";

import { Chapter, ChapterRegistry } from "../../shared-types";
import { slugify } from "../normalization/normalizeConcepts";

/**
 * One file per (grade, subject) pair, matching the convention
 * already used for source metadata / question banks — a flat file
 * per logical unit, no database.
 */
export function getChapterRegistryPath(grade: number, subject: string): string {
  return path.join(
    path.resolve("data/curriculum"),
    `grade${grade}-${slugify(subject)}-chapters.json`
  );
}

/**
 * Loads the full registry for a (grade, subject) pair, including
 * pending (unconfirmed) chapters. Throws if the registry file
 * doesn't exist — unlike the Question Bank or attempt history,
 * there is no sensible "empty" default here: a missing registry
 * means this grade/subject genuinely hasn't been curated yet, and
 * callers (the chapters API route, exam planning) need to know
 * that rather than silently proceeding with zero chapters.
 */
export async function loadChapterRegistry(
  grade: number,
  subject: string
): Promise<ChapterRegistry> {
  const registryPath = getChapterRegistryPath(grade, subject);

  let raw: string;
  try {
    raw = await fs.readFile(registryPath, "utf-8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(
        `No chapter registry found for grade ${grade} ${subject} at ${registryPath}. ` +
        `This grade/subject has not been curated yet.`
      );
    }
    throw error;
  }

  return JSON.parse(raw) as ChapterRegistry;
}

/**
 * The subset of a registry's chapters safe to show a user: only
 * `status: "confirmed"` chapters, with a real number/name. Every
 * caller that presents chapters in the UI or resolves a user's
 * chapter selection goes through this, never through
 * loadChapterRegistry's raw `chapters` array directly — a pending
 * chapter's unconfirmed name/number must never reach a student or
 * parent.
 */
export async function loadConfirmedChapters(
  grade: number,
  subject: string
): Promise<Chapter[]> {
  const registry = await loadChapterRegistry(grade, subject);
  return registry.chapters.filter((chapter) => chapter.status === "confirmed");
}
