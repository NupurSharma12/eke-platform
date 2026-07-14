# ADR-002: Knowledge Graph vs Learning Graph

## Status

Accepted

## Context

Educational content and student progress evolve independently.

The knowledge itself is shared by everyone.

A student's understanding is unique and constantly changing.

## Decision

EKE maintains two separate graphs.

### Knowledge Graph

Stores:

- universal concepts
- prerequisite relationships
- related concepts
- misconceptions
- teaching strategies

Shared by all learners.

### Learning Graph

Created for every student.

Stores:

- mastery
- confidence
- misconceptions
- interests
- preferred teaching style
- achievements
- learning history

Never modifies the Knowledge Graph.

## Consequences

Advantages

- Millions of students share one knowledge base.
- Every learner has a personalized experience.
- Easy analytics.
- Supports adaptive learning.

Tradeoffs

Requires synchronization between the two graphs.