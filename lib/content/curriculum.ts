import { promises as fs } from "fs";
import path from "path";

import { Chapter, ChapterRegistry } from "@/packages/shared-types";
import { loadChapterRegistry } from "@/packages/knowledge-engine/curriculum";

/**
 * The content-catalog boundary: "what educational content is
 * available to the application/UI?" — grade/subject/chapter
 * discovery only. This is deliberately NOT an exam-planning layer:
 * it never resolves concepts, never enforces the confirmed-chapter
 * curriculum boundary, and never decides what's eligible for
 * generation. That authority stays with
 * knowledge-engine/examPlanning/resolveExamScope, which every
 * generation caller must still go through — see
 * getAvailableChapters's own doc comment below.
 *
 * Reuses knowledge-engine/curriculum's existing
 * loadChapterRegistry/getChapterRegistryPath (the on-disk registry
 * format and its path convention) rather than inventing a second
 * representation. The one genuinely new capability here is
 * enumerating *which* (grade, subject) registries exist at all —
 * nothing in the existing curriculum module needs that, since it
 * only ever loads a registry once the caller already knows the
 * grade/subject to ask for.
 */
const CURRICULUM_DIR = path.resolve("data/curriculum");

async function listRegistries(): Promise<ChapterRegistry[]> {
  let filenames: string[];
  try {
    filenames = await fs.readdir(CURRICULUM_DIR);
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

  const registries = await Promise.all(
    filenames
      .filter((filename) => filename.endsWith(".json"))
      .map(async (filename) => {
        const raw = await fs.readFile(
          path.join(CURRICULUM_DIR, filename),
          "utf-8"
        );
        return JSON.parse(raw) as ChapterRegistry;
      })
  );

  return registries;
}

/**
 * Every grade with at least one curriculum registry on disk,
 * regardless of whether any of its chapters are confirmed yet — the
 * catalog surfaces what content *exists*, not what's practice-ready.
 */
export async function getAvailableGrades(): Promise<number[]> {
  const registries = await listRegistries();
  return Array.from(new Set(registries.map((r) => r.grade))).sort(
    (a, b) => a - b
  );
}

/**
 * Every subject with a registry for the given grade. An unknown
 * grade simply yields no subjects — not an error, since "no content
 * for this grade" is a legitimate catalog answer, not a caller
 * mistake.
 */
export async function getAvailableSubjects(grade: number): Promise<string[]> {
  const registries = await listRegistries();
  return Array.from(
    new Set(
      registries.filter((r) => r.grade === grade).map((r) => r.subject)
    )
  ).sort();
}

/**
 * All chapters for a (grade, subject) pair, pending ones included —
 * the catalog's job is to let a UI show what exists (and let it mark
 * pending chapters as unavailable), not to decide what's eligible
 * for generation. That confirmed/pending gate is enforced downstream
 * by resolveExamScope, independently and authoritatively; a caller
 * MUST NOT treat this function's output as pre-cleared for practice
 * generation. An unknown (grade, subject) pair — no registry on disk
 * — yields an empty list rather than throwing, consistent with
 * getAvailableSubjects's "no content" convention.
 */
export async function getAvailableChapters(
  grade: number,
  subject: string
): Promise<Chapter[]> {
  try {
    const registry = await loadChapterRegistry(grade, subject);
    return registry.chapters;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("No chapter registry found")
    ) {
      return [];
    }
    throw error;
  }
}
