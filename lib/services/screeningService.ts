import { supabase } from "@/lib/supabase";
import { parseApplicationRow } from "@/lib/types/database";
import type { Application } from "@/lib/types/database";
import { screenResume } from "@/lib/ai/prompts/screenResume";
import { enrichCandidate } from "@/lib/services/enrichmentService";

export class AlreadyScreenedError extends Error {
  constructor() {
    super("Application has already been screened");
    this.name = "AlreadyScreenedError";
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

async function fetchApplicationForScreening(applicationId: string) {
  const { data: raw, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("id", applicationId)
    .single();

  if (error) throw new Error(`Application ${applicationId} not found`);
  return parseApplicationRow(raw as Record<string, unknown>);
}

function buildJobDescription(job: NonNullable<Application["job"]>): string {
  return [
    job.description,
    `Requirements: ${job.requirements}`,
    `Responsibilities: ${job.responsibilities}`,
  ].join("\n\n");
}

async function persistScreeningResult(
  applicationId: string,
  currentVersion: number,
  result: Awaited<ReturnType<typeof screenResume>>
) {
  const { data: updated, error: updateError } = await supabase
    .from("applications")
    .update({
      status: "SCREENED",
      fitScore: result.fitScore,
      screeningSummary: result,
      screenedAt: new Date().toISOString(),
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("version", currentVersion)
    .select();

  if (updateError) throw updateError;
  if (!updated || updated.length === 0) throw new AlreadyScreenedError();
}

function triggerEnrichmentIfNeeded(applicationId: string, recommendation: string) {
  if (recommendation === "SHORTLIST") {
    enrichCandidate(applicationId).catch((err) =>
      console.error(`Enrichment failed for ${applicationId}:`, err)
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function screenApplication(applicationId: string) {
  const application = await fetchApplicationForScreening(applicationId);

  if (application.status !== "APPLIED") throw new AlreadyScreenedError();

  const jobDescription = buildJobDescription(application.job!);
  const result = await screenResume(jobDescription, application.resumeText);

  await persistScreeningResult(applicationId, application.version, result);

  triggerEnrichmentIfNeeded(applicationId, result.recommendation);

  return result;
}
