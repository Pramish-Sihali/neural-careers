import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  findInterviewForApplication,
  processTranscript,
  TranscriptAlreadyFetchedError,
} from "@/lib/services/notetakerService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  const { id: applicationId } = await params;

  const interview = await findInterviewForApplication(applicationId);
  if (!interview) {
    return NextResponse.json(
      { error: "No interview found for this application" },
      { status: 404 }
    );
  }

  try {
    await processTranscript(interview.id, "mock");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TranscriptAlreadyFetchedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(
      `[simulate-interview] Failed for applicationId ${applicationId}:`,
      err
    );
    return NextResponse.json(
      { error: "Failed to process transcript" },
      { status: 500 }
    );
  }
}
