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