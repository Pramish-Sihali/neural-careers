import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  processTranscript,
  TranscriptAlreadyFetchedError,
} from "@/lib/services/notetakerService";

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

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
    return false;
  }
}

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

  // Parse defensively — Fireflies has shipped at least two payload shapes across
  // versions. Accept snake_case or camelCase, and top level or nested under data/payload.
  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  const nested =
    ((parsed.data as Record<string, unknown> | undefined) ??
      (parsed.payload as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;

  const eventType =
    (parsed.event_type as string | undefined) ??
    (parsed.eventType as string | undefined) ??
    (nested.event_type as string | undefined) ??
    (nested.eventType as string | undefined);

  const meetingId =
    (parsed.meetingId as string | undefined) ??
    (parsed.meeting_id as string | undefined) ??
    (nested.meetingId as string | undefined) ??
    (nested.meeting_id as string | undefined);

  // One-shot visibility: log the raw body on every delivery so a future Fireflies
  // schema change is immediately diagnosable. Truncated to keep logs cheap.
  console.log(
    "[fireflies webhook] delivery",
    JSON.stringify({ eventType, meetingId, rawBody: rawBody.slice(0, 400) })
  );

  if (eventType !== "Transcription completed") {
    return NextResponse.json({ received: true });
  }

  if (!meetingId) {
    console.warn("[fireflies webhook] missing meetingId", rawBody.slice(0, 400));
    return NextResponse.json({ received: true });
  }

  // Fast path: direct meetingId match
  const { data: fastMatch } = await supabase
    .from("interviews")
    .select("id, transcriptFetchedAt")
    .eq("firefliesMeetingId", meetingId)
    .limit(1)
    .maybeSingle();

  let interview = fastMatch as { id: string; transcriptFetchedAt: string | null } | null;

  // Fallback: match by Google Meet URL
  if (!interview) {
    const meetingLink = await fetchMeetingLink(meetingId);

    if (meetingLink) {
      const { data: urlMatch } = await supabase
        .from("interviews")
        .select("id, transcriptFetchedAt")
        .eq("meetingUrl", meetingLink)
        .is("firefliesMeetingId", null)
        .limit(1)
        .maybeSingle();

      interview = urlMatch as { id: string; transcriptFetchedAt: string | null } | null;

      if (interview) {
        await supabase
          .from("interviews")
          .update({ firefliesMeetingId: meetingId, updatedAt: new Date().toISOString() })
          .eq("id", interview.id);
      }
    }
  }

  if (!interview) {
    console.warn(`[fireflies webhook] No interview found for meetingId: ${meetingId}`);
    return NextResponse.json({ received: true });
  }

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
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
