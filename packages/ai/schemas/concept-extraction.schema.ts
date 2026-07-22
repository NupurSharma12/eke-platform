import { z } from "zod";

export const ExtractedConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  learningObjectives: z.array(z.string()),
  explanation: z.string(),
  prerequisites: z.array(z.string()),
  misconceptions: z.array(z.string()),
  teachingStrategies: z.array(z.string()),
  activities: z.array(z.string()),
  realLifeExamples: z.array(z.string()),
  questionTemplates: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const ConceptExtractionResultSchema = z.object({
  concepts: z.array(ExtractedConceptSchema),

  warnings: z.array(z.string()),

  metadata: z.object({
    documentId: z.string(),
    extractor: z.string(),
    extractedAt: z.string(),
  }),
});