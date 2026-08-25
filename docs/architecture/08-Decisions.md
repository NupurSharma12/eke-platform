Purpose

This is the architectural decision log.

Each decision should be recorded like:

## Decision: Canonical Knowledge Graph

Date: 2026-07-23

Decision:
All sources contribute to one canonical knowledge graph rather than
creating an isolated graph per book.

Reason:
Multiple educational sources refer to overlapping concepts.

Consequences:
- Concepts must be canonicalized.
- Source provenance must be preserved.
- Source-specific information must not be lost.

Your recent major decisions should eventually be recorded here:

Decision 1: One canonical graph
Decision 2: Source provenance is preserved
Decision 3: Raw extraction checkpoints are retained
Decision 4: NCERT is knowledge foundation
Decision 5: Olympiad material influences question boundaries
Decision 6: Unresolved references are preserved
Decision 7: No automatic fuzzy matching

## Decision: Chapter identity requires content verification, not filename inference

Date: 2026-08-23

Decision:
A chapter's name and number must come from verified document content (a
heading, a table of contents entry) or explicit human confirmation. A
filename/resource identifier is never treated as evidence of chapter
identity. Unverified chapter metadata remains pending, never guessed.

Reason:
Nothing in the ingestion pipeline previously captured chapter identity;
without this rule, chapter selection (needed for exam-scoped practice)
would default to trusting incidental filenames as curriculum truth.

Reference: ADR-006.

## Decision: School-exam content boundary is textbook + selected chapters; assessment evidence informs pattern, not scope

Date: 2026-08-23

Decision:
For School Exam Mode, curriculum scope (which concepts are eligible) is
the selected textbook's selected chapters, resolved to concepts via
those chapters' source documents — nothing else. Exam blueprints and
sample papers (Assessment Evidence) may inform generation source policy
(question type, difficulty, marks distribution, pattern) but never
expand curriculum scope. General Practice Mode is unaffected and keeps
today's broader chapter/topic/Olympiad-section selection.

Consequences:
- findSuitablePattern/buildBlueprint currently have no source-boundary
  awareness — enforcing this decision in code is an open follow-up, not
  yet designed or implemented.
- The dormant CurriculumMapping type and the new Chapter/ChapterRegistry
  are not yet reconciled into one mechanism — open question.

Reference: ADR-006.