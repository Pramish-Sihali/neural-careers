import { z, ZodSchema } from "zod";
import { getModel } from "./client";

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly lastResponse?: string
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

interface CallOptions {
  modelId?: string;
  maxRetries?: number;
  temperature?: number;
}

export async function callGeminiWithJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  options: CallOptions = {}
): Promise<T> {
  const { modelId = "gemini-2.5-pro", maxRetries = 4, temperature = 0.2 } = options;

  const model = getModel(modelId);
  const generationConfig = {
    temperature,
    responseMimeType: "application/json",
  };

  let lastRaw = "";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt =
        attempt === 0
          ? `${systemPrompt}\n\n${userPrompt}`
          : `${systemPrompt}\n\n${userPrompt}\n\nYour previous response was invalid JSON or failed schema validation:\n${lastRaw}\n\nReturn only valid JSON matching the required schema.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });

      lastRaw = result.response.text().trim();

      // Strip markdown code fences if present
      const cleaned = lastRaw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      const parsed = JSON.parse(cleaned) as unknown;
      const validated = schema.safeParse(parsed);

      if (validated.success) return validated.data;

      lastError = new Error(
        `Schema validation failed: ${JSON.stringify(validated.error.issues)}`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("429") || lastError.message.includes("503");
      if (isRetryable && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }

  throw new StructuredOutputError(
    `Failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    lastRaw
  );
}
