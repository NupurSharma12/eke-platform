import { z } from "zod";

/**
 * The raw shape the LLM is expected to return: a list of candidate
 * page ranges only. Validates structural shape and internal
 * consistency (startPage <= endPage, positive integers, non-empty
 * strings where required) — it deliberately does NOT know the
 * document's actual page count, since a Zod schema validates one
 * response in isolation and has no access to the ParsedDocument that
 * produced it. Checking a range against the real page count is the
 * service's job (see DocumentStructureExtractorService), not this
 * schema's — the same separation AssessmentStructureExtractorService
 * already keeps between "is this shape valid" and "is this actually
 * true of the source document."
 *
 * No numeric confidence field is accepted, by omission — the prompt
 * never asks for one and this schema never validates one, so an LLM
 * response that includes one simply has it ignored by Zod's default
 * (non-strict) object parsing rather than rejected outright; nothing
 * downstream ever reads a field this schema doesn't define.
 */
export const StructuralRangeKindSchema = z.enum(["content", "exercise"]);

export const StructuralCandidateRangeSchema = z
  .object({
    kind: StructuralRangeKindSchema,
    startPage: z.number().int().positive(),
    endPage: z.number().int().positive(),
    chapterTitle: z.string().min(1).optional(),
    chapterNumber: z.number().int().positive().optional(),
    evidence: z.string().min(1, "evidence must be a non-empty, human-checkable description"),
  })
  .refine((range) => range.startPage <= range.endPage, {
    message: "startPage must be less than or equal to endPage",
    path: ["startPage"],
  });

export const DocumentStructureExtractionResultSchema = z.object({
  ranges: z
    .array(StructuralCandidateRangeSchema)
    .min(1, "ranges must contain at least one entry"),
});
