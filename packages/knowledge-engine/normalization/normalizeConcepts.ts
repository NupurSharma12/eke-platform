import {
  BloomLevel,
  Concept,
  ConceptExtractionResult,
  ConceptReference,
  DifficultyLevel,
  ExtractedConcept,
  Misconception,
  QuestionTemplate,
  TeachingStrategy,
} from "../../shared-types";

/**
 * Deterministic defaults applied when the extraction stage
 * does not (and cannot reliably) produce a value.
 *
 * These are intentionally conservative "middle of the road"
 * values rather than guesses, since normalization must not
 * call an AI provider to infer them.
 */
const DEFAULT_BLOOM_LEVEL: BloomLevel = "understand";
const DEFAULT_DIFFICULTY: DifficultyLevel = "grade";
const DEFAULT_ESTIMATED_MINUTES = 10;
const INITIAL_VERSION = 1;

/**
 * Turns free text into a stable, URL-safe identifier.
 *
 * Used for prerequisite references: extraction only gives us a
 * text description (e.g. "Understanding of basic geometry
 * concepts"), not a real Concept id. Slugifying the text
 * deterministically means identical prerequisite text appearing
 * across multiple extracted concepts collapses to the same
 * placeholder id, instead of minting an unrelated id per
 * occurrence. Resolving these placeholders to real Concept ids
 * is the responsibility of the graph-building stage, not
 * normalization.
 */
export function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "unknown";
}

/**
 * Infers the dominant teaching approach from free-text strategy
 * descriptions via simple, deterministic keyword matching.
 *
 * This is a best-effort classification, not a lossless mapping:
 * TeachingStrategy has no field to hold the raw strategy
 * descriptions themselves (activities/parentTips/visualIdeas all
 * mean something more specific), so only the inferred `primary`
 * value survives normalization.
 */
export function inferPrimaryStrategy(
  strategies: string[]
): TeachingStrategy["primary"] {
  const text = strategies.join(" ").toLowerCase();

  if (/\bgame|play\b/.test(text)) return "game";
  if (/\bstory|narrative\b/.test(text)) return "story";
  if (/\bvisual|diagram|picture|image\b/.test(text)) return "visual";
  if (/\bdiscuss|debate\b/.test(text)) return "discussion";

  return "activity";
}

/**
 * Infers a QuestionTemplate type from a raw question prompt via
 * simple, deterministic keyword matching. Extraction only gives
 * us prompt text (e.g. "What type of turn is this?"), not an
 * explicit type tag, so this is a heuristic default rather than
 * a guaranteed-correct classification.
 */
export function inferQuestionType(
  description: string
): QuestionTemplate["type"] {
  const text = description.toLowerCase();

  if (/\bblank\b/.test(text)) return "fill-blanks";
  if (/\bolympiad|challenge|advanced\b/.test(text)) return "olympiad";
  if (/\bdiagram|picture|image|draw\b/.test(text)) return "visual";
  if (/\bhow many|calculate|find the\b/.test(text)) return "word-problem";
  if (/\bwhy|explain|describe\b/.test(text)) return "reasoning";

  return "mcq";
}

function mapPrerequisite(text: string): ConceptReference {
  return {
    id: slugify(text),
    name: text,
  };
}

function mapMisconception(text: string): Misconception {
  return {
    misconception: text,
    // Extraction provides no correction text. Left empty
    // (rather than fabricated) pending a review/enrichment
    // stage that can supply one.
    correction: "",
  };
}

function mapQuestionTemplate(
  description: string,
  bloomLevel: BloomLevel,
  recommendedDifficulty: DifficultyLevel
): QuestionTemplate {
  return {
    type: inferQuestionType(description),
    description,
    bloomLevel,
    recommendedDifficulty,
  };
}

interface NormalizationContext {
  documentId: string;
  extractedAt: string;
}

function normalizeConcept(
  extracted: ExtractedConcept,
  context: NormalizationContext
): Concept {
  const bloomLevel = DEFAULT_BLOOM_LEVEL;
  const difficulty = DEFAULT_DIFFICULTY;

  return {
    id: extracted.id,
    name: extracted.name,

    // Confirmed aliases are only ever added by the
    // canonicalization stage, never at normalization time.
    aliases: [],

    domains: [],

    learningObjectives: extracted.learningObjectives,

    bloomLevel,
    difficulty,

    explanation: extracted.explanation,

    realLifeExamples: extracted.realLifeExamples,

    stories: [],
    analogies: [],

    prerequisites: extracted.prerequisites.map(mapPrerequisite),

    leadsTo: [],
    relatedConcepts: [],

    misconceptions: extracted.misconceptions.map(mapMisconception),

    teaching: {
      primary: inferPrimaryStrategy(extracted.teachingStrategies),
      activities: extracted.activities,
      parentTips: [],
      visualIdeas: [],
    },

    questionTemplates: extracted.questionTemplates.map((description) =>
      mapQuestionTemplate(description, bloomLevel, difficulty)
    ),

    estimatedMinutes: DEFAULT_ESTIMATED_MINUTES,

    sourceDocuments: [context.documentId],

    version: INITIAL_VERSION,

    keywords: extracted.keywords,

    metadata: {
      version: INITIAL_VERSION,
      sourceDocuments: [context.documentId],
      createdAt: context.extractedAt,
      updatedAt: context.extractedAt,
    },
  };
}

/**
 * Maps a raw ConceptExtractionResult into canonical Concepts.
 *
 * Pure and deterministic: no AI provider calls, no wall-clock
 * reads (createdAt/updatedAt come from the extraction result's
 * own metadata.extractedAt, not Date.now()). Calling this twice
 * with the same input always produces the same output.
 *
 * `sourceDocumentId` must be supplied by the caller (e.g.
 * ParsedDocument.id) and is used verbatim as Concept
 * provenance. `result.metadata.documentId` is deliberately not
 * used for this: it is generated by the LLM as part of the
 * extraction response and is not trustworthy provenance for the
 * actual source document. The raw extraction result itself is
 * left untouched.
 */
export function normalizeConcepts(
  result: ConceptExtractionResult,
  sourceDocumentId: string
): Concept[] {
  const context: NormalizationContext = {
    documentId: sourceDocumentId,
    extractedAt: result.metadata.extractedAt,
  };

  return result.concepts.map((extracted) =>
    normalizeConcept(extracted, context)
  );
}
