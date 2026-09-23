import { GoogleGenAI } from "@google/genai";

import { createGeminiClient, getGeminiConfig } from "@/configs/gemini";

type SummarizeServiceOptions = {
  client?: GoogleGenAI;
  model?: string;
};

export function createSummarizeService({
  client = createGeminiClient(),
  model = getGeminiConfig().model
}: SummarizeServiceOptions = {}) {
  return {
    async summarize(ticket: string): Promise<string> {
      const response = await client.models.generateContent({
        model,
        contents: `Summarize this support ticket in 2 lines:\n\n${ticket}`
      });

      const summary =
        response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!summary) {
        throw new Error("Gemini returned an empty summary");
      }

      return summary;
    }
  };
}
