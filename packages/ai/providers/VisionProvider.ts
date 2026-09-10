import { ProviderImage } from "./ImageCapableProvider";

/**
 * One educationally meaningful visual element found on a page — a
 * diagram, chart, table, map, labelled illustration, geometry
 * figure, flowchart, etc. `type` is deliberately a free string, not
 * an enum: the prompt gives examples, not an exhaustive list, and
 * this contract shouldn't need editing every time a new kind of
 * visual shows up in real material.
 */
export interface VisualElement {
  type: string;
  description: string;
}

/**
 * Page-level visual evidence — text and visual elements actually
 * observed on one page image, plus a short note on why those visual
 * elements might matter educationally. This is evidence for a human
 * or a later extraction stage to work from, never authoritative
 * curriculum metadata (no chapter/concept/assessment-structure
 * claims belong here — see vision-page-analysis.prompt.ts).
 */
export interface VisionAnalysisResult {
  visibleText: string;
  visualElements: VisualElement[];
  educationalSignificance: string;
}

/**
 * A structured document-understanding capability, deliberately
 * separate from AIProvider/ImageCapableProvider (which are
 * prompt-in/string-out LLM calls) and from OcrProvider (mechanical
 * text transcription only). A VisionProvider produces a specific,
 * validated result shape, not a raw string a caller has to parse
 * itself. Reuses ProviderImage — the same {base64, mediaType} shape
 * ImageCapableProvider/OcrProvider already use — rather than
 * introducing another image representation.
 *
 * `prompt` is optional so a caller can override the default
 * analysis prompt (e.g. for a narrower/different question) without
 * this interface needing to know anything about prompt content.
 */
export interface VisionProvider {
  analyzePage(
    image: ProviderImage,
    prompt?: string
  ): Promise<VisionAnalysisResult>;
}
