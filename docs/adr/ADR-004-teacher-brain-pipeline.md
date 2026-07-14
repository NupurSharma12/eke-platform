# ADR-004: Teacher Brain Pipeline

## Status

Accepted

## Context

LLMs are excellent at understanding educational content but should not become the application's architecture.

## Decision

The Teacher Brain is implemented as a deterministic pipeline.

Document

↓

Parse

↓

Extract Concepts

↓

Validate

↓

Normalize

↓

Build Knowledge Graph

↓

Persist

The LLM performs only the extraction stage.

Every other stage remains deterministic and testable.

## Consequences

Advantages

- Reproducible.
- Testable.
- Replaceable LLM.
- Lower costs.
- Better debugging.

Tradeoffs

More implementation effort than direct prompting.