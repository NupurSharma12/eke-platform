# Concept Model

## Purpose

A **Concept** is the smallest teachable unit of knowledge inside the Educational Knowledge Engine (EKE).

Every explanation, activity, quiz, hint, animation, assessment, and recommendation is ultimately built around Concepts.

The goal of EKE is **not** to memorize textbooks.

The goal is to understand Concepts.

---

# Philosophy

Traditional educational software stores documents.

Large Language Models retrieve chunks.

EKE stores educational intelligence.

Instead of asking:

"What does the textbook say?"

EKE asks:

"What concept is the student trying to learn?"

---

# Hierarchy

```
Subject
    ↓
Chapter
    ↓
Learning Objective
    ↓
Concept
```

Example:

```
Mathematics
    ↓
Fractions
    ↓
Understand Equivalent Fractions
    ↓
Equivalent Fractions represent the same quantity.
```

---

# What is a Concept?

A Concept represents one complete educational idea.

It should be:

- independent
- reusable
- curriculum-aware
- grade-aware
- assessment-ready

Examples:

- Equivalent Fractions
- Photosynthesis
- States of Matter
- Mughal Empire
- Noun
- Verb

---

# Every Concept should answer

## What is it?

Definition

---

## Why is it important?

Purpose

---

## Where is it used?

Real-world examples

---

## What should students already know?

Prerequisites

---

## What comes next?

Future concepts

---

## What do students commonly misunderstand?

Misconceptions

---

## How should this concept be taught?

Teaching strategies

---

## How should it be assessed?

Assessment strategies

---

## How can advanced learners be challenged?

Extension activities

---

# Core Metadata

Each Concept should contain:

- Unique ID
- Name
- Subject
- Chapter
- Learning Objective
- Grade Range
- Difficulty
- Curriculum
- Language

---

# Educational Knowledge

Each Concept should store:

## Explanation

Age-appropriate explanation.

---

## Examples

Real-life examples.

---

## Counter Examples

Things that look correct but are incorrect.

---

## Visual Ideas

Animations

Diagrams

Illustrations

Hands-on activities

---

## Stories

Small stories that help explain the concept.

---

## Analogies

Everyday comparisons.

---

## Teaching Strategies

Example:

Visual

Concrete Objects

Games

Storytelling

Inquiry-based

Project-based

---

## Misconceptions

Example:

Equivalent Fractions

Misconception:

A larger denominator always means a larger fraction.

Correction Strategy:

Use visual models.

---

## Question Templates

Instead of storing questions, store patterns.

Example:

Visual Comparison

Fill Missing Fraction

Real-world Scenario

Word Problem

Reasoning

Olympiad Challenge

---

## Difficulty Progression

Level 1

Recognition

Level 2

Understanding

Level 3

Application

Level 4

Reasoning

Level 5

Advanced/Olympiad

---

## Bloom's Taxonomy

Remember

Understand

Apply

Analyze

Evaluate

Create

---

## Mastery Indicators

How does EKE know the student understands this concept?

Example:

✔ Can identify equivalent fractions.

✔ Can generate equivalent fractions.

✔ Can simplify fractions.

✔ Can solve word problems.

---

## Related Concepts

Prerequisites

Dependent Concepts

Cross-subject connections

---

## Parent Tips

Simple activities parents can do at home.

Example:

Cut an apple into equal pieces.

Fold paper.

Share pizza slices.

---

## Teacher Notes

Optional notes for educators.

---

# AI Generation

Questions are never stored permanently.

Questions are generated dynamically from:

- Concept
- Student Mastery
- Student Grade
- Student Interests
- Difficulty
- Teaching Strategy

This ensures every learner receives personalized content.

---

# Knowledge Source

Each Concept should maintain provenance.

Example:

NCERT Grade 5 Chapter 7

Olympiad Workbook

Teacher Notes

School Question Paper

This enables traceability and trust.

---

# Versioning

Concepts evolve.

Every Concept should support versions.

Example:

Equivalent Fractions

Version 1

NCERT only

Version 2

NCERT + Olympiad

Version 3

Teacher improvements

Version 4

Community improvements

---

# Guiding Principle

EKE does not store textbooks.

EKE stores structured educational intelligence.

Concepts are the fundamental building blocks of that intelligence.

## Knowledge Graph Philosophy

EKE models knowledge as a directed graph rather than a collection of chapters.

Each Concept is a node.

Relationships describe how concepts depend on, reinforce, or extend one another.

The Knowledge Graph is shared across all learners and evolves over time.

Each student maintains a separate Learning Graph that records their unique relationship with every concept, including mastery, confidence, misconceptions, and review history.

This separation allows EKE to personalize learning while maintaining a single source of educational truth.


Purpose

This defines:

What is a concept in EKE?

This is the foundation of the whole system.

For example:

Concept
├── id
├── name
├── aliases
├── explanation
├── learningObjectives
├── prerequisites
├── misconceptions
├── teaching strategies
├── question templates
└── source provenance

The document should explain the conceptual model behind these fields.

It should contain
1. Definition of a concept

Example:

A concept is a meaningful unit of knowledge that a student can understand, practice, relate to other concepts, and be assessed on.

Example:

Fractions

is a concept.

These are not necessarily concepts by themselves:

Chapter 2
Page 45
Question 17

They are source or content references.

2. Concept identity

This is very important.

The system must distinguish between:

Surface form

and:

Canonical concept

Example:

"Fractions"
"Understanding Fractions"
"Fraction Concepts"

may all refer to:

fractions

The document should explain:

Canonical Concept
        ▲
        │
 ┌──────┼──────┐
 │      │      │
Fractions  Fraction Concepts
Understanding Fractions
3. Concept relationships

At the concept-model level, define what relationships mean.

For example:

Fractions
    ↓ prerequisite
Equivalent Fractions
    ↓
Comparing Fractions

The detailed graph implementation belongs in 03-Learning-Graph.md.

4. Concept content

Define the kinds of knowledge a concept can contain:

Concept
├── Explanation
├── Learning Objectives
├── Examples
├── Misconceptions
├── Teaching Strategies
└── Question Templates
5. Provenance

A concept may come from multiple sources.

For example:

Canonical Concept: Fractions

Sources:
├── NCERT
├── Olympiad Book
└── School Worksheet

But the concept itself must not become duplicated simply because multiple sources mention it.

This is exactly where your current ConceptSource model fits.