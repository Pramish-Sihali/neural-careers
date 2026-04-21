import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processTranscript,
  TranscriptAlreadyFetchedError,
} from "@/lib/services/notetakerService";

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
