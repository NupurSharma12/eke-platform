# ADR-005: Learning Through Mistake Recovery

## Status

Accepted

## Context

Most educational applications measure success using quiz scores.

A score indicates performance but does not guarantee understanding.

Students often repeat the same mistakes because incorrect answers are not analyzed or remediated.

## Decision

EKE is designed as a Mistake Recovery Engine rather than a Quiz Engine.

Every incorrect answer creates a Learning Opportunity.

The system identifies the underlying misconception, selects an appropriate remediation strategy, and verifies that understanding has improved before considering the concept mastered.

Possible remediation strategies include:

- visual explanations
- animations
- stories
- games
- guided hints
- real-life examples
- easier bridging questions
- transfer questions

Future quizzes prioritize unresolved misconceptions.

A concept is considered mastered only after successful recovery.

## Consequences

Advantages

- Focuses on conceptual understanding rather than scores.
- Personalized learning paths.
- Stronger long-term retention.
- Parents receive meaningful progress reports.

Tradeoffs

Requires misconception tracking.
Requires adaptive question generation.
Requires mastery verification.