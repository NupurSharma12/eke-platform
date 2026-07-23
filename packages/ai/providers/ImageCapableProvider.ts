import { AIProvider } from "./AIProvider";

export interface ProviderImage {
  base64: string;
  mediaType: "image/jpeg" | "image/png";
}

/**
 * Optional capability, not a change to AIProvider itself. A
 * provider that can process image content implements this in
 * addition to AIProvider; one that can't (e.g. GroqProvider,
 * currently backed by a text-only model) simply doesn't — the
 * absence is a structural, compile-time fact, not a hidden
 * runtime assumption.
 */
export interface ImageCapableProvider extends AIProvider {
  generateFromImages(
    images: ProviderImage[],
    prompt: string
  ): Promise<string>;
}

/**
 * Runtime capability check, since a caller often only has a
 * plain `AIProvider`-typed value (the selected provider is chosen
 * dynamically at startup) and needs to know before attempting
 * image extraction whether it's safe to call
 * generateFromImages.
 */
export function isImageCapableProvider(
  provider: AIProvider
): provider is ImageCapableProvider {
  return typeof (provider as Partial<ImageCapableProvider>).generateFromImages === "function";
}
