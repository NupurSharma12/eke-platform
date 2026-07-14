# ADR-003: Persistence Abstraction

## Status

Accepted

## Context

Storage technology may change over time.

Vendor-specific code should not affect the domain model.

## Decision

All persistence is performed through Repository interfaces.

Knowledge Engine never communicates directly with xysq, databases, or vector stores.

Adapters implement repository interfaces.

Example:

Knowledge Engine

↓

ConceptRepository

↓

XysqConceptRepository

↓

xysq MCP

## Consequences

Advantages

- Vendor independence.
- Easier testing.
- Easier migration.
- Clean architecture.

Tradeoffs

Slight increase in abstraction.