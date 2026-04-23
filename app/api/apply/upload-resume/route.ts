import { NextRequest, NextResponse } from "next/server";
import {
  parseResumeBuffer,
  uploadPendingResume,
  ResumeParseError,
} from "@/lib/services/resumeService";

export const runtime = "nodejs";

interface UploadResponse {
  uploadId: string | null;
  storagePath: string | null;
  contentType: string;
  resumeText: string;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const resumeFile = formData.get("resume") as File | null;
  if (!resumeFile) {
    return NextResponse.json({ error: "resume file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await resumeFile.arrayBuffer());

  let resumeText: string;
  try {
    resumeText = await parseResumeBuffer(buffer, resumeFile.name);
  } catch (err) {
    if (err instanceof ResumeParseError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    console.error("[api/apply/upload-resume] parse error:", err);
    return NextResponse.json(
      { error: "Could not parse resume" },
      { status: 500 }
    );
  }

  const uploadId = crypto.randomUUID();
  const contentType = resumeFile.type || "application/octet-stream";

  let storagePath: string | null = null;
  try {
    storagePath = await uploadPendingResume(buffer, uploadId, contentType);
  } catch (err) {
    // DEV-07: storage is non-fatal. Return parsed text anyway so the client can
    // fall back to the legacy submit-time upload path without blocking the UI.
    console.error("[api/apply/upload-resume] storage failed (non-fatal):", err);
  }

  const body: UploadResponse = {
    uploadId: storagePath ? uploadId : null,
    storagePath,
    contentType,
    resumeText,
  };

  return NextResponse.json(body, { status: 200 });
}
