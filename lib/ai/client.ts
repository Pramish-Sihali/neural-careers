import { GoogleGenerativeAI } from "@google/generative-ai";

const globalForGemini = globalThis as unknown as { gemini: GoogleGenerativeAI };

export const gemini =
  globalForGemini.gemini ??
  new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

if (process.env.NODE_ENV !== "production") globalForGemini.gemini = gemini;

export function getModel(modelId = "gemini-2.5-flash") {
  return gemini.getGenerativeModel({ model: modelId });
}

export function getLiteModel() {
  return gemini.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
}
