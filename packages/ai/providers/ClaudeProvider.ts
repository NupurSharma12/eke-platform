import Anthropic from "@anthropic-ai/sdk";

import { AIProvider } from "./AIProvider";
import { ImageCapableProvider, ProviderImage } from "./ImageCapableProvider";

const MODEL = "claude-sonnet-4-20250514";

function extractTextBlock(response: Anthropic.Messages.Message): string {
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

export class ClaudeProvider implements AIProvider, ImageCapableProvider {
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
      model: MODEL,

      max_tokens: 8000,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return extractTextBlock(response);
  }

  async generateFromImages(
    images: ProviderImage[],
    prompt: string
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,

      max_tokens: 8000,

      messages: [
        {
          role: "user",
          content: [
            ...images.map(
              (image): Anthropic.Messages.ImageBlockParam => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.base64,
                },
              })
            ),
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    return extractTextBlock(response);
  }
}
