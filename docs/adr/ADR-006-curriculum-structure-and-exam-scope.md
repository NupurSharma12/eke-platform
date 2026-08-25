# ADR-006: Curriculum Structure and Exam Scope

## Status

Accepted

## Context

EKE is extending beyond concept-driven practice toward chapter-centric exam preparation: a parent or student selects chapters (and, for a school exam, an official textbook), not individual concepts, and expects the resulting practice set to stay inside the boundary they selected.

Two things this ADR does *not* already have an answer for, in the existing architecture:

1. **Where does a chapter's identity — its name and number — come from?** Nothing in the ingestion pipeline (ADR-004) captures this today. `Concept.sourceDocuments` records which source *files* a concept came from, but a filename (`eemm104.pdf`) is an artifact of how a document was uploaded, not evidence of what chapter it is.
2. **What does "select chapters" bound, exactly?** ADR-001 already keeps chapter/grade/board off the `Concept` entity, and `05-Knowledge-Source-Architecture.md` already separates a source's *role* (knowledge foundation / question boundary / assessment evidence) from the concept it touches. Neither says what happens when a user's selection is meant to define a hard content boundary — as it must for a school exam — versus when it's just a starting filter, as in general practice.

A related distinction has to be made explicit or the second point collapses into an over-restrictive rule: **which concepts are eligible to appear** (curriculum scope) is a different question from **which resources may inform how a question is written** (generation source policy). Conflating them would mean either school-exam questions could never benefit from a well-written Olympiad-style question pattern on an in-scope concept (too restrictive, and not something this ADR has evidence to justify), or that an out-of-scope Olympiad concept could sneak in because its *pattern* was allowed to influence generation (too permissive, and exactly the failure mode this ADR exists to prevent). The two need independent rules.

## Decision

### Chapter identity

- A source document's filename (or any other resource identifier assigned at upload time) is **never** treated as evidence of chapter name or number. It is a resource identifier, nothing more.
- A chapter's name and number must come from either (a) verified document content — a chapter heading, a table of contents entry, or equivalent structural evidence actually read from the source — or (b) explicit human confirmation. An LLM proposing a chapter title from document content is extraction, not verification, per ADR-004's existing "the LLM performs only the extraction stage" principle; its output is a candidate, not ground truth.
- Until (a) or (b) has happened for a given chapter, its metadata **remains pending**. A pending chapter is never surfaced to a user, never used to define a curriculum-scope boundary, and never presented as if it were confirmed. Guessing is not an acceptable substitute for pending status, regardless of how likely the guess is to be correct.

### Three separate entities

Curriculum structure, uploaded resources, and canonical concepts are three distinct entities with distinct responsibilities, and none of them substitutes for another:

- **Uploaded resource** (a source document) — an opaque, ingested file. Contributes concepts/patterns/evidence per its `SourceContribution` role (ADR/`05`), nothing about curriculum position.
- **Canonical concept** (`Concept`) — curriculum-independent educational knowledge, per ADR-001. Still stores no chapter, grade, or board.
- **Curriculum structure** (`Chapter`, and eventually broader curriculum mapping) — the organizational layer a user actually navigates (grade, subject, chapter). Links to concepts *indirectly*, via which resources a chapter's content came from, not by the concept carrying curriculum fields itself.

### Curriculum scope vs. generation source policy

These are independently decided, not one rule wearing two hats:

- **Curriculum scope** answers: *which concepts are eligible to be tested in this practice set at all.* For **School Exam Mode**, scope is the official textbook's selected chapters — resolved to the set of concepts whose originating resources belong to those chapters — and nothing else. A concept is either in that resolved set or it is out of scope; there is no partial membership.
- **Generation source policy** answers: *which resources may inform how an in-scope question is written* — pattern, phrasing style, difficulty calibration, distractor construction. This ADR does **not** decide that only the selected textbook's own patterns may be used. A worksheet's or Olympiad book's `QuestionPattern` may still inform how a question for an in-scope concept is generated, exactly as `05-Knowledge-Source-Architecture.md` already allows. What generation source policy must guarantee is narrower and specific: using a supporting resource's pattern must never introduce a concept, or expand the resolved set, beyond curriculum scope. A pattern can shape *how* an in-scope question is asked; it can never be the reason an out-of-scope concept gets asked at all.
- An **exam blueprint** (or sample paper) is assessment evidence, per `05`. It defines exam **pattern** — question types, counts, difficulty mix, marks distribution — and may inform generation source policy exactly as any other assessment-evidence source does. It never defines or expands curriculum **scope**. A blueprint that references a topic outside the selected chapters does not pull that topic into scope.
- **General Practice Mode** is not subject to the School Exam Mode boundary. A user may select chapters, topics, Olympiad sections, or any other resource-native grouping directly, exactly as today's concept/topic-driven practice flow already works. This ADR narrows School Exam Mode specifically; it does not narrow general practice.

### What this ADR does not decide

- The exact mechanism by which curriculum scope is enforced against generation source policy in code (e.g. how `findSuitablePattern`/`buildBlueprint` would need to change to keep pattern-sourcing separate from scope-checking) is **not decided here**. It is a real, currently-unaddressed implementation gap — see Consequences — to be designed and implemented separately.
- Whether the dormant `CurriculumMapping` type (`shared-types/future/curriculum-mapping.ts`, per-concept `chapter: string`) and the new document-centric `Chapter`/`ChapterRegistry` (per-source-document) are reconciled into one mechanism, or intentionally kept as two, is an open question — see the questions raised alongside this ADR.

## Consequences

Advantages

- Chapter selection becomes trustworthy: a confirmed chapter is backed by real document evidence or a human's explicit sign-off, never an inference from an incidental filename.
- School Exam Mode gets a real, enforceable content boundary without over-constraining where question *style* is allowed to come from — supporting resources stay useful.
- Keeps ADR-001's Concept/curriculum separation intact; adds curriculum structure as its own layer rather than folding it back into Concept.

Tradeoffs

- Chapter registries require ongoing curation (human confirmation) rather than being fully automatic — a real cost against the "generate, don't memorize" ambition, accepted here because a wrong chapter boundary is worse than a slower one.
- **Known gap, explicitly not resolved by this ADR:** `findSuitablePattern` (and `buildBlueprint`, which calls it) currently has no source-boundary awareness at all — every `QuestionPattern` attached to a concept is eligible regardless of which source or curriculum scope it came from. Enforcing the curriculum-scope / generation-source-policy split decided above will require a real code change to that path. This is recorded as an open follow-up (see `08-Decisions.md`), not treated as already solved by writing this ADR.
- Two partially-overlapping curriculum-structure types now exist in the codebase (`Chapter` and the dormant `CurriculumMapping`) without a decided reconciliation — flagged, not resolved.
