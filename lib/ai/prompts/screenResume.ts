import { z } from "zod";
import { callGeminiWithJson } from "@/lib/ai/parseJson";

export const ScreeningResultSchema = z.object({
  fitScore: z.number().int().min(0).max(100),
  recommendation: z.enum(["SHORTLIST", "REJECT"]),
  strengths: z.array(z.string()).min(1).max(5),
  gaps: z.array(z.string()).max(5),
  rationale: z.string().min(20).max(600),
});

export type ScreeningResult = z.infer<typeof ScreeningResultSchema>;

const SYSTEM_PROMPT = `You are an expert technical recruiter performing an objective resume screening.
You will receive a job description and a candidate's resume text.
You must evaluate fit based ONLY on skills, experience, and qualifications.
Do NOT consider or infer candidate name, gender, age, or ethnicity.

Return a JSON object with these fields:
- fitScore: integer 0-100 representing overall fit for the role
- recommendation: "SHORTLIST" if fitScore >= 65, otherwise "REJECT"
- strengths: array of 1-5 specific strengths relevant to this role
- gaps: array of 0-5 specific gaps or missing requirements
- rationale: 2-3 concise sentences (under 600 characters total) explaining the score and recommendation

Be specific and evidence-based. Reference actual content from the resume.`;

export async function screenResume(
  jobDescription: string,
  resumeText: string
): Promise<ScreeningResult> {
  const userPrompt = `JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Evaluate this candidate's fit for the role and return your assessment as JSON.`;

  return callGeminiWithJson(
    SYSTEM_PROMPT,
    userPrompt,
    ScreeningResultSchema,
    { temperature: 0.1 }
  );
}
