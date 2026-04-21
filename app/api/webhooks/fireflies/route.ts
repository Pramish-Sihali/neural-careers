import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processTranscript,
  TranscriptAlreadyFetchedError,
} from "@/lib/services/notetakerService";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

// Fireflies signs the raw request body with HMAC-SHA256 and sends it as
// x-hub-signature: sha256=<hex> — same format as GitHub webhooks.
function isValidSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET ?? "";
  const computed = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(signatureHeader, "utf8")
    );
  } catch {
    // Buffers differ in length — malformed signature header
    return false;
  }
}

// Fetch the meeting_link for a Fireflies transcript.
// Used as a fallback when no Interview row has a matching firefliesMeetingId.
async function fetchMeetingLink(meetingId: string): Promise<string | null> {
  try {
    const res = await fetch(FIREFLIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({
        query: `query GetMeetingLink($id: String!) {
          transcript(id: $id) { meeting_link }
        }`,
        variables: { id: meetingId },
      }),
    });
    const { data } = (await res.json()) as {
      data?: { transcript?: { meeting_link?: string } };
    };
    return data?.transcript?.meeting_link ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature") ?? "";

  if (!isValidSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = JSON.parse(rawBody) as {
    event_type?: string;
    meetingId?: string;
  };

  // Fireflies sends multiple event types — only process transcript completion
  if (body.event_type !== "Transcription completed") {
    return NextResponse.json({ received: true });
  }

  if (!body.meetingId) {
    return NextResponse.json({ received: true });
  }

  const meetingId = body.meetingId;

  // --- Fast path: direct meetingId match ---
  let interview = await prisma.interview.findFirst({
    where: { firefliesMeetingId: meetingId },
    select: { id: true, transcriptFetchedAt: true },
  });

  // --- Fallback: match by Google Meet URL (Approach 3) ---
  // Interview.firefliesMeetingId is null at creation time when the bot joins
  // via a calendar invite. We resolve the Google Meet URL from Fireflies and
  // match it against Interview.meetingUrl to find the right record.
  if (!interview) {
    const meetingLink = await fetchMeetingLink(meetingId);

    if (meetingLink) {
      interview = await prisma.interview.findFirst({
        where: { meetingUrl: meetingLink, firefliesMeetingId: null },
        select: { id: true, transcriptFetchedAt: true },
      });

      if (interview) {
        // Link the meetingId now so future lookups use the fast path
        await prisma.interview.update({
          where: { id: interview.id },
          data: { firefliesMeetingId: meetingId },
        });
      }
    }
  }

  if (!interview) {
    console.warn(
      `[fireflies webhook] No interview found for meetingId: ${meetingId}`
    );
    return NextResponse.json({ received: true });
  }

  // Sequential idempotency — concurrent duplicate handled inside processTranscript (P2002)
  if (interview.transcriptFetchedAt) {
    return NextResponse.json({ received: true });
  }

  try {
    await processTranscript(interview.id, "fireflies");
  } catch (err) {
    if (err instanceof TranscriptAlreadyFetchedError) {
      return NextResponse.json({ received: true });
    }
    console.error("[fireflies webhook] processTranscript failed:", err);
    // Return 500 so Fireflies retries
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
