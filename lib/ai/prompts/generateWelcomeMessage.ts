import { z } from "zod";
import { callGeminiWithJson } from "@/lib/ai/parseJson";

export const WelcomeMessageSchema = z.object({
  message: z.string().min(80).max(2000),
});

export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;

export interface WelcomeMessageInput {
  candidateName: string;
  role:          string;
  team:          string;
  startDate:     string;    // ISO date
  managerName?:  string;
  candidateBrief?: string;  // from CandidateEnrichment
  resourceLinks?: { label: string; url: string }[];
}

const SYSTEM_PROMPT = `You are an enthusiastic but professional HR onboarding writer. You write warm, personalized welcome messages for new hires joining a company's Slack workspace.

REQUIREMENTS:
- 150-250 words
- Address the candidate by first name
- Reference their specific role, team, and start date
- If a manager name is provided, mention that the manager will reach out
- If a candidate brief is provided, weave in ONE authentic-sounding detail (e.g. an interest, a past project) — do not copy the brief verbatim
- Include the resource links at the end as a short bulleted list
- Do NOT invent facts (no fake projects, no made-up company culture claims)
- Do NOT use em-dashes
- No marketing fluff ("thrilled", "rockstar", "unicorn")

Return JSON with a single \"message\" field containing the final text.`;

export async function generateWelcomeMessage(
  input: WelcomeMessageInput
): Promise<WelcomeMessage> {
  const userPrompt = `CANDIDATE: ${input.candidateName}
ROLE: ${input.role}
TEAM: ${input.team}
START DATE: ${input.startDate}
${input.managerName ? `MANAGER: ${input.managerName}` : ""}
${input.candidateBrief ? `CANDIDATE BRIEF (do not quote verbatim):\n${input.candidateBrief}` : ""}
${input.resourceLinks && input.resourceLinks.length > 0
  ? `RESOURCE LINKS:\n${input.resourceLinks.map(l => `- ${l.label}: ${l.url}`).join("\n")}`
  : ""}

Write the welcome message now.`;

  return callGeminiWithJson(
    SYSTEM_PROMPT,
    userPrompt,
    WelcomeMessageSchema,
    { modelId: "gemini-2.5-flash-lite", temperature: 0.7 }  // per phase spec — low-stakes welcome
  );
}
