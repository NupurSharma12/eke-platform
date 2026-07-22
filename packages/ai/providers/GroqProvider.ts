import Groq from "groq-sdk";

import { AIProvider } from "./AIProvider";

const MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured"
      );
    }

    this.client = new Groq({
      apiKey,
    });
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      response_format: {
        type: "json_object",
      },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error(
        "Groq returned no text response"
      );
    }

    return content;
  }
}
