import assert from "node:assert/strict";

import { resolveProviderName } from "../packages/ai";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function main() {
  console.log("resolveProviderName (AI_PROVIDER convention)");

  test('AI_PROVIDER="groq" resolves to "groq"', () => {
    assert.equal(resolveProviderName("groq"), "groq");
  });

  test('AI_PROVIDER="gemini" resolves to "gemini"', () => {
    assert.equal(resolveProviderName("gemini"), "gemini");
  });

  test("AI_PROVIDER unset defaults to \"claude\", same as before groq/gemini existed", () => {
    assert.equal(resolveProviderName(undefined), "claude");
  });

  test('an unrecognized AI_PROVIDER value falls back to "claude" rather than throwing', () => {
    assert.equal(resolveProviderName("not-a-real-provider"), "claude");
  });

  console.log(`\n${passed} passed`);
}

main();
