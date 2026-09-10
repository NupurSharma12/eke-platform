import { ParsedDocument } from "./shared-types";
import { VisionProvider } from "./ai/providers/VisionProvider";

/**
 * Lives at the top level, not inside knowledge-engine/, for the same
 * reason generateQuestion.ts/runPipeline.ts/runBatchPipeline.ts do:
 * it needs the AI-side VisionProvider abstraction, and
 * knowledge-engine/ itself has no dependency on ai/ anywhere in this
 * codebase (see generateQuestion.ts's own doc comment) — this
 * preserves that boundary rather than crossing it.
 */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Adds vision analysis as a separate enrichment layer on top of an
 * already parsed (and possibly already OCR-enriched) document —
 * never inside parseDocument() itself, and never by mutating the
 * document passed in. Every existing field (`pages`, `pageImages`,
 * and any prior OCR enrichment fields) is carried through to the
 * returned document exactly as it was; this only ever adds/replaces
 * the pageVisionAnalysis/pageVisionErrors arrays.
 *
 * A page is only ever sent to vision analysis when it has a rendered
 * image (pageImages[i] is non-null) — this milestone does not decide
 * whether a text-bearing page also deserves vision analysis; it only
 * covers the pages parseDocument() already rendered as images. One
 * page per provider request — no batching. One page's failure never
 * fails the whole document: the error is captured in
 * pageVisionErrors[i] and every other page is still processed.
 */
export async function enrichWithVision(
  document: ParsedDocument,
  visionProvider: VisionProvider,
  prompt?: string
): Promise<ParsedDocument> {
  const pageCount = document.pages.length;

  const pageVisionAnalysis: ParsedDocument["pageVisionAnalysis"] = new Array(pageCount).fill(null);
  const pageVisionErrors: Array<string | null> = new Array(pageCount).fill(null);

  for (let i = 0; i < pageCount; i++) {
    const image = document.pageImages?.[i] ?? null;

    if (!image) {
      continue;
    }

    try {
      pageVisionAnalysis![i] = await visionProvider.analyzePage(image, prompt);
    } catch (error) {
      pageVisionErrors[i] = errorMessage(error);
    }
  }

  return {
    ...document,
    pageVisionAnalysis,
    pageVisionErrors,
  };
}
