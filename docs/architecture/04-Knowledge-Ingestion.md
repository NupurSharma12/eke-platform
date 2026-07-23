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


Purpose

This answers:

How does external material enter EKE?

Current pipeline:

PDF
 ↓
Parse
 ↓
Extract
 ↓
Normalize
 ↓
Canonicalize
 ↓
Build Graph

The document should describe this pipeline.

It should contain
1. Input formats

Current:

PDF

Future:

Images
Scanned pages
Worksheets
Exam papers
Answer sheets
ZIP collections
2. The ingestion pipeline
Source Material
      ↓
Document Parsing
      ↓
AI Extraction
      ↓
Normalization
      ↓
Canonicalization
      ↓
Knowledge Graph
3. Checkpointing

This is important in your current implementation:

Raw Source
    ↓
Raw Extraction Checkpoint
    ↓
Normalized Concepts
    ↓
Canonicalized Concepts
    ↓
Knowledge Graph

The architecture should explain why checkpoints exist:

avoid repeated API calls
support reprocessing
allow algorithm changes without re-extracting
preserve original extraction output
4. Batch ingestion

Your current ZIP pipeline belongs here:

ZIP
 │
 ├── Chapter 1.pdf
 ├── Chapter 2.pdf
 ├── Chapter 3.pdf
 └── Chapter 4.pdf
        │
        ▼
  Process individually
        │
        ▼
  Combine into canonical graph
5. What this document should NOT decide

This document should not decide:

Whether a source is foundational knowledge or a question boundary.

That is the responsibility of the next document.