import Anthropic from "@anthropic-ai/sdk";

import { AIProvider } from "./AIProvider";

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured"
    );
  }

  this.client = new Anthropic({
    apiKey,
  });
}

  async generate(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",

      max_tokens: 8000,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find(
      (block) => block.type === "text"
    );

    if (!textBlock || textBlock.type !== "text") {
      throw new Error(
        "Claude returned no text response"
      );
    }

    return textBlock.text;
  }
}