import { GoogleGenAI } from "@google/genai";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiConfig = {
  apiKey: string;
  model: string;
};

export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL
  };
}

export function createGeminiClient() {
  const { apiKey } = getGeminiConfig();
  return new GoogleGenAI({ apiKey });
}
