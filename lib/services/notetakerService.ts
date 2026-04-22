import { supabase } from "@/lib/supabase";
import { parseInterviewRow } from "@/lib/types/database";
import { getNotetakerService } from "@/lib/integrations/notetaker";

export class InterviewNotFoundError extends Error {}
export class TranscriptAlreadyFetchedError extends Error {}

export async function findInterviewForApplication(applicationId: string) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("applicationId", applicationId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseInterviewRow(data as Record<string, unknown>) : null;
}

export async function processTranscript(
  interviewId: string,
  source: "fireflies" | "mock"
): Promise<void> {
  const { data: interviewRaw, error: fetchError } = await supabase
    .from("interviews")
    .select("*, application:applications(id, candidateName)")
    .eq("id", interviewId)
    .single();

  if (fetchError) throw new InterviewNotFoundError("Interview not found");
  const interview = parseInterviewRow(interviewRaw as Record<string, unknown>);

  if (interview.transcriptFetchedAt) {
    throw new TranscriptAlreadyFetchedError("Transcript already fetched for this interview");
  }

  const notetaker = getNotetakerService();
  const transcript = await notetaker.fetchTranscript(
    interview.firefliesMeetingId ?? interviewId,
    { candidateName: interview.application!.candidateName }
  );

  const transcriptText = transcript.sentences
    .map((s: { speaker_name: string; text: string }) => `${s.speaker_name}: ${s.text}`)
    .join("\n\n");

  const nowIso = new Date().toISOString();

  // Sequential writes — idempotency enforced by unique constraint on idempotencyKey
  const { error: intErr } = await supabase
    .from("interviews")
    .update({
      transcriptRaw: transcript as object,
      transcriptText,
      transcriptSummary: transcript.summary?.overview ?? "",
      transcriptFetchedAt: nowIso,
      completedAt: nowIso,
      status: "COMPLETED",
      updatedAt: nowIso,
    })
    .eq("id", interviewId);

  if (intErr) throw intErr;

  await supabase
    .from("applications")
    .update({ status: "POST_INTERVIEW", updatedAt: nowIso })
    .eq("id", interview.application!.id);

  const { error: logError } = await supabase.from("events_log").insert({
    id: crypto.randomUUID(),
    applicationId: interview.application!.id,
    eventType: "INTERVIEW_COMPLETED",
    payload: { interviewId, source },
    idempotencyKey: `interview_completed_${interviewId}`,
    createdAt: nowIso,
  });

  // 23505 = unique_violation — idempotent duplicate, safe to ignore
  if (logError && logError.code !== "23505") {
    throw logError;
  }
}
