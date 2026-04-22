import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import { screenResume } from "@/lib/ai/prompts/screenResume";
import { enrichCandidate } from "@/lib/services/enrichmentService";

export class AlreadyScreenedError extends Error {
  constructor() {
    super("Application has already been screened");
    this.name = "AlreadyScreenedError";
  }
}

export async function screenApplication(applicationId: string) {
  const { data: raw, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", applicationId)
    .single();

  if (error) throw new Error(`Application ${applicationId} not found`);

  const application = parseApplicationRow(raw as Record<string, unknown>);

  if (application.status !== "APPLIED") throw new AlreadyScreenedError();

  const job = application.job!;
  const jobDescription = [
    job.description,
    `Requirements: ${job.requirements}`,
    `Responsibilities: ${job.responsibilities}`,
  ].join("\n\n");

  const result = await screenResume(jobDescription, application.resumeText);

  // Optimistic lock: only update if version hasn't changed
  const { data: updated, error: updateError } = await supabase
    .from("applications")
    .update({
      status: "SCREENED",
      fitScore: result.fitScore,
      screeningSummary: result,
      screenedAt: new Date().toISOString(),
      version: application.version + 1,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("version", application.version)
    .select();

  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    throw new AlreadyScreenedError();
  }

  // Fire async enrichment for shortlist candidates — don't await
  if (result.recommendation === "SHORTLIST") {
    enrichCandidate(applicationId).catch((err) =>
      console.error(`Enrichment failed for ${applicationId}:`, err)
    );
  }

  return result;
}
