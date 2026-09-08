/**
 * What kind of structural range a page range represents. Deliberately
 * only these two, matching this milestone's actual scope — content
 * (chapter/unit) vs exercise/practice. Nothing finer-grained (e.g.
 * "section", "sub-unit") is extracted today because nothing upstream
 * can honestly distinguish them from a single whole-document LLM pass.
 */
export type StructuralRangeKind = "content" | "exercise";

/**
 * One candidate page range within an uploaded document — either a
 * chapter/unit's content, or an exercise/practice section. Page
 * indexes are 1-indexed positions into ParsedDocument.pages (the
 * file's own page order), never a printed/textbook page number,
 * which may differ from the file's page index and is not tracked
 * here at all (see the extractor/prompt for why).
 *
 * `chapterTitle`/`chapterNumber` are candidate metadata only — the
 * same "LLM extraction is a candidate, not verification" principle
 * ADR-006 already establishes for Chapter identity applies here
 * identically. Neither is ever copied onto a real Chapter by this
 * milestone; that remains a separate, human-confirmed step.
 *
 * Deliberately carries no numeric confidence field: nothing in this
 * extraction pipeline can honestly produce one (see
 * AssessmentStructureEvidence's identical stance on not fabricating
 * fields extraction can't back up) — `evidence` is the honest
 * substitute, a short, human-checkable quote/description instead of
 * an invented score.
 */
export interface StructuralCandidateRange {
  kind: StructuralRangeKind;

  /** 1-indexed, inclusive — an index into ParsedDocument.pages. */
  startPage: number;

  /** 1-indexed, inclusive — an index into ParsedDocument.pages. */
  endPage: number;

  /** Candidate only, meaningful for kind: "content". Never verified curriculum truth. */
  chapterTitle?: string;

  /** Candidate only, meaningful for kind: "content". */
  chapterNumber?: number;

  /** Short, human-checkable quote or description of what supports this range. */
  evidence: string;
}

/**
 * The full candidate structural interpretation of one uploaded
 * document — a sibling of ConceptCandidate in spirit (candidate +
 * provenance + pending status, never silently promoted to something
 * authoritative) but for document structure rather than concept
 * identity. Completely separate from Chapter/ChapterRegistry: this
 * type is never read by resolveExamScope or any curriculum-scope
 * logic, and nothing here ever becomes a Chapter without a separate,
 * human-confirmed step this milestone does not implement.
 *
 * `status` is always "pending" — there is currently no path that
 * produces anything else, matching ConceptCandidate's identical
 * always-pending convention.
 */
export interface DocumentStructureCandidate {
  sourceDocumentId: string;

  ranges: StructuralCandidateRange[];

  status: "pending";

  /** Code-stamped wall-clock time of extraction — never trusted from the LLM response. */
  extractedAt: string;
}
