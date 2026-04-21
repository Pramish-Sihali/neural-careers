// lib/services/notetakerService.ts

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotetakerService } from "@/lib/integrations/notetaker";

export class InterviewNotFoundError extends Error {}
export class TranscriptAlreadyFetchedError extends Error {}

/**
 * Look up the Interview record for a given applicationId.
 * Used by the simulate-interview route so it never touches Prisma directly.
 */
export async function findInterviewForApplication(applicationId: string) {
  return prisma.interview.findFirst({
    where: { applicationId },
  });
}

/**
 * Fetch transcript (mock or real), store it, and advance both Interview and
 * Application statuses. All three DB writes are in a single transaction.
 *
 * Safe to call concurrently — a duplicate idempotencyKey (P2002) is caught
 * and treated as a known-safe duplicate, not an error.
 */
export async function processTranscript(
  interviewId: string,
  source: "fireflies" | "mock"
): Promise<void> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: { select: { id: true, candidateName: true } },
    },
  });

  if (!interview) throw new InterviewNotFoundError("Interview not found");
  if (interview.transcriptFetchedAt) {
    throw new TranscriptAlreadyFetchedError("Transcript already fetched for this interview");
  }

  const notetaker = getNotetakerService();
  const transcript = await notetaker.fetchTranscript(
    interview.firefliesMeetingId ?? interviewId,
    { candidateName: interview.application.candidateName }
  );

  const transcriptText = transcript.sentences
    .map((s) => `${s.speaker_name}: ${s.text}`)
    .join("\n\n");

  try {
    await prisma.$transaction([
      prisma.interview.update({
        where: { id: interviewId },
        data: {
          transcriptRaw: transcript as object,
          transcriptText,
          transcriptSummary: transcript.summary?.overview ?? "",
          transcriptFetchedAt: new Date(),
          completedAt: new Date(),
          status: "COMPLETED",
        },
      }),
      prisma.application.update({
        where: { id: interview.application.id },
        data: { status: "POST_INTERVIEW" },
      }),
      prisma.eventsLog.create({
        data: {
          applicationId: interview.application.id,
          eventType: "INTERVIEW_COMPLETED",
          payload: { interviewId, source },
          idempotencyKey: `interview_completed_${interviewId}`,
        },
      }),
    ]);
  } catch (err) {
    // P2002 = unique constraint on idempotencyKey — concurrent duplicate, safe to ignore
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return;
    }
    throw err;
  }
}
