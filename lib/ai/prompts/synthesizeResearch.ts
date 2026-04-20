import { z } from "zod";
import { callGeminiWithJson } from "@/lib/ai/parseJson";

const ResearchSynthesisSchema = z.object({
  candidateBrief: z.string().min(50).max(600),
  discrepancies: z.array(
    z.object({
      field: z.string(),
      resumeValue: z.string(),
      onlineValue: z.string(),
    })
  ),
});

type ResearchSynthesis = z.infer<typeof ResearchSynthesisSchema>;

const SYSTEM_PROMPT = `You are a research analyst synthesizing online information about a job candidate.
You will receive the candidate's resume text and any online data found (LinkedIn, GitHub, web search).
Produce a concise candidate brief and flag any factual discrepancies between the resume and online sources.

Return JSON with:
- candidateBrief: 3-5 sentence summary combining resume highlights and online presence
- discrepancies: array of objects with field, resumeValue, onlineValue for any mismatches found (empty array if none)`;

export async function synthesizeResearch(
  resumeText: string,
  onlineData: {
    linkedinSummary?: string;
    githubDigest?: object;
    webSearch?: string;
  }
): Promise<ResearchSynthesis> {
  const userPrompt = `RESUME:
${resumeText}

ONLINE DATA:
${onlineData.linkedinSummary ? `LinkedIn: ${onlineData.linkedinSummary}` : ""}
${onlineData.githubDigest ? `GitHub: ${JSON.stringify(onlineData.githubDigest, null, 2)}` : ""}
${onlineData.webSearch ? `Web search: ${onlineData.webSearch}` : ""}

Synthesize this information and return the JSON response.`;

  return callGeminiWithJson(
    SYSTEM_PROMPT,
    userPrompt,
    ResearchSynthesisSchema,
    { temperature: 0.3 }
  );
}
