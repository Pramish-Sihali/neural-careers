import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processTranscript,
  TranscriptAlreadyFetchedError,
} from "@/lib/services/notetakerService";

/**
 * Timing-safe comparison for webhook secrets.
 * Both values are HMAC-hashed to fixed 32-byte buffers before comparison —
 * this ensures equal-length inputs to timingSafeEqual without leaking length info
 * via padding (a padEnd approach would be cryptographically broken).
 */
function isValidSecret(provided: string): boolean {
  const expected = process.env.FIREFLIES_WEBHOOK_SECRET ?? "";
  const a = crypto
    .createHmac("sha256", "webhook-compare")
    .update(provided)
    .digest();
  const b = crypto
    .createHmac("sha256", "webhook-compare")
    .update(expected)
    .digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret") ?? "";
  if (!isValidSecret(secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
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

  const interview = await prisma.interview.findFirst({
    where: { firefliesMeetingId: body.meetingId },
    select: { id: true, transcriptFetchedAt: true },
  });

  if (!interview) {
    // Not found — log and return 200 so Fireflies does not retry indefinitely
    console.warn(
      `[fireflies webhook] No interview found for meetingId: ${body.meetingId}`
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
