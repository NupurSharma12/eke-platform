ADR-001

We build around concepts instead of documents.

This is the new document I consider essential.

Purpose

This answers:

What role does each type of educational source play?

This is the architectural change you are introducing now.

The core model
                 EDUCATIONAL SOURCES
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  KNOWLEDGE         QUESTION          ASSESSMENT
  FOUNDATION        BOUNDARIES        EVIDENCE
1. Knowledge Foundation

Example:

NCERT
Curriculum Textbook
Official Syllabus

These primarily answer:

What should the student know?

They contribute:

Concepts
Definitions
Explanations
Learning Objectives
Prerequisites
Misconceptions

Example:

NCERT
   │
   ▼
Fractions
   │
   ├── Definition
   ├── Explanation
   ├── Equivalent fractions
   └── Comparing fractions
2. Question Boundaries

Example:

Olympiad Books
Worksheets
Assignments
Practice Papers

These answer:

What kinds of questions should the student be able to solve?

They contribute:

Question Patterns
Difficulty
Reasoning Complexity
Concept Combinations
Distractor Patterns
Time Constraints

For example:

Concept: Fractions

Olympiad source:
- multi-step reasoning
- hidden patterns
- unusual representations
- higher difficulty

The Olympiad source should not automatically overwrite the canonical concept explanation.

3. Assessment Evidence

Example:

School Exam
Previous Exam Papers
Answer Sheets
Teacher-Corrected Work

These answer:

What is the student actually expected to answer?

They contribute:

Question Style
Mark Distribution
Expected Answer Format
Common Mistakes
Actual Difficulty
4. Source roles

I would explicitly define a table like this:

Source	Primary Role	Can create concepts?	Influences questions?
NCERT	Knowledge foundation	Yes	Yes
Curriculum	Knowledge foundation	Yes	Yes
Olympiad book	Question boundary	Possibly	Strongly
Worksheet	Practice boundary	Possibly	Strongly
Assignment	Practice boundary	Possibly	Strongly
Exam paper	Assessment evidence	Usually no	Strongly
Answer sheet	Assessment evidence	No	Strongly

The exact classification should be treated as an architectural decision and later refined.

5. Source-specific data

This is where the current architecture should evolve conceptually:

Canonical Concept
        │
        ├── ConceptSource
        │       ├── NCERT
        │       ├── Olympiad Book
        │       └── Worksheet
        │
        ├── Question Patterns
        │
        └── Assessment Evidence

The source should retain its own information.

For example:

Canonical Concept: Fractions

could have:

Knowledge Sources:
├── NCERT explanation
└── Curriculum definition

Question Sources:
├── Olympiad pattern A
├── Olympiad pattern B
└── Worksheet pattern C

Assessment Sources:
└── School exam question pattern