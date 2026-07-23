# Learning Graph

## Purpose

The Learning Graph represents the relationship between a student and the shared Knowledge Graph.

The Knowledge Graph is common to every learner.

The Learning Graph is unique for every learner.

---

## Knowledge Graph

Concepts are connected through educational relationships.

Examples:

Equivalent Fractions

↓

Comparing Fractions

↓

Addition of Fractions

---

## Learning Graph

Each student maintains independent progress.

Example:

Meera

Equivalent Fractions

Mastery: 92%

Confidence: 78%

Preferred Style: Visual

Misconception:

Larger denominator means larger fraction.

---

## Why separate them?

The curriculum should never change because one student struggles.

Instead, the student's relationship with the curriculum changes.

This enables scalable personalization.

Purpose

This document answers:

How are concepts connected?

This is the structure of the knowledge.

Example:

Whole Numbers
      ↓
Fractions
      ↓
Equivalent Fractions
      ↓
Comparing Fractions
It should contain
1. The Knowledge Graph
KnowledgeGraph
├── concepts[]
└── relationships[]
2. Relationship types

Currently:

prerequisite
related
extends

The document should define each one.

For example:

A ──prerequisite──> B

means:

A is foundational knowledge required before learning B.

3. Direction

This should explicitly document the direction:

Foundational Concept
        │
        ▼
Dependent Concept

Example:

Fractions
    │
    ▼
Equivalent Fractions
4. Dangling relationships

Your current architecture intentionally allows:

Unknown Concept
       │
       ▼
Known Concept

Example:

understanding-of-whole-numbers
              │
              ▼
          fractions

The unknown concept should not automatically be fabricated as a full Concept.

This belongs here.

5. Graph operations

Currently:

buildKnowledgeGraph()

The document should describe the conceptual behavior:

upsert concepts
deduplicate relationships
preserve unresolved references
avoid fake concepts
maintain deterministic output

Implementation details remain in code.