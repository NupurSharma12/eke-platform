# ADR-001: Universal Concept Model

## Status

Accepted

## Context

Educational concepts should not depend on a specific curriculum, textbook, board, or grade.

For example, "Equivalent Fractions" is the same mathematical idea whether it appears in CBSE Grade 4, ICSE Grade 5, or Cambridge Primary.

Curriculum changes over time, but the underlying concept remains stable.

## Decision

EKE models concepts as universal, curriculum-independent entities.

Curriculum-specific information is stored separately using CurriculumMappings.

A Concept contains only educational knowledge.

Examples include:

- explanation
- learning objectives
- misconceptions
- prerequisite concepts
- related concepts
- teaching strategies
- question templates

A Concept never stores:

- board
- grade
- chapter number
- textbook name

## Consequences

Advantages

- One shared knowledge graph for every curriculum.
- Easy support for new educational boards.
- Reduced duplication.
- Long-term maintainability.

Tradeoffs

- Requires a normalization stage after extraction.
- Requires CurriculumMappings.