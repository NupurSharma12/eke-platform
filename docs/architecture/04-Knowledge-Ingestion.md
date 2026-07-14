# Knowledge Ingestion Pipeline

## Purpose

The Knowledge Engine transforms educational resources into structured Concepts.

Resources may include:

- NCERT books
- Olympiad books
- School worksheets
- Question papers
- Teacher notes

---

# Pipeline

Upload Document

↓

Extract Text

↓

Teacher Brain

↓

Concept Extraction

↓

Validation

↓

Knowledge Graph

↓

Store in xysq

---

# Stage 1 — Upload

Input:

- PDF
- DOCX
- Images (future)

Output:

Raw document

---

# Stage 2 — Text Extraction

Convert the document into clean text.

Responsibilities:

- OCR (future)
- Remove headers/footers
- Preserve section headings
- Preserve tables where possible

Output:

Clean educational text

---

# Stage 3 — Teacher Brain

Claude analyzes the educational content.

Responsibilities:

- Find concepts
- Identify learning objectives
- Detect prerequisites
- Detect misconceptions
- Suggest teaching strategies
- Suggest question templates

Output:

Structured Concept JSON

---

# Stage 4 — Validation

Ensure every Concept contains:

- ID
- Name
- Learning Objective
- Grade
- Explanation
- Teaching Strategy

Reject incomplete concepts.

---

# Stage 5 — Knowledge Graph

Create relationships.

Examples:

Equivalent Fractions

↓

Comparing Fractions

↓

Addition of Fractions

---

# Stage 6 — Store

Save Concepts into xysq.

Only Concepts are stored.

Questions are generated later.

---

# Design Principle

Documents are temporary.

Concepts are permanent.

Questions are ephemeral.