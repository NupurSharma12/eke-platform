Purpose

This answers:

How do we generate a question?

This should be separate from ingestion.

The generation system should eventually receive something like:

QuestionGenerationRequest
{
  concept: Fractions,

  student:
    Meera,

  knowledge:
    canonical concept knowledge,

  boundaries:
    allowed question patterns,

  difficulty:
    selected difficulty,

  sourceInfluence:
    Olympiad + school worksheet,

  constraints:
    grade 5
}

Conceptually:

       KNOWLEDGE
           │
           ▼
     ┌──────────────┐
     │   CONCEPT    │
     │  Fractions   │
     └──────┬───────┘
            │
     ┌──────┴───────┐
     │              │
     ▼              ▼
QUESTION        STUDENT
BOUNDARIES      CONTEXT
     │              │
     └──────┬───────┘
            ▼
      GENERATED QUESTION
It should eventually define
Question types
MCQ
Short Answer
Long Answer
Reasoning
Visual
Word Problem
Olympiad
Difficulty
Grade
Challenge
Olympiad
Complexity
Single concept
Multiple concepts
Multi-step reasoning
Provenance

Every generated question should eventually be explainable:

Question
   │
   ├── Based on concept: Fractions
   ├── Pattern influenced by: Olympiad Book
   ├── Difficulty: Olympiad
   └── Grade: 5

This is a very important future capability.