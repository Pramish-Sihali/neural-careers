import { test, expect } from "@playwright/test";
import { WelcomeMessageSchema } from "@/lib/ai/prompts/generateWelcomeMessage";

test("welcome message schema accepts a well-formed response", () => {
  const sample = {
    message: "Hi Alice! Welcome to Niural. We're thrilled to have you join the Engineering team starting May 3. Your manager Jordan will reach out Monday morning with your first-week plan. Onboarding resources are linked below.",
  };
  expect(() => WelcomeMessageSchema.parse(sample)).not.toThrow();
});

test("welcome message schema rejects too-short messages", () => {
  expect(() => WelcomeMessageSchema.parse({ message: "hi" })).toThrow();
});

test("welcome message schema rejects overly long messages", () => {
  const tooLong = "x".repeat(2001);
  expect(() => WelcomeMessageSchema.parse({ message: tooLong })).toThrow();
});
