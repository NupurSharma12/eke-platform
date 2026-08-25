export type AIProviderName = "groq" | "gemini" | "claude";

/**
 * The single source of truth for the AI_PROVIDER convention already
 * established by runBatchPipeline.ts: "groq" -> groq, "gemini" ->
 * gemini, anything else (unset/unrecognized) -> claude, the same
 * default as before Groq/Gemini existed. Kept as a pure name lookup
 * (no provider instantiation, no env access) so callers like
 * generate-question/route.ts can be unit-tested against every branch
 * without needing real API keys or a live server.
 */
export function resolveProviderName(
  aiProviderEnv: string | undefined
): AIProviderName {
  if (aiProviderEnv === "groq") return "groq";
  if (aiProviderEnv === "gemini") return "gemini";
  return "claude";
}
