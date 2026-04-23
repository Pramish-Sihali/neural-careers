import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  submitApplication,
  submitApplicationWithUpload,
  DuplicateApplicationError,
  JobNotFoundError,
} from "@/lib/services/applicationService";
import { ResumeParseError } from "@/lib/services/resumeService";

export const runtime = "nodejs";

const JsonApplySchema = z.object({
  roleId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  yearsOfExperience: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === null || v === "" ? 0 : Number(v))),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  coverLetter: z.string().optional(),
  // Fast-path fields from /api/apply/upload-resume
  uploadId: z.string().min(1),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
  resumeText: z.string().min(40),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await handleJsonSubmit(req);
    }
    return await handleFormDataSubmit(req);
  } catch (err) {
    return mapSubmitError(err);
  }
}

async function handleJsonSubmit(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = JsonApplySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }
  const input = parsed.data;

  const application = await submitApplicationWithUpload({
    jobId: input.roleId,
    candidateName: input.name,
    candidateEmail: input.email,
    phone: input.phone || undefined,
    linkedinUrl: input.linkedinUrl || undefined,
    githubUrl: input.githubUrl || undefined,
    yearsOfExperience: input.yearsOfExperience,
    coverLetter: input.coverLetter || undefined,
    pendingStoragePath: input.storagePath,
    contentType: input.contentType,
    resumeText: input.resumeText,
  });

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}

async function handleFormDataSubmit(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();

  const jobId = formData.get("roleId") as string | null;
  const candidateName = formData.get("name") as string | null;
  const candidateEmail = formData.get("email") as string | null;
  const resumeFile = formData.get("resume") as File | null;

  if (!jobId || !candidateName || !candidateEmail || !resumeFile) {
    return NextResponse.json(
      { error: "roleId, name, email, and resume are required" },
      { status: 400 }
    );
  }

  const yearsRaw = formData.get("yearsOfExperience");
  const yearsOfExperience = yearsRaw ? Number(yearsRaw) : 0;
  const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());

  const application = await submitApplication({
    jobId,
    candidateName,
    candidateEmail,
    phone: (formData.get("phone") as string) || undefined,
    linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
    githubUrl: (formData.get("githubUrl") as string) || undefined,
    yearsOfExperience,
    coverLetter: (formData.get("coverLetter") as string) || undefined,
    resumeBuffer,
    resumeFileName: resumeFile.name,
    resumeMimeType: resumeFile.type,
  });

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}

function mapSubmitError(err: unknown): NextResponse {
  if (err instanceof DuplicateApplicationError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof JobNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 410 });
  }
  if (err instanceof ResumeParseError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
  }
  console.error("POST /api/apply error:", err);
  return NextResponse.json({ error: "Application submission failed" }, { status: 500 });
}
