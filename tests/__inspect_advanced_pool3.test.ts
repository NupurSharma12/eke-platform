import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { GroqProvider } from "../packages/ai/providers/GroqProvider";
import { buildQuestionGenerationPrompt } from "../packages/ai/prompts/question-generation.prompt";
import { loadKnowledgeGraph, CANONICAL_GRAPH_FILENAME } from "../packages/knowledge-engine/graph";
import { loadQuestionPatterns } from "../packages/knowledge-engine/canonicalization";
import { buildBlueprint } from "../packages/knowledge-engine/questionGeneration";

const SUPPORTED = new Set(["fraction-bar", "shape", "angle", "bar-chart", "number-line"]);

async function main() {
  const graph = await loadKnowledgeGraph(CANONICAL_GRAPH_FILENAME);
  const concept = graph.concepts.find((c) => c.id === "fractions");
  if (!concept) throw new Error("fractions concept not found");

  const request = { conceptId: "fractions", difficulty: "advanced" as const, questionType: "mcq" as const };
  const patterns = await loadQuestionPatterns("fractions");
  const blueprint = buildBlueprint(concept, request, patterns, new Date().toISOString());
  const prompt = buildQuestionGenerationPrompt(blueprint, 15);
  const provider = new GroqProvider();

  const allTypesSeen = new Set<string>();

  for (let attempt = 1; attempt <= 12; attempt++) {
    const raw = await provider.generate(prompt);
    const parsed = JSON.parse(raw);
    const questions = parsed.questions ?? parsed;

    let foundUnsupported = false;
    questions.forEach((q: any, i: number) => {
      if (q.visualSpec) {
        allTypesSeen.add(q.visualSpec.type);
        const ok = SUPPORTED.has(q.visualSpec.type);
        if (!ok) {
          foundUnsupported = true;
          console.log(`\n=== attempt ${attempt}, index ${i}: UNSUPPORTED type "${q.visualSpec.type}" ===`);
          console.log(JSON.stringify(q, null, 2));
        }
      }
    });
    console.log(`attempt ${attempt}: ${questions.length} questions, types so far: ${Array.from(allTypesSeen).join(", ") || "(none)"}`);
    if (foundUnsupported) {
      console.log("FOUND UNSUPPORTED TYPE, stopping.");
      return;
    }
  }
  console.log("\nNo unsupported visualSpec.type reproduced. All types seen:", Array.from(allTypesSeen));
}
main().catch((e) => { console.error(e); process.exit(1); });
